const { chromium } = require("playwright");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

async function pushToGoogleSheets(data) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow(data);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Go to login page
    await page.goto("https://app.joinsuperset.com/students/login");

    // 2. Login
    await page.getByPlaceholder("Email").fill(process.env.EMAIL);
    await page.getByPlaceholder("Password").fill(process.env.PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    // 3. Wait for dashboard
    await page.waitForURL("**/students", { timeout: 60000 });

    // 4. Go to job profiles
    const jobProfileUrl = `https://app.joinsuperset.com/students/jobprofiles?currentJobId=${process.env.CURRJOB_ID}`;
    await page.goto(jobProfileUrl, { waitUntil: "domcontentloaded" });

    // 5. Click "All Jobs"
    await page.getByRole("tab", { name: "All Jobs" }).click();

    // 6. Click latest job card
    await page.waitForSelector("div.p-4.flex");
    const jobCards = await page.$$("div.p-4.flex");
    if (jobCards.length === 0) {
      console.log("❌ No job cards found");
      await browser.close();
      return;
    }
    await jobCards[0].click();

    // 7. Extract details
    await page.waitForSelector("p.text-sm.text-dark.font-normal");
    const companyName = await page.textContent("p.text-sm.text-dark.font-normal");

    const allParagraphs = await page.$$("p.text-dark.text-sm.font-normal");
    let jobLocation = "N/A";
    if (allParagraphs.length >= 2) {
      jobLocation = await allParagraphs[1].textContent();
    }

    const pTags = await page.$$("p.text-sm, p.text-base");
    let category = "N/A", jobFunction = "N/A", ctc = "N/A";
    for (let i = 0; i < pTags.length - 1; i++) {
      const label = (await pTags[i].textContent()).trim();
      const nextText = (await pTags[i + 1].textContent()).trim();
      if (label === "Category:") category = nextText;
      if (label === "Job Functions:") jobFunction = nextText;
      if (label === "Job Profile CTC:") ctc = nextText;
    }

    await page.waitForSelector("div.content-css");
    const jobDesc = await page.$eval("div.content-css", (el) => el.innerText);
    const eligibilityMatch = jobDesc.match(/Eligibility Criteria[:\s]*([^\n]+)/i);
    let eligibility = eligibilityMatch ? eligibilityMatch[1].trim() : "Not found";
    eligibility = eligibility.replace(/As per placement policy,?\s*/i, "").trim();

    const jobData = {
      Company: companyName,
      Location: jobLocation,
      Category: category,
      Role: jobFunction,
      CTC: ctc,
      Eligibility: eligibility,
      ApplyLink: "https://app.joinsuperset.com/students",
      Timestamp: new Date().toLocaleString(),
    };

    // 8. Avoid duplicates using lastJob.json
    const lastJobFile = "./lastJob.json";
    const currentJobId = `${companyName}-${jobFunction}-${ctc}`.toLowerCase();

    let lastJobId = "";
    if (fs.existsSync(lastJobFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(lastJobFile));
        lastJobId = saved.lastJobId || "";
      } catch (e) {
        console.error("⚠️ Error reading lastJob.json:", e.message);
      }
    }

    if (currentJobId === lastJobId) {
      console.log("⏸ No new job posted. Skipping...");
      await browser.close();
      return;
    }

    fs.writeFileSync(lastJobFile, JSON.stringify({ lastJobId: currentJobId }));
    console.log("🆕 New job detected. Posting...");

    // 9. Push to Google Sheets
    await pushToGoogleSheets(jobData);
    console.log("📄 Added to Google Sheets");

    // 10. Send to n8n webhook
    try {
      await axios.post(process.env.N8N_WEBHOOK_URL, jobData);
      console.log("🚀 Sent to n8n webhook");
    } catch (err) {
      console.error("❌ Failed to send to webhook:", err.message);
    }

    console.log("✅ Done");
  } catch (err) {
    console.error("❌ Error in script:", err.message);
  } finally {
    await browser.close();
  }
})();
