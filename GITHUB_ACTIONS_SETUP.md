# GitHub Actions Setup Guide

## Quick Start

### 1️⃣ Push Your Repository to GitHub

```bash
git init
git add .
git commit -m "Initial commit with scrapers"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## 2️⃣ Add GitHub Secrets

Your MongoDB credentials should NOT be stored in code. Add them as GitHub Secrets:

**Steps:**
1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

| Secret Name | Value |
|------------|-------|
| `MONGO_URI` | `mongodb+srv://practicehours08_db_user:6BbpygkmLhvhsd8I@cluster0.aqwkqsw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0` |
| `DB_NAME` | `psx` |

> ⚠️ **IMPORTANT**: Never commit your `.env` file! Add this to `.gitignore`:
> ```
> .env
> Scrapper/psx_scraper_env/
> __pycache__/
> *.pyc
> ```

---

## 3️⃣ Workflow Configuration

The workflow file: `.github/workflows/daily-scraper.yml`

### Current Schedule
- **Time**: Every day at **2 AM UTC** (7 AM Pakistan Standard Time)
- **Cron**: `0 2 * * *`

### Change Schedule

Edit the cron expression in `.github/workflows/daily-scraper.yml`:

| Schedule | Cron Expression |
|----------|-----------------|
| Every 15 minutes | `*/15 * * * *` |
| Every hour | `0 * * * *` |
| Daily at midnight | `0 0 * * *` |
| Daily at 7 AM PKT | `0 2 * * *` |
| Every weekday at 9 AM PKT | `0 4 * * 1-5` |
| Weekly (Sunday 8 AM PKT) | `0 3 * * 0` |

---

## 4️⃣ Monitor Your Workflows

1. Go to your GitHub repo → **Actions**
2. Click on **Daily PSX Web Scrapers**
3. View logs for each run
4. Check ✅ for success or ❌ for failures

---

## 5️⃣ Troubleshooting

### ❌ Workflow Fails
- Check the **Logs** section for error messages
- Common issues:
  - MongoDB connection failed → Verify `MONGO_URI` secret
  - Chrome not found → Workflow installs it automatically
  - Selenium timeout → Website might be down

### ✅ Manual Trigger
To test the workflow manually:
1. Go to **Actions** → **Daily PSX Web Scrapers**
2. Click **Run workflow** → **Run workflow**

### 📊 Monitor Execution Time
- Each scraper takes ~5-10 minutes
- Total runtime: ~20-30 minutes
- Free tier limit: 2,000 minutes/month (more than enough)

---

## 6️⃣ Optional: Email Notifications

Add this step to get email alerts on failure:

```yaml
- name: Send Email on Failure
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: your-email@gmail.com
    password: ${{ secrets.EMAIL_PASSWORD }}
    to: your-email@gmail.com
    subject: PSX Scraper Failed
    body: 'Check GitHub Actions: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}'
```

Then add `EMAIL_PASSWORD` as a GitHub Secret.

---

## 7️⃣ Pricing

**GitHub Actions is FREE** for public repositories!

- ✅ Unlimited public repo workflows
- ✅ 2,000 minutes/month for private repos (free tier)
- 📊 Your scrapers use ~20 min/day = ~600 min/month ✓

---

## 📝 Files Created

```
.github/workflows/
├── daily-scraper.yml          ← Main workflow file
```

---

## 🚀 Next Steps

1. ✅ Commit and push `.github/workflows/daily-scraper.yml` to GitHub
2. ✅ Add MongoDB secrets in GitHub Settings
3. ✅ Go to Actions tab and verify workflow runs
4. ✅ Check your MongoDB for new data after first run

---

## 🔗 Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cron Syntax Reference](https://crontab.guru/)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
