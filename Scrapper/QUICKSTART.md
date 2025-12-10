# Quick Start: Deploy PSX Scraper on Render (Cron Job)

## 5-Minute Setup - Runs Every 3 Hours

### 1. Update Your GitHub Repo
```bash
cd d:\Final Year Project\Scrapper
git add .
git commit -m "Add Render cron job deployment files"
git push origin master
```

### 2. Create Render Cron Job
1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Cron Job"**
3. Select your GitHub repo
4. Configure:
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python run_all_scrapers.py`
   - **Schedule:** `0 */3 * * *` (Every 3 hours)
5. Click **"Create Cron Job"**

### 3. Add MongoDB Connection
1. In Render Dashboard, go to your cron job
2. Click **"Environment"** tab
3. Add variable:
   ```
   MONGO_URI = your_mongodb_atlas_uri_here
   ```
   
   **Get MongoDB URI:**
   - Go to MongoDB Atlas (https://www.mongodb.com/cloud/atlas)
   - Create free cluster if needed
   - Click "Connect" → "Connect your application"
   - Copy the connection string

4. Click **"Save Changes"**

### 4. Done! 🎉
Your scraper will:
- ✅ Run automatically every 3 hours
- ✅ Scrape Index.py, sector.py, and ChromeScrapper.py
- ✅ Update MongoDB with the latest data
- ✅ Cost nothing (free tier cron jobs)

## View Logs
1. Open your cron job on Render
2. Click **"Events"** or **"Logs"** tab
3. See execution history and output

## Change Schedule
Edit `render.yaml` to change when it runs:

```yaml
schedule: "0 */2 * * *"  # Every 2 hours
schedule: "0 */4 * * *"  # Every 4 hours
schedule: "0 0 * * *"    # Once daily at midnight
schedule: "0 */6 * * *"  # Every 6 hours
```

Then push to GitHub:
```bash
git add render.yaml
git commit -m "Change cron schedule"
git push origin master
```

Render will automatically redeploy.

## Files Added/Modified
- `run_all_scrapers.py` - Entry point for cron job (NEW)
- `render.yaml` - Cron job config (UPDATED)
- `Procfile` - Deployment config (UPDATED)
- `DEPLOYMENT_GUIDE.md` - Detailed guide
- `requirements.txt` - No changes needed (already has what we need)

## Troubleshooting

**Cron job not running?**
- Check "Events" tab in Render for errors
- Verify MONGO_URI is correct
- Check MongoDB allows connections from Render

**MongoDB connection error?**
1. Test your MONGO_URI locally first
2. In MongoDB Atlas, go to Network Access
3. Add IP: `0.0.0.0/0` (for testing)

**Need to see logs?**
- Click on the cron job service
- Look at "Events" section
- Each execution shows start/end time and status

## Cost Comparison

| Type | Cost | Best For |
|------|------|----------|
| **Cron Job** | FREE | Periodic scraping (every 3 hours) |
| **Web Service** | $7/month | Continuous/always-on |

**You're saving $7/month with cron jobs! 💰**

---

**Questions?** See DEPLOYMENT_GUIDE.md for detailed documentation.

