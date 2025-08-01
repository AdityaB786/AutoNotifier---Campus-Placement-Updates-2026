# 📢 JIIT Superset Placement Notifier

An automated bot that scrapes job openings from [Superset](https://joinsuperset.com) using **Playwright**, detects new job postings, and sends real-time updates to a **Telegram channel** via **n8n webhooks**. This smart, low-code AI agent keeps JIIT students instantly informed about placement opportunities.

---

## 🚀 Features

* ✅ Automated login and navigation on Superset
* 📄 Scrapes latest job details (Company, Role, CTC, Location, Eligibility, etc.)
* 🧠 Detects new job posts intelligently to avoid duplicates
* 🟢 Pushes job data to Google Sheets for record-keeping
* 📡 Triggers **n8n workflow** via webhook for instant Telegram alerts
* ⏰ Runs every 10 minutes using `cron`

---

## 🔧 Tech Stack

* **Playwright** – for browser automation & scraping
* **Node.js** – backend runtime
* **Google Sheets API** – to log job data
* **n8n** – low-code workflow automation
* **Telegram Bot** – for job notifications
* **Cron** – to schedule scraping script

---

## 🗂 Folder Structure

```
jiit_placement_updates/
├── superset_scraper.js         # Main automation script
├── .env                        # Secrets and credentials
├── log.txt                     # Cron job logs
```

---

## 📌 How It Works

1. Logs into Superset using credentials from `.env`
2. Goes to the "All Jobs" section and scrapes the latest post
3. Checks if the job already exists in the Google Sheet
4. If it's a new job:

   * Appends it to Google Sheets
   * Sends job data to n8n via webhook
   * n8n formats and forwards it to Telegram

---

## 🧪 Local Testing

```bash
node superset_scraper.js
```

---

## 🕒 Setup Cron Job (Mac/Linux)

To run the bot every 10 minutes:

```bash
crontab -e
```

Add the following line:

```
*/10 * * * * /Users/adityabhatia/.nvm/versions/node/v20.18.3/bin/node /Users/adityabhatia/Desktop/coding/jiit_placement_updates/superset_scraper.js >> /Users/adityabhatia/Desktop/coding/jiit_placement_updates/log.txt 2>&1
```

---

## 🔐 Environment Variables (`.env`)

```env
EMAIL=your_superset_email
PASSWORD=your_superset_password
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="your_private_key_with_proper_newlines"
CURRJOB_ID=latest_superset_job_id
N8N_WEBHOOK_URL=https://your-n8n-domain/webhook/sheet-job-alert
```

---

## 📬 Telegram Output Example

```
📢 New Placement Opportunity at Oracle Financial Services Software Limited (OFSS)!

📍 Location: Bengaluru, Mumbai, Pune or Chennai  
📂 Category: Middle  
📌 Role: Consulting  
💰 CTC: ₹ 9.82 LPA  
📊 Eligibility: 7.00 CGPA and above  

🔗 Apply here: https://app.joinsuperset.com/students  

Stay sharp and good luck! 🚀  
```

---
