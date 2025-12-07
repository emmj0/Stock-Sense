import time
import datetime
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from pymongo import MongoClient

# ================== MongoDB Setup ==================
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "psx_db"
DATA_COLLECTION = "historical_data"
DATES_COLLECTION = "scraped_dates"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[DATA_COLLECTION]
dates_collection = db[DATES_COLLECTION]

# ================== Scraper Setup ==================
options = webdriver.ChromeOptions()
# options.add_argument("--headless")  # uncomment to run without UI
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

url = "https://dps.psx.com.pk/historical"
driver.get(url)
wait = WebDriverWait(driver, 20)

# ✅ Handle disclaimer popup
try:
    close_btn = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "button.tingle-modal__close"))
    )
    close_btn.click()
    print("✅ Disclaimer popup closed")
    time.sleep(1)
except Exception:
    print("⚠️ No disclaimer popup appeared")

# ================== Date Loop ==================
START_DATE = datetime.date(2020, 8, 26)   # earliest possible
END_DATE = datetime.date(2025, 12, 5)    # fixed end date

current_date = START_DATE
first_valid_date = None  # will store the first selectable date

all_data = []  # 👈 store everything here

while current_date <= END_DATE:
    date_str = current_date.strftime("%Y-%m-%d")

    # ⏩ Skip if already scraped
    if dates_collection.find_one({"DATE": date_str}):
        print(f"⏭️ Already scraped {date_str}, skipping...")
        current_date += datetime.timedelta(days=1)
        continue

    print(f"📅 Trying {date_str} ...")

    try:
        # ✅ Step 1: Enter date
        date_box = wait.until(EC.presence_of_element_located((By.ID, "historicalDatePicker")))
        date_box.clear()
        date_box.send_keys(date_str)

        # ✅ Step 2: Click search
        search_btn = wait.until(EC.element_to_be_clickable((By.ID, "historicalSearchBtn")))
        driver.execute_script("arguments[0].click();", search_btn)
        time.sleep(3)

        # ✅ Step 3: Set rows per page = 100 (if available)
        try:
            dropdown = wait.until(EC.presence_of_element_located((By.NAME, "historicalTable_length")))
            Select(dropdown).select_by_value("100")
            time.sleep(2)
        except Exception:
            print(f"⚠️ No table for {date_str}, moving to next date...")
            current_date += datetime.timedelta(days=1)
            continue

        # ✅ If this is the first valid date → set as effective start
        if first_valid_date is None:
            first_valid_date = current_date
            print(f"🎯 Found first valid date: {first_valid_date}")

        # ✅ Step 4: Scrape all pages
        data = []
        while True:
            rows = driver.find_elements(By.CSS_SELECTOR, "table#historicalTable tbody tr")
            for row in rows:
                cols = [col.text for col in row.find_elements(By.TAG_NAME, "td")]
                if cols:
                    cols.insert(0, date_str)  # add DATE column
                    data.append(cols)

            # Next page
            try:
                next_btn = driver.find_element(By.ID, "historicalTable_next")
                if "disabled" in next_btn.get_attribute("class"):
                    break
                next_btn.click()
                time.sleep(2)
            except Exception:
                break

        # ✅ Step 5: Save results
        if data:
            headers = ["DATE", "SYMBOL", "LDCP", "OPEN", "HIGH", "LOW", "CLOSE", "CHANGE", "CHANGE (%)", "VOLUME"]
            df = pd.DataFrame(data, columns=headers)

            # Add to global dataset
            all_data.extend(df.values.tolist())

            # Save MongoDB
            for _, row in df.iterrows():
                record = row.to_dict()
                collection.update_one(
                    {"DATE": record["DATE"], "SYMBOL": record["SYMBOL"]},
                    {"$set": record},
                    upsert=True
                )

            # ✅ Mark date as completed
            dates_collection.insert_one({"DATE": date_str})

            print(f"✅ Saved {len(df)} rows for {date_str}")
        else:
            print(f"⚠️ No data for {date_str}")

    except Exception as e:
        print(f"❌ Error on {date_str}: {e}")

    # Move to next date automatically
    current_date += datetime.timedelta(days=1)

driver.quit()

# ================== Save ONE CSV for all data ==================
if all_data:
    headers = ["DATE", "SYMBOL", "LDCP", "OPEN", "HIGH", "LOW", "CLOSE", "CHANGE", "CHANGE (%)", "VOLUME"]
    final_df = pd.DataFrame(all_data, columns=headers)
    final_df.to_csv("psx_historical_all.csv", index=False, encoding="utf-8-sig")
    print(f"📂 Final CSV saved with {len(final_df)} rows as psx_historical_all.csv")

if first_valid_date:
    print(f"🎉 Scraping finished. First valid date was {first_valid_date}, completed until {END_DATE}")
else:
    print("❌ No valid date found in the given range.")
