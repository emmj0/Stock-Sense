"""
Render Deployment Tips & Optimization Guide

This file documents important considerations for running your scrapers on Render.
"""

# ============================================================================
# 1. CHROME OPTIONS FOR HEADLESS SERVERS (Already in your code)
# ============================================================================

"""
For Render, make sure your Chrome options include:

options = webdriver.ChromeOptions()
options.add_argument("--start-maximized")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option('useAutomationExtension', False)
options.add_argument("--no-sandbox")              # ← Important for Linux
options.add_argument("--disable-dev-shm-usage")   # ← Important for Render
options.add_argument("--disable-gpu")             # ← Disable GPU
options.add_argument("--headless")                # ← Run without UI
"""

# ============================================================================
# 2. MONGODB CONNECTION RETRY LOGIC
# ============================================================================

"""
Add retry logic for MongoDB connections since Render may have network issues:

from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
import time

def get_mongo_client(max_retries=3):
    for attempt in range(max_retries):
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # Test connection
            client.server_info()
            print("✅ MongoDB connected")
            return client
        except ServerSelectionTimeoutError as e:
            print(f"⚠️ Connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                raise

client = get_mongo_client()
"""

# ============================================================================
# 3. ENVIRONMENT VARIABLES
# ============================================================================

"""
Always load from environment, not hardcoded values:

import os
from dotenv import load_dotenv

load_dotenv()  # Load from .env file locally

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "psx")
WAIT_TIME = int(os.getenv("WAIT_TIME", "30"))

# This way:
# - Locally: reads from .env file
# - On Render: reads from Environment variables
"""

# ============================================================================
# 4. LOGGING INSTEAD OF PRINT
# ============================================================================

"""
Use logging for better debugging on Render:

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Instead of: print("Found data")
# Use:        logger.info("Found data")

# In Render logs you'll see:
# 2025-01-15 10:30:45,123 - INFO - Found data
"""

# ============================================================================
# 5. ERROR HANDLING FOR SELENIUM TIMEOUTS
# ============================================================================

"""
Render servers may have slower connections. Handle timeouts gracefully:

from selenium.common.exceptions import TimeoutException
import time

try:
    element = wait.until(EC.presence_of_element_located((By.ID, "some_id")))
except TimeoutException:
    logger.warning("Element not found, retrying...")
    driver.refresh()
    time.sleep(2)
    element = wait.until(EC.presence_of_element_located((By.ID, "some_id")))
"""

# ============================================================================
# 6. PROPER RESOURCE CLEANUP
# ============================================================================

"""
Always close browser and database connections:

try:
    # ... scraping code ...
    logger.info("Scraping completed")
finally:
    driver.quit()  # Close browser
    client.close()  # Close MongoDB connection
"""

# ============================================================================
# 7. TIMEOUT SETTINGS FOR RENDER
# ============================================================================

"""
Recommended timeouts for Render (adjust based on your needs):

WAIT_TIME = 30  # WebDriver wait timeout (seconds)
SCRIPT_TIMEOUT = 600  # Total script timeout (10 minutes)

# Render's free tier can run scripts up to ~30 minutes
# Starter tier is unlimited
"""

# ============================================================================
# 8. SCHEDULING NOTES
# ============================================================================

"""
The scheduler.py runs your scrapers at:

- Every 30 minutes (continuous updates)
- 10:00 AM PKT (Market open)
- 12:00 PM PKT (Mid-day)
- 3:00 PM PKT (Market close)

To change these times, edit scheduler.py:

    schedule.every().day.at("14:00").do(run_all_scrapers)  # Custom time
    schedule.every(60).minutes.do(run_all_scrapers)        # Every hour

Note: Times should be in UTC if Render is in UTC
"""

# ============================================================================
# 9. CHECKING SCRAPER OUTPUT IN RENDER
# ============================================================================

"""
To verify your scraper is working:

1. Open Render Dashboard
2. Select your Web Service
3. Click "Logs" tab
4. Look for messages like:
   
   ✅ [timestamp] Index.py completed successfully
   ✅ [timestamp] sector.py completed successfully
   ✅ [timestamp] ChromeScrapper.py completed successfully

If there are errors:
   ❌ [timestamp] sector.py failed with return code 1
   
   This means the script had an error. See the stderr output below.
"""

# ============================================================================
# 10. MONGODB DATA VERIFICATION
# ============================================================================

"""
To verify data is being saved to MongoDB:

Option 1: Using MongoDB Compass
- Download from https://www.mongodb.com/products/compass
- Connect with your MONGO_URI
- Browse to: psx > index/sector/market_watch collections
- Should see documents with recent timestamps

Option 2: Using MongoDB Atlas Web UI
- Go to https://www.mongodb.com/cloud/atlas
- Click "Browse Collections"
- Check psx database
- Verify documents have latest data

Documents should have fields like:
{
    "_id": ObjectId("..."),
    "index": "KSE100",
    "current": "12345.67",
    "change": "123.45",
    "percent_change": "+1.02%",
    "timestamp": ISODate("2025-01-15T10:30:00.000Z")
}
"""

# ============================================================================
# 11. MONITORING TIPS
# ============================================================================

"""
Free Render tier considerations:
- Spins down after 15 min of inactivity (scheduler will wake it up)
- Limited to 750 hours/month
- One concurrent request

For continuous scraping, upgrade to Starter ($7/month):
- Stays on 24/7
- Better for scheduled tasks
- Better for handling errors

Monitor these metrics:
- CPU usage (should be low between scrapes)
- Memory usage (browsers use memory)
- Execution time (each script should complete within 10 min)
"""

# ============================================================================
# 12. COMMON ISSUES & SOLUTIONS
# ============================================================================

"""
Issue: "Chrome/Chromium not found"
Solution: Already installed on Render, check paths in your code

Issue: "MongoDB connection timeout"
Solution: 
  - Verify MONGO_URI is correct
  - Check MongoDB firewall allows 0.0.0.0/0
  - Test connection string locally first

Issue: "Element not found"
Solution: Increase WAIT_TIME or add retry logic

Issue: "Out of memory"
Solution: 
  - Close browser properly (driver.quit())
  - Don't store large data in memory
  - Consider splitting large scrapes

Issue: "Script takes too long"
Solution:
  - Profile your code locally
  - Optimize wait times
  - Split into smaller jobs
"""

# ============================================================================
# 13. DEPLOYMENT WORKFLOW
# ============================================================================

"""
1. Test locally:
   python scheduler.py

2. Push to GitHub:
   git push origin master

3. Render automatically picks up changes

4. View logs:
   Render Dashboard > Logs

5. Verify data in MongoDB:
   MongoDB Atlas > Browse Collections

6. If errors occur:
   - Check Render logs
   - Fix issues locally
   - Push again
"""

print(__doc__)
