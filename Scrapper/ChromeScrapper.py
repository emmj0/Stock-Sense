import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from pymongo import MongoClient
import pandas as pd

# ======================================
# CONFIG
# ======================================
PSX_URL = "https://dps.psx.com.pk/"
WAIT_TIME = 25

MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "psx"
MARKET_COLLECTION_NAME = "market_watch"


# ======================================
# MONGO CONNECT
# ======================================
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
market_collection = db[MARKET_COLLECTION_NAME]


# ======================================
# SELENIUM
# ======================================
options = webdriver.ChromeOptions()
options.add_argument("--start-maximized")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, WAIT_TIME)


# ======================================
# OPEN WEBSITE
# ======================================
print("\n 🌎 OPENING WEBSITE ...")
driver.get(PSX_URL)

# ======================================
# CLOSE Disclaimer popup
# ======================================
try:
    btn = wait.until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "button.tingle-modal__close")
    ))
    btn.click()
    print("✔ Disclaimer popup closed")
    time.sleep(1)
except TimeoutException:
    print("ℹ No popup")


# ======================================
# SELECT ALL Entries
# ======================================
print("\n🔄 Selecting All entries...")
dropdown = wait.until(
    EC.presence_of_element_located((By.NAME, "DataTables_Table_0_length"))
)
Select(dropdown).select_by_value("-1")
time.sleep(4)


# ======================================
# SCRAPE BASE SYMBOLS
# ======================================
print("\n📥 Scraping base symbols...")

table_rows = driver.find_elements(By.CSS_SELECTOR, "table#DataTables_Table_0 tbody tr")
market_data = []
base_symbols = set()

for row_item in table_rows:
    cells = row_item.find_elements(By.TAG_NAME, "td")
    if not cells or len(cells) < 9:
        continue

    sym = cells[0].text.strip()
    if not sym or sym == "No matching records found":
        continue

    base_symbols.add(sym)
    market_data.append({
        "SYMBOL": sym,
        "LDCP": cells[1].text.strip(),
        "OPEN": cells[2].text.strip(),
        "HIGH": cells[3].text.strip(),
        "LOW": cells[4].text.strip(),
        "CURRENT": cells[5].text.strip(),
        "CHANGE": cells[6].text.strip(),
        "CHANGE (%)": cells[7].text.strip(),
        "VOLUME": cells[8].text.strip(),
    })

print("🔹 Total base symbols:", len(base_symbols))
print("🔹 Market rows scraped:", len(market_data))

# prepare mapping dict
symbol_map = {}
for sym in base_symbols:
    symbol_map[sym] = {
        "symbol": sym,
        "sector": set(),
        "index": set()
    }


def wait_for_table():
    wait.until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "table tbody tr"))
    )


# ======================================
# SECTOR LIST
# ======================================
print("\n📌 Reading Sectors...")

sector_select = Select(wait.until(
    EC.presence_of_element_located(
        (By.CSS_SELECTOR, "#listingsSectorFilter select")
    )
))

sectors = [(opt.get_attribute("value"), opt.text.strip())
           for opt in sector_select.options if opt.get_attribute("value")]

print("🔸 Sector count =", len(sectors))


# ======================================
# INDEX LIST
# ======================================
print("\n📌 Reading Index...")

index_select = Select(wait.until(
    EC.presence_of_element_located(
        (By.CSS_SELECTOR, "#listingsIndexFilter select")
    )
))

indexes = [(opt.get_attribute("value"), opt.text.strip())
           for opt in index_select.options if opt.get_attribute("value")]

print("🔹 Index count =", len(indexes))


# ======================================
# CAPTURE FUNCTION
# ======================================
def capture(sector=None, index=None):
    wait_for_table()
    mapped_rows = driver.find_elements(By.CSS_SELECTOR, "table tbody tr")

    for mapped_row in mapped_rows:
        mapped_tds = mapped_row.find_elements(By.TAG_NAME, "td")
        if not mapped_tds:
            continue

        symbol_val = mapped_tds[0].text.strip()

        # skip dummy row
        if not symbol_val or symbol_val == "No matching records found":
            continue

        # skip unknown symbols
        if symbol_val not in symbol_map:
            continue

        if sector:
            symbol_map[symbol_val]["sector"].add(sector)
        if index:
            symbol_map[symbol_val]["index"].add(index)


# ======================================
# MAP SECTORS
# ======================================
print("\n🔁 Mapping Sectors...")

for val, name in sectors:
    print(f"   🔸 {name}")
    sector_select.select_by_value(val)
    time.sleep(2)
    capture(sector=name)


sector_select.select_by_index(0)
time.sleep(1)


# ======================================
# MAP INDEXES
# ======================================
print("\n🔁 Mapping Index...")

for val, name in indexes:
    print(f"   🔹 {name}")
    index_select.select_by_value(val)
    time.sleep(2)
    capture(index=name)


# ======================================
# SAVE TO DB (single collection)
# ======================================
print("\n💾 Saving in MongoDB ...")

# merge sector/index mapping into market_data rows
symbol_to_mapping = {
    x["symbol"]: {
        "sector": list(x["sector"]),
        "index": list(x["index"]),
    }
    for x in symbol_map.values()
}

merged_docs = []
for rec in market_data:
    mapping = symbol_to_mapping.get(rec["SYMBOL"], {"sector": [], "index": []})
    merged = {
        **rec,
        "sector": mapping["sector"],
        "index": mapping["index"],
    }
    merged_docs.append(merged)

existing_symbols = set(doc["SYMBOL"] for doc in market_collection.find({}, {"SYMBOL": 1}))

for rec in merged_docs:
    market_collection.update_one(
        {"SYMBOL": rec["SYMBOL"]},
        {"$set": rec},
        upsert=True,
    )

to_delete = existing_symbols - base_symbols
if to_delete:
    market_collection.delete_many({"SYMBOL": {"$in": list(to_delete)}})
    print(f"🗑️ Removed {len(to_delete)} outdated market records")

# # Optional CSV output includes sector/index columns
# pd.DataFrame(merged_docs).to_csv("psx_market_watch_all.csv", index=False, encoding="utf-8-sig")
# print("📄 Saved psx_market_watch_all.csv")
print("✔ Mongo upserted:", len(merged_docs))

print("\n🎉 DONE!")
driver.quit()
