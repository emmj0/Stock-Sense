# PSX Scraper Deployment Guide - Render (Cron Jobs)

This guide explains how to deploy your PSX scraper as a **Render Cron Job** that runs every **3 hours**.

## Why Cron Jobs?

- ✅ **Saves costs** - Only runs when scheduled, no idle time
- ✅ **Efficient** - Perfect for periodic data collection
- ✅ **Simple** - No need for background schedulers
- ✅ **Reliable** - Render manages timing and retries

## Prerequisites

1. **Render Account** - Sign up at https://render.com
2. **GitHub Repository** - Your code must be pushed to GitHub
3. **MongoDB Atlas** - MongoDB hosting (or other MongoDB instance)

## Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Add scraper deployment files"
git push origin master
```

## Step 2: Create a Cron Job Service on Render

### Using render.yaml (Recommended)

The `render.yaml` file is already configured for cron jobs. Just follow these steps:

1. Go to https://dashboard.render.com/
2. Click **"New +" → "Cron Job"**
3. Select **"Deploy an existing service from a repository"**
4. Connect your GitHub repository
5. Render will automatically read `render.yaml` and configure the cron service

### Manual Configuration

If you don't use render.yaml:

1. Go to https://dashboard.render.com/
2. Click **"New +" → "Cron Job"**
3. Select your GitHub repository
4. Configure:
   - **Name**: `psx-scraper-job`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python run_all_scrapers.py`
   - **Schedule**: `0 */3 * * *` (Every 3 hours)
   - **Plan**: Free tier is fine

### Understanding the Schedule

The schedule `0 */3 * * *` means:
- Run at **0 minutes**
- Every **3 hours** (0, 3, 6, 9, 12, 15, 18, 21 o'clock)
- Every day of month
- Every month
- Every day of week

**Other schedule examples:**
```
0 */2 * * *      # Every 2 hours
0 */4 * * *      # Every 4 hours
0 0 * * *        # Once daily at midnight
0 10 * * *       # Once daily at 10 AM
0 */6 * * *      # Every 6 hours
```

See [Cron Syntax Guide](https://crontab.guru/) for more options.

## Step 3: Set Environment Variables

In Render Dashboard:

1. Go to your Web Service
2. Click **"Environment"** tab
3. Add these variables:
   ```
   MONGO_URI = mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   DB_NAME = psx
   PYTHONUNBUFFERED = 1
   ```

   **Where to get MONGO_URI:**
   - Go to MongoDB Atlas (https://www.mongodb.com/cloud/atlas)
   - Create a cluster if you don't have one
   - Click "Connect"
   - Select "Connect your application"
   - Copy the connection string
   - Replace `<password>` and `<username>` with your credentials

## Step 4: How the Scraper Runs

The cron job uses `run_all_scrapers.py` which:

1. **Runs every 3 hours automatically** - No need to keep a service running
2. **Runs all 3 scrapers in sequence:**
   - `Index.py` - Scrapes market indices
   - `sector.py` - Scrapes sector data
   - `ChromeScrapper.py` - Scrapes market watch data

3. **Execution timeline (every 3 hours):**
   - 00:00 (Midnight)
   - 03:00 (3 AM)
   - 06:00 (6 AM)
   - 09:00 (9 AM)
   - 12:00 (Noon)
   - 15:00 (3 PM - Market close)
   - 18:00 (6 PM)
   - 21:00 (9 PM)

4. **Logs:**
   - All output is logged and visible in Render Dashboard
   - Shows success/failure for each script

## Step 5: Monitor Scraper Performance

1. Go to your Web Service on Render
2. Click **"Logs"** tab to see:
   - Scraper execution status
   - Any errors or issues
   - MongoDB connection status
   - Timestamps of each run

## Important Notes

### Chrome Browser in Render

Render's servers are headless Linux machines. Your scrapers will work but:

- **Headless mode** is recommended (already configured in your code with Chrome options)
- Chrome/Chromium is pre-installed on Render
- The scrapers will run without a GUI

### Optimizing for Render

1. **Increase timeouts** - Internet speeds on Render may vary:
   ```python
   WAIT_TIME = 30  # Already set in your code
   ```

2. **Handle connection failures gracefully**:
   ```python
   try:
       # your scraping code
   except Exception as e:
       logger.error(f"Error: {str(e)}")
       # retry logic
   ```

3. **Keep requests efficient**:
   - Don't scrape more than necessary
   - Use time delays to avoid rate limiting
   - Close browser sessions properly

### Render Limitations

- **Cron jobs run for max ~15 minutes** per execution
- Each script has 5-minute timeout (300 seconds)
- Total script time: ~20 minutes for 3 scripts (safe margin)
- Free tier is perfect for this use case

**For comparison:**
- Web Service: Always running, costs money even when idle
- Cron Job: Only runs on schedule, free tier is sufficient

## Troubleshooting

### Scraper not running?
1. Check Logs in Render Dashboard
2. Verify MONGO_URI is correct
3. Check MongoDB firewall allows Render IP

### Connection timeout?
1. Increase `WAIT_TIME` in your scripts
2. Check if the website is accessible
3. Verify network settings

### MongoDB connection failed?
1. Verify MONGO_URI in environment variables
2. Check MongoDB whitelist includes Render's IP (0.0.0.0/0 for testing)
3. Test connection locally first

## Scheduling Alternative: Render Cron Jobs

For more control, you can use **Render Cron Jobs** instead:

1. Create a separate service for each script
2. Set each to run on a schedule (e.g., every 2 hours)
3. Each gets its own logs and monitoring

Example render.yaml for cron:
```yaml
services:
  - type: cron
    name: psx-index-scraper
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: python Index.py
    schedule: "0 */2 * * *"  # Every 2 hours
    envVars:
      - key: MONGO_URI
      - key: DB_NAME
        value: psx
```

## Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] render.yaml file in Scrapper folder
- [ ] requirements.txt updated with all dependencies
- [ ] scheduler.py created
- [ ] MongoDB Atlas cluster created
- [ ] MONGO_URI environment variable set
- [ ] Web Service created on Render
- [ ] Logs showing successful scrapes
- [ ] Data appearing in MongoDB

## File Structure

```
Scrapper/
├── Index.py                  # Index scraper
├── sector.py                 # Sector scraper
├── ChromeScrapper.py         # Market watch scraper
├── run_all_scrapers.py       # ← NEW: Runs all 3 scrapers
├── requirements.txt          # Dependencies
├── render.yaml               # Render cron config
├── Procfile                  # Alternative config
├── DEPLOYMENT_GUIDE.md       # This file
├── QUICKSTART.md             # Quick setup guide
├── RENDER_OPTIMIZATION.md    # Optimization tips
├── .env                      # Local only (not deployed)
└── psx_market_watch_all.csv
```

## Next Steps

1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Add cron job deployment files"
   git push origin master
   ```

2. Create Cron Job on Render (see Step 2 above)

3. Set environment variables (see Step 3 above)

4. Monitor logs to ensure scrapers run successfully

5. Check MongoDB to verify data collection

For more help, visit: https://render.com/docs/cron-jobs
