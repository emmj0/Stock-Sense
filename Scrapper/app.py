# import time
# import pandas as pd
# from selenium import webdriver
# from selenium.webdriver.common.by import By
# from selenium.webdriver.chrome.service import Service
# from selenium.webdriver.support.ui import Select, WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC
# from webdriver_manager.chrome import ChromeDriverManager
# from pymongo import MongoClient

# # ================== MongoDB Setup ==================
# MONGO_URI = "mongodb://localhost:27017/"
# DB_NAME = "psx_db"
# COLLECTION_NAME = "market_watch"

# client = MongoClient(MONGO_URI)
# db = client[DB_NAME]
# collection = db[COLLECTION_NAME]

# # ================== Scraper Setup ==================
# options = webdriver.ChromeOptions()
# # options.add_argument("--headless")  # run without UI if needed
# driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# url = "https://dps.psx.com.pk/"
# driver.get(url)

# wait = WebDriverWait(driver, 20)

# # ✅ Step 1: Handle disclaimer popup
# try:
#     close_btn = wait.until(
#         EC.element_to_be_clickable((By.CSS_SELECTOR, "button.tingle-modal__close"))
#     )
#     close_btn.click()
#     print("✅ Disclaimer popup closed")
#     time.sleep(1)
# except Exception:
#     print("⚠️ No disclaimer popup appeared")

# # ✅ Step 2: Wait until dropdown is visible
# dropdown = wait.until(
#     EC.presence_of_element_located((By.NAME, "DataTables_Table_0_length"))
# )

# # ✅ Step 3: Select "All" by value (-1)
# select = Select(dropdown)
# select.select_by_value("-1")

# time.sleep(5)  # allow reload

# # ✅ Step 4: Scrape table rows
# rows = driver.find_elements(By.CSS_SELECTOR, "table#DataTables_Table_0 tbody tr")
# data = []
# for row in rows:
#     cols = [col.text for col in row.find_elements(By.TAG_NAME, "td")]
#     if cols:
#         data.append(cols)

# driver.quit()

# # ✅ Step 5: Save to DataFrame
# headers = ["SYMBOL", "LDCP", "OPEN", "HIGH", "LOW", "CURRENT", "CHANGE", "CHANGE (%)", "VOLUME"]
# df = pd.DataFrame(data, columns=headers)

# # ================== MongoDB Sync ==================
# latest_symbols = set(df["SYMBOL"].tolist())

# # 1. Insert/Update records
# for _, row in df.iterrows():
#     record = row.to_dict()
#     collection.update_one(
#         {"SYMBOL": record["SYMBOL"]},   # match by SYMBOL
#         {"$set": record},               # update fields
#         upsert=True                     # insert if not exists
#     )

# # 2. Delete records that disappeared in latest fetch
# existing_symbols = set(doc["SYMBOL"] for doc in collection.find({}, {"SYMBOL": 1}))
# to_delete = existing_symbols - latest_symbols
# if to_delete:
#     collection.delete_many({"SYMBOL": {"$in": list(to_delete)}})

# # 3. Also save CSV (optional)
# df.to_csv("psx_market_watch_all.csv", index=False, encoding="utf-8-sig")

# print(f"✅ Scraped {len(df)} rows.")
# print(f"✅ Inserted/Updated into MongoDB: {len(df)}")
# if to_delete:
#     print(f"🗑️ Deleted {len(to_delete)} outdated records: {to_delete}")
# else:
#     print("✅ No outdated records found")
