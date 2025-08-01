const { chromium } = require("playwright");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

// Push data to Google Sheets
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

// Convert "x hours ago" or "a day ago" to Date object
function parseRelativeTime(text) {
  const lower = text.toLowerCase();
  if (lower.includes("hour")) {
    const num = parseInt(lower) || 0;
    return new Date(Date.now() - num * 3600 * 1000);
  }
  if (lower.includes("day")) {
    const num = lower.includes("a day") ? 1 : parseInt(lower) || 0;
    return new Date(Date.now() - num * 24 * 3600 * 1000);
  }
  return new Date(0);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Login
    await page.goto("https://app.joinsuperset.com/students/login");
    await page.getByPlaceholder("Email").fill(process.env.EMAIL);
    await page.getByPlaceholder("Password").fill(process.env.PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("**/students", { timeout: 60000 });

    // Step 2: Go to Job Profiles page
    const jobProfileUrl = `https://app.joinsuperset.com/students/jobprofiles?currentJobId=${process.env.CURRJOB_ID}`;
    await page.goto(jobProfileUrl, { waitUntil: "domcontentloaded" });

    // Step 3: Click "All Jobs"
    await page.getByRole("tab", { name: "All Jobs" }).click();
    await page.waitForSelector("div.p-4.flex");
    const jobCards = await page.$$("div.p-4.flex");

    if (jobCards.length === 0) {
      console.log("❌ No job cards found.");
      await browser.close();
      return;
    }

    console.log(`🧩 Found ${jobCards.length} job cards`);
    let latestJob = null;
    let latestTime = new Date(0);

    for (const [i, card] of jobCards.entries()) {
      let text = "";
      try {
        // Try inner <p> tag or full card
        text = await card.innerText();
      } catch {
        console.log(`⚠️ Card ${i + 1}: error extracting innerText`);
        continue;
      }

      console.log(`🔹 Job Card ${i + 1} Text:\n${text}\n`);

      const match = text.match(/(\d+\s+hours?\s+ago|\d+\s+days?\s+ago|a\s+day\s+ago)/i);
      if (match) {
        const postDate = parseRelativeTime(match[1]);
        console.log(`⏰ Detected post time: ${match[1]} → ${postDate}`);
        if (postDate > latestTime) {
          latestTime = postDate;
          latestJob = card;
        }
      } else {
        console.log(`❌ No time match in card ${i + 1}`);
      }
    }

    if (latestJob) {
      console.log("🕒 Clicking most recent job card...");
      await latestJob.click();
    } else {
      console.log("⚠️ Could not determine latest job. Clicking first.");
      await jobCards[0].click();
    }

    // Step 4: Extract job info
    await page.waitForSelector("p.text-sm.text-dark.font-normal");
    const companyName = await page.textContent("p.text-sm.text-dark.font-normal");
    const locationElems = await page.$$("p.text-dark.text-sm.font-normal");
    let jobLocation = locationElems.length >= 2 ? await locationElems[1].textContent() : "N/A";

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
    const jobDesc = await page.$eval("div.content-css", el => el.innerText);
    const eligibilityMatch = jobDesc.match(/Eligibility Criteria[:\s]*([^\n]+)/i);
    let eligibility = eligibilityMatch ? eligibilityMatch[1].trim() : "Not found";
    eligibility = eligibility.replace(/As per placement policy,?\s*/i, "").trim();

    const currentJobId = `${companyName}-${jobFunction}-${ctc}`.toLowerCase();

    console.log(`🧩 Company: ${companyName}`);
    console.log(`🎯 Role: ${jobFunction}`);
    console.log(`💸 CTC: ${ctc}`);
    console.log(`🆔 currentJobId: ${currentJobId}`);

    // Step 5: Check last posted job
    const lastJobFile = "./lastJob.json";
    let lastJobId = "";
    if (fs.existsSync(lastJobFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(lastJobFile));
        lastJobId = saved.lastJobId || "";
        console.log(`📁 lastJobId: ${lastJobId}`);
      } catch (e) {
        console.error("⚠️ Could not read lastJob.json:", e.message);
      }
    }

    if (currentJobId === lastJobId) {
      console.log("⏸ No new job detected.");
      await browser.close();
      return;
    }

    // Step 6: Save new job
    fs.writeFileSync(lastJobFile, JSON.stringify({ lastJobId: currentJobId }));
    console.log("🆕 New job detected. Proceeding...");

    const jobData = {
      Company: companyName.trim(),
      Location: jobLocation.trim(),
      Category: category.trim(),
      Role: jobFunction.trim(),
      CTC: ctc.trim(),
      Eligibility: eligibility.trim(),
      ApplyLink: "https://app.joinsuperset.com/students",
      Timestamp: new Date().toLocaleString(),
    };

    console.log("📦 Job Data:", jobData);

    // Step 7: Push to Google Sheets
    await pushToGoogleSheets(jobData);
    console.log("📄 Job added to Google Sheets");

    // Step 8: Send to webhook
    try {
      await axios.post(process.env.N8N_WEBHOOK_URL, jobData);
      console.log("🚀 Sent to n8n webhook");
    } catch (err) {
      console.error("❌ Failed to send to webhook:", err.message);
    }

    console.log("✅ Done");
  } catch (err) {
    console.error("❌ Script error:", err.message);
  } finally {
    await browser.close();
  }
})();
