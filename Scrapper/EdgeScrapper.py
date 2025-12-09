import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.edge.service import Service  # <-- new
from pymongo import MongoClient

# ======================================
# CONFIG
# ======================================
PSX_URL = "https://dps.psx.com.pk/"
WAIT_TIME = 20

MONGO_URI = "mongodb+srv://practicehours08_db_user:6BbpygkmLhvhsd8I@cluster0.aqwkqsw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "psx"
COLLECTION_NAME = "market_watch"

EDGE_DRIVER_PATH = r"C:\Users\mamuj\Downloads\edgedriver_win64\msedgedriver.exe"

# ======================================
# MONGO CONNECT
# ======================================
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# ======================================
# SELENIUM SETUP (EDGE HEADLESS)
# ======================================
options = webdriver.EdgeOptions()
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")

# Use Service object for Selenium 4.12+
service = Service(executable_path=EDGE_DRIVER_PATH)
driver = webdriver.Edge(service=service, options=options)
wait = WebDriverWait(driver, WAIT_TIME)

# ======================================
# OPEN WEBSITE
# ======================================
print("🌎 Opening PSX website...")
driver.get(PSX_URL)

# Close disclaimer popup
try:
    btn = wait.until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "button.tingle-modal__close")
    ))
    btn.click()
    print("✔ Disclaimer popup closed")
    time.sleep(1)
except:
    print("ℹ No disclaimer popup")

# Select "All entries"
dropdown = wait.until(
    EC.presence_of_element_located((By.NAME, "DataTables_Table_0_length"))
)
Select(dropdown).select_by_value("-1")
time.sleep(2)

# Wait for table to load
wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "table#DataTables_Table_0 tbody tr")))

# ======================================
# SCRAPE MARKET DATA
# ======================================
rows = driver.find_elements(By.CSS_SELECTOR, "table#DataTables_Table_0 tbody tr")
market_data = []

for r in rows:
    cols = r.find_elements(By.TAG_NAME, "td")
    if len(cols) < 9:
        continue

    symbol = cols[0].text.strip()
    if not symbol or symbol == "No matching records found":
        continue

    market_data.append({
        "SYMBOL": symbol,
        "LDCP": cols[1].text.strip(),
        "OPEN": cols[2].text.strip(),
        "HIGH": cols[3].text.strip(),
        "LOW": cols[4].text.strip(),
        "CURRENT": cols[5].text.strip(),
        "CHANGE": cols[6].text.strip(),
        "CHANGE (%)": cols[7].text.strip(),
        "VOLUME": cols[8].text.strip(),
    })

print(f"🔹 Scraped {len(market_data)} market rows")

# ======================================
# SCRAPE SECTOR & INDEX MAPPINGS
# ======================================
sector_select = Select(driver.find_element(By.CSS_SELECTOR, "#listingsSectorFilter select"))
sectors = {opt.get_attribute("value"): opt.text.strip() for opt in sector_select.options if opt.get_attribute("value")}

index_select = Select(driver.find_element(By.CSS_SELECTOR, "#listingsIndexFilter select"))
indexes = {opt.get_attribute("value"): opt.text.strip() for opt in index_select.options if opt.get_attribute("value")}

for rec in market_data:
    rec["sector"] = []
    rec["index"] = []

# ======================================
# SAVE TO MONGO
# ======================================
existing_symbols = set(doc["SYMBOL"] for doc in collection.find({}, {"SYMBOL": 1}))

for rec in market_data:
    collection.update_one(
        {"SYMBOL": rec["SYMBOL"]},
        {"$set": rec},
        upsert=True
    )

# Delete outdated symbols
base_symbols = set(r["SYMBOL"] for r in market_data)
to_delete = existing_symbols - base_symbols
if to_delete:
    collection.delete_many({"SYMBOL": {"$in": list(to_delete)}})
    print(f"🗑️ Deleted {len(to_delete)} outdated records")

# ======================================
# SAVE CSV
# ======================================
df = pd.DataFrame(market_data)
df.to_csv("psx_market_watch_all.csv", index=False, encoding="utf-8-sig")
print("📄 Saved psx_market_watch_all.csv")

print("✔ Mongo upserted:", len(market_data))
print("🎉 DONE!")

driver.quit()
