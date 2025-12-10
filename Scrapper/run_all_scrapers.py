"""
PSX Scraper - Run All Scripts
This script runs all three scrapers in sequence for Render Cron Jobs
"""

import subprocess
import logging
import os
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_script(script_name):
    """Run a Python script and return success status"""
    try:
        logger.info(f"🚀 Starting {script_name}...")
        result = subprocess.run(
            [sys.executable, script_name],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout per script
        )
        
        if result.returncode == 0:
            logger.info(f"✅ {script_name} completed successfully")
            if result.stdout:
                logger.info(f"Output:\n{result.stdout}")
            return True
        else:
            logger.error(f"❌ {script_name} failed with return code {result.returncode}")
            if result.stderr:
                logger.error(f"Error:\n{result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error(f"⏱️ {script_name} timed out after 5 minutes")
        return False
    except Exception as e:
        logger.error(f"💥 Exception running {script_name}: {str(e)}")
        return False


def main():
    """Main entry point for cron job"""
    logger.info("=" * 70)
    logger.info(f"🔄 PSX Scraper Cron Job Started - {datetime.now()}")
    logger.info("=" * 70)
    
    success_count = 0
    failed_scripts = []
    
    # Run scrapers in sequence
    scripts = ["Index.py", "sector.py", "ChromeScrapper.py"]
    
    for script in scripts:
        if run_script(script):
            success_count += 1
        else:
            failed_scripts.append(script)
        
        # Small delay between scripts
        import time
        time.sleep(2)
    
    # Final summary
    logger.info("=" * 70)
    logger.info(f"📊 Execution Summary")
    logger.info(f"   Total: {len(scripts)} | Success: {success_count} | Failed: {len(failed_scripts)}")
    
    if failed_scripts:
        logger.warning(f"   Failed scripts: {', '.join(failed_scripts)}")
    else:
        logger.info("   ✨ All scrapers completed successfully!")
    
    logger.info(f"   Next run: in 3 hours")
    logger.info("=" * 70)
    
    # Return exit code based on success/failure
    return 0 if len(failed_scripts) == 0 else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
