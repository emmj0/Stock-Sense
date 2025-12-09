import time
import datetime
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, JavascriptException
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# ======================================
# CONFIG
# ======================================
PSX_URL = "https://dps.psx.com.pk/sector-summary"
WAIT_TIME = 30

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "psx")
SECTOR_COLLECTION_NAME = "sector"

# ======================================
# MONGO CONNECT
# ======================================
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sector_collection = db[SECTOR_COLLECTION_NAME]

# ======================================
# SELENIUM SETUP
# ======================================
options = webdriver.ChromeOptions()
options.add_argument("--start-maximized")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option('useAutomationExtension', False)
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, WAIT_TIME)


def close_popup_if_present():
    """Close disclaimer popup if it appears"""
    try:
        btn = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.tingle-modal__close"))
        )
        btn.click()
        print("Disclaimer popup closed")
        time.sleep(1)
    except TimeoutException:
        print("No popup found")


def read_sector_summaries():
    """Read all sectors from the main summary table"""
    print("\nReading sector summary table...")
    
    summary_table = wait.until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "table.tbl"))
    )
    
    summaries = []
    rows = summary_table.find_elements(By.CSS_SELECTOR, "tbody tr")
    
    for row in rows:
        cells = row.find_elements(By.TAG_NAME, "td")
        if len(cells) < 7:
            continue

        sector_code = cells[0].text.strip()

        summaries.append({
            "code": sector_code,
            "name": cells[1].text.strip(),
            "advance": cells[2].text.strip(),
            "decline": cells[3].text.strip(),
            "unchange": cells[4].text.strip(),
            "turnover": cells[5].text.strip(),
            "market_cap": cells[6].text.strip(),
        })

    print(f"Found {len(summaries)} sectors")
    return summaries


def click_sector(sector_code):
    """Click on a sector to load its companies"""
    print(f"   Clicking on sector: {sector_code}")
    
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.5)
    
    try:
        summary_table = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.tbl"))
        )
        link = summary_table.find_element(By.CSS_SELECTOR, f"a[data-code='{sector_code}']")
        
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
        time.sleep(0.3)
        driver.execute_script("arguments[0].click();", link)
        print(f"   Clicked {sector_code}")
    except NoSuchElementException:
        print(f"   Link not found for {sector_code}")
        return False
    
    # Wait for companies section to appear
    try:
        wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, f"div.sectorSummary__companies__table[data-code='{sector_code}']"))
        )
        print(f"   Companies section loaded for {sector_code}")
        time.sleep(3)
        return True
    except TimeoutException:
        print(f"   Companies section failed to load for {sector_code}")
        return False


def click_back_button():
    """Return to sector summary"""
    try:
        print("   Going back to sector summary...")
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(1)
        
        back_btn = wait.until(
            EC.element_to_be_clickable((By.ID, "backButton"))
        )
        driver.execute_script("arguments[0].click();", back_btn)
        
        # Wait for summary table to reappear
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table.tbl")))
        print("   Back to sector summary")
        time.sleep(2)
        return True
    except Exception as e:
        print(f"   Failed to go back: {e}")
        return False


def scrape_companies():
    """Scrape ALL companies by disabling DataTables pagination"""
    print("   Scraping ALL companies (bypassing pagination)...")

    # Critical: Force DataTable to show ALL rows
    script = """
    if (typeof $ !== 'undefined' && $.fn.DataTable) {
        var table = $('div.sectorSummary__companies__table table.tbl').DataTable();
        if (table) {
            table.page.len(-1).draw();
            return true;
        }
    }
    return false;
    """
    try:
        result = driver.execute_script(script)
        if result:
            print("   Successfully forced 'Show All' rows")
        else:
            print("   DataTable not ready yet, retrying...")
            time.sleep(3)
            driver.execute_script(script)  # retry once
        time.sleep(4)  # Allow redraw
    except JavascriptException as e:
        print(f"   JS error while forcing all rows: {e}")

    # Now scrape ALL visible rows
    try:
        rows = driver.find_elements(By.CSS_SELECTOR, "div.sectorSummary__companies__table table.tbl tbody tr")
        print(f"   Total rows in DOM: {len(rows)}")

        companies = []
        for i, row in enumerate(rows):
            try:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) < 10:
                    continue

                symbol_elem = cells[0].find_element(By.TAG_NAME, "a")
                symbol = symbol_elem.text.strip()

                # Skip empty rows
                if not symbol:
                    continue

                company = {
                    "SYMBOL": symbol,
                    "NAME": cells[1].text.strip(),
                    "LDCP": cells[2].text.strip(),
                    "OPEN": cells[3].text.strip(),
                    "HIGH": cells[4].text.strip(),
                    "LOW": cells[5].text.strip(),
                    "CURRENT": cells[6].text.strip(),
                    "CHANGE": cells[7].text.strip(),
                    "CHANGE (%)": cells[8].text.strip(),
                    "VOLUME": cells[9].text.strip(),
                }
                companies.append(company)
            except Exception as e:
                print(f"   Error parsing row {i}: {e}")
                continue

        print(f"   Successfully scraped {len(companies)} companies")
        return companies

    except Exception as e:
        print(f"   Failed to scrape companies: {e}")
        return []


# ======================================
# MAIN FLOW
# ======================================
def main():
    print("\n" + "="*70)
    print("        PSX SECTOR SCRAPER (FULL DATA - ALL COMPANIES)")
    print("="*70)
    
    driver.get(PSX_URL)
    close_popup_if_present()

    try:
        sector_summaries = read_sector_summaries()
        total = len(sector_summaries)

        for idx, summary in enumerate(sector_summaries, 1):
            code = summary["code"]
            name = summary["name"]

            print(f"\n{'='*70}")
            print(f"[{idx}/{total}] Processing: {code} - {name}")
            print(f"{'='*70}")

            if not click_sector(code):
                print(f"   Skipping {code} - could not load companies")
                doc = {**summary, "companies": [], "scraped_at": datetime.datetime.utcnow(), "has_companies": False}
                sector_collection.update_one({"code": code}, {"$set": doc}, upsert=True)
                continue

            companies = scrape_companies()

            # Save to MongoDB
            doc = {
                **summary,
                "companies": companies,
                "scraped_at": datetime.datetime.utcnow(),
                "has_companies": len(companies) > 0
            }
            sector_collection.update_one({"code": code}, {"$set": doc}, upsert=True)
            print(f"   Saved {code} → {len(companies)} companies")

            # Go back
            if idx < total:  # No need to go back after last sector
                if not click_back_button():
                    print("   Warning: Failed to return, continuing anyway...")
                    time.sleep(3)

        print("\n" + "="*70)
        print("SCRAPING COMPLETED SUCCESSFULLY!")
        print(f"All {total} sectors processed with full company data.")
        print("="*70)

    except KeyboardInterrupt:
        print("\n\nStopped by user")
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nClosing browser...")
        driver.quit()
        print("Done!")


if __name__ == "__main__":
    main()