import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Import utils
import { runSeoAudit } from "./utils/seoAudit.js";
import { updateWebsite, addReport } from "./utils/db.js";
import { sendTestEmail, sendWeeklyReport } from "./utils/emailService.js";
import { sendWhatsAppTest, sendWhatsAppWeeklySummary } from "./utils/whatsappService.js";
import { generateActionPlan, generateLinkSuggestions, generateFleetPlan } from "./utils/actionPlanEngine.js";
import { generateReport, generateSummaryReport } from "./utils/pdfReport.js";
import { checkAllSites } from "./utils/uptimeMonitor.js";
import { checkAllKeywords } from "./utils/keywordTracker.js";
import { checkAllBacklinks } from "./utils/backlinkMonitor.js";
import { runAllAudits } from "./utils/scheduler.js";

// Callables
export const requestCompetitorAudit = onCall(async (request) => {
  const { url } = request.data;
  if (!url) throw new HttpsError("invalid-argument", "URL is required");
  try {
    const result = await runSeoAudit(url);
    return result;
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

export const checkKeywordRanksData = onCall(async (request) => {
  try {
    await checkAllKeywords();
    return { success: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const testEmail = onCall(async () => {
  try {
    await sendTestEmail();
    return { success: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const testWhatsApp = onCall(async () => {
  try {
    await sendWhatsAppTest();
    return { success: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const getActionPlanData = onCall(async (request) => {
  const { siteId } = request.data;
  try {
    return await generateActionPlan(siteId);
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const getLinkSuggestionsData = onCall(async () => {
  try {
    return await generateLinkSuggestions();
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const getFleetPlanData = onCall(async () => {
  try {
    return await generateFleetPlan();
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const generateSitePdf = onCall(async (request) => {
  const { siteId } = request.data;
  try {
    return await generateReport(siteId);
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const generateSummaryPdfData = onCall(async () => {
  try {
    return await generateSummaryReport();
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const getAnalyticsData = onCall(async (request) => {
  const { siteId } = request.data;
  try {
    const { getWebsiteAnalytics } = await import("./utils/analyticsService.js");
    return await getWebsiteAnalytics(siteId);
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

export const weeklyReportTask = onCall(async () => {
  try {
    await sendWeeklyReport();
    return { success: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// Firestore Triggers
export const onWebsiteUpdated = onDocumentUpdated("websites/{siteId}", async (event) => {
  const newValue = event.data.after.data();
  const previousValue = event.data.before.data();

  // If status changed to PENDING, run audit
  if (newValue.lastStatus === "PENDING" && previousValue.lastStatus !== "PENDING") {
    console.log(`Starting audit for ${newValue.url}`);
    
    // Safety check - mark as running to prevent duplicate triggers
    await updateWebsite(event.params.siteId, { lastStatus: "RUNNING" });

    try {
      const result = await runSeoAudit(newValue.url);
      result.websiteId = event.params.siteId;
      await addReport(result);
      await updateWebsite(event.params.siteId, {
        lastRun: new Date().toISOString(),
        lastScores: result.scores,
        lastStatus: result.errors.length > 0 ? "ERROR" : "OK"
      });
      console.log(`Audit finished for ${newValue.url}`);
    } catch (err) {
      console.error(`Audit failed for ${newValue.url}`, err);
      await updateWebsite(event.params.siteId, {
        lastRun: new Date().toISOString(),
        lastStatus: "ERROR"
      });
    }
  }
});

// Scheduled Functions (Cron)

export const dailySEOAudit = onSchedule("0 0 * * *", async (event) => {
  console.log("🔄 Running daily SEO audit");
  await runAllAudits();
});

export const uptimeCheck = onSchedule("every 5 minutes", async (event) => {
  console.log("📡 Running uptime check");
  await checkAllSites();
});

export const keywordCheck = onSchedule("0 1 * * *", async (event) => {
  console.log("🔑 Running daily keyword check");
  await checkAllKeywords();
});

export const backlinkCheck = onSchedule("0 2 * * *", async (event) => {
  console.log("🔗 Running backlink monitor");
  await checkAllBacklinks();
});

export const weeklyReportSchedule = onSchedule("0 7 * * 1", async (event) => {
  console.log("📧 Sending weekly report...");
  try {
    await sendWeeklyReport();
  } catch (err) {
    console.error("❌ Weekly report email failed:", err.message);
  }
  try {
    await sendWhatsAppWeeklySummary();
  } catch (err) {
    console.error("❌ WhatsApp weekly summary failed:", err.message);
  }
});
