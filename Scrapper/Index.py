import time
import datetime
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# ======================================
# CONFIG
# ======================================
PSX_URL = "https://dps.psx.com.pk/indices"
WAIT_TIME = 30

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "psx")
MARKET_COLLECTION_NAME = "index"

# ======================================
# MONGO CONNECT
# ======================================
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
index_collection = db[MARKET_COLLECTION_NAME]

# ======================================
# SELENIUM
# ======================================
options = webdriver.ChromeOptions()
options.add_argument("--start-maximized")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option('useAutomationExtension', False)

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, WAIT_TIME)


def close_popup_if_present():
    """Close disclaimer popup if it appears"""
    try:
        btn = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.tingle-modal__close"))
        )
        btn.click()
        print("✔ Disclaimer popup closed")
        time.sleep(1)
    except TimeoutException:
        print("ℹ No popup found")


def read_index_summaries():
    """Read all indices from the main summary table"""
    print("\n📊 Reading index summary table...")
    
    # Wait for the main table to load
    summary_table = wait.until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "table.tbl"))
    )
    
    summaries = []
    rows = summary_table.find_elements(By.CSS_SELECTOR, "tbody.tbl__body tr")
    
    for row in rows:
        cells = row.find_elements(By.TAG_NAME, "td")
        if len(cells) < 6:
            continue

        # Get index code from link or text
        first_cell = cells[0]
        link_el = first_cell.find_elements(By.TAG_NAME, "a")
        
        if link_el:
            code_attr = link_el[0].get_attribute("data-code") or ""
            idx_code = code_attr.strip() if code_attr else first_cell.text.strip()
        else:
            # For indices without clickable links (like HBLTTI)
            idx_code = first_cell.text.strip().split()[0]

        summaries.append({
            "index": idx_code,
            "high": cells[1].text.strip(),
            "low": cells[2].text.strip(),
            "current": cells[3].text.strip(),
            "change": cells[4].text.strip(),
            "percent_change": cells[5].text.strip(),
        })

    print(f"🔹 Found {len(summaries)} indices in summary table")
    return summaries


def click_index(index_code):
    """Click on an index to load its constituents"""
    print(f"   🖱️ Clicking on index: {index_code}")
    
    # Scroll to top of page
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.5)
    
    # Find the summary table
    try:
        summary_table = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.tbl"))
        )
    except TimeoutException:
        print("   ⚠️ Summary table not found")
        return False
    
    # Find the link for this index
    link = None
    try:
        # Try by data-code
        link = summary_table.find_element(By.CSS_SELECTOR, f"a[data-code='{index_code}']")
    except NoSuchElementException:
        try:
            # Try by bold text
            link = summary_table.find_element(By.XPATH, f".//a[b[text()='{index_code}']]")
        except NoSuchElementException:
            print(f"   ⚠️ Link for {index_code} not found")
            return False
    
    if not link:
        return False
    
    # Click the link
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
        time.sleep(0.3)
        driver.execute_script("arguments[0].click();", link)
        print(f"   ✔ Clicked on {index_code}")
    except Exception as e:
        print(f"   ⚠️ Failed to click: {e}")
        return False
    
    # Wait for page to react to click
    time.sleep(2)
    
    # Check if constituents section appeared
    try:
        constituents_section = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#indexConstituentsTable"))
        )
        print("   ✔ Constituents section appeared")
    except TimeoutException:
        print("   ⚠️ Constituents section did not appear")
        return False
    
    # Scroll down to the constituents section
    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'start'});", constituents_section)
    time.sleep(1.5)
    
    # Wait for DataTable to be present (it's inside the constituents section)
    try:
        table = constituents_section.find_element(By.CSS_SELECTOR, "table.tbl.dataTable")
        print("   ✔ DataTable is present")
    except NoSuchElementException:
        print("   ⚠️ DataTable not found in constituents section")
        return False
    
    # Wait a bit more for the table to fully initialize
    time.sleep(1)
    
    return True


def set_page_size_to_100():
    """Set the entries dropdown to 100"""
    try:
        print("   ⚙️ Setting page size to 100...")
        
        # Wait a bit for the dropdown to be ready
        time.sleep(1)
        
        # Find the select dropdown - look for any DataTable length selector
        select_element = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "select[name^='DataTables_Table_'][name$='_length']"))
        )
        
        # Scroll to it
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", select_element)
        time.sleep(0.5)
        
        # Select 100
        Select(select_element).select_by_value("100")
        print("   ✔ Selected 100 entries")
        
        # Wait for table to reload
        time.sleep(3)
        
        # Wait for any loading indicator to disappear
        try:
            WebDriverWait(driver, 5).until(
                EC.invisibility_of_element_located((By.CSS_SELECTOR, "div[id$='_processing']"))
            )
        except TimeoutException:
            pass
        
        # Wait for rows to be present
        time.sleep(2)
        
        return True
        
    except Exception as e:
        print(f"   ⚠️ Could not set page size: {e}")
        return False


def scrape_constituents():
    """Scrape all constituent data from the table"""
    print("   📊 Scraping constituent data...")
    
    # Wait for table body to be present - look for any table inside constituents section
    try:
        tbody = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#indexConstituentsTable table.tbl tbody"))
        )
    except TimeoutException:
        print("   ⚠️ Table body not found")
        return []
    
    # Get all rows
    rows = tbody.find_elements(By.TAG_NAME, "tr")
    
    if not rows:
        print("   ⚠️ No rows found in table")
        return []
    
    constituents = []
    
    for row in rows:
        try:
            cells = row.find_elements(By.TAG_NAME, "td")
            
            # Skip if not enough cells
            if len(cells) < 11:
                continue
            
            # Extract symbol from first cell
            symbol_text = cells[0].text.strip()
            
            constituent = {
                "SYMBOL": symbol_text,
                "NAME": cells[1].text.strip(),
                "LDCP": cells[2].text.strip(),
                "CURRENT": cells[3].text.strip(),
                "CHANGE": cells[4].text.strip(),
                "CHANGE (%)": cells[5].text.strip(),
                "IDX WTG (%)": cells[6].text.strip(),
                "IDX POINT": cells[7].text.strip(),
                "VOLUME": cells[8].text.strip(),
                "FREEFLOAT (M)": cells[9].text.strip(),
                "MARKET CAP (M)": cells[10].text.strip(),
            }
            
            constituents.append(constituent)
            
        except Exception as e:
            print(f"   ⚠️ Error parsing row: {e}")
            continue
    
    print(f"   ✅ Scraped {len(constituents)} constituents")
    return constituents


# ======================================
# MAIN FLOW
# ======================================
def main():
    print("\n" + "="*60)
    print("🌎 PSX INDICES SCRAPER")
    print("="*60)
    
    print(f"\n📍 Opening {PSX_URL}...")
    driver.get(PSX_URL)
    
    # Close popup if present
    close_popup_if_present()
    
    try:
        # Read all index summaries
        index_summaries = read_index_summaries()
        
        total_indices = len(index_summaries)
        processed = 0
        skipped = 0
        
        # Process each index
        for idx, summary in enumerate(index_summaries, 1):
            index_code = summary["index"]
            
            print(f"\n{'='*60}")
            print(f"🔁 [{idx}/{total_indices}] Processing: {index_code}")
            print(f"{'='*60}")
            
            # Click on the index
            if not click_index(index_code):
                print(f"   ⏭️ Skipping {index_code}")
                skipped += 1
                
                # Save summary only
                doc = {
                    **summary,
                    "constituents": [],
                    "scraped_at": datetime.datetime.utcnow(),
                    "has_constituents": False
                }
                index_collection.update_one(
                    {"index": index_code}, 
                    {"$set": doc}, 
                    upsert=True
                )
                continue
            
            # Set page size to 100
            set_page_size_to_100()
            
            # Scrape constituents
            constituents = scrape_constituents()
            
            # Save to MongoDB
            doc = {
                **summary,
                "constituents": constituents,
                "scraped_at": datetime.datetime.utcnow(),
                "has_constituents": len(constituents) > 0
            }
            
            index_collection.update_one(
                {"index": index_code}, 
                {"$set": doc}, 
                upsert=True
            )
            
            processed += 1
            print(f"   💾 Saved {index_code} with {len(constituents)} constituents")
        
        print("\n" + "="*60)
        print("🎉 SCRAPING COMPLETED!")
        print("="*60)
        print(f"✅ Processed: {processed}")
        print(f"⏭️ Skipped: {skipped}")
        print(f"📊 Total: {total_indices}")
        print("="*60)
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n🔒 Closing browser...")
        driver.quit()
        print("✔ Browser closed")


if __name__ == "__main__":
    main()