import { readDb, writeDb } from "../firestore.js";
import { runSeoAudit } from "./seoAudit.js";
import { sendAlertEmail, sendWeeklyReport } from "./emailService.js";
import {
  sendWhatsAppAlert,
  sendWhatsAppWeeklySummary,
} from "./whatsappService.js";

// ============ SCORE DROP DETECTION ============
function detectScoreDrops(db, site, newScores) {
  const threshold = db.settings.scoreDropThreshold || 5;
  const oldScores = site.lastScores;

  if (!oldScores || !newScores) return;

  const categories = ["performance", "accessibility", "bestPractices", "seo"];

  for (const cat of categories) {
    const oldVal = Math.round(oldScores[cat] || 0);
    const newVal = Math.round(newScores[cat] || 0);
    const drop = oldVal - newVal;

    if (drop >= threshold) {
      const alert = {
        id: Date.now() + Math.random(),
        siteId: site.id,
        siteName: new URL(site.url).hostname,
        siteUrl: site.url,
        type: "score_drop",
        category: cat,
        oldScore: oldVal,
        newScore: newVal,
        drop,
        timestamp: new Date().toISOString(),
        dismissed: false,
      };
      db.alerts.push(alert);
      console.log(
        `⚠️ SCORE DROP: ${site.url} — ${cat}: ${oldVal} → ${newVal} (↓${drop})`,
      );
    }
  }
}

// ============ RUN ALL AUDITS ============
export async function runAllAudits() {
  const db = await readDb();
  const websites = db.websites;

  console.log(`📊 Found ${websites.length} websites to audit.`);

  for (const site of websites) {
    console.log(`🔍 Auditing ${site.url}...`);
    try {
      const result = await runSeoAudit(site.url);

      result.websiteId = Number(site.id);

      // Score drop detection
      detectScoreDrops(db, site, result.scores);

      // Save report
      db.reports.push(result);

      // Update website
      const siteIndex = db.websites.findIndex(
        (s) => String(s.id) === String(site.id),
      );
      if (siteIndex !== -1) {
        db.websites[siteIndex].lastRun = new Date().toISOString();
        db.websites[siteIndex].lastScores = result.scores;
        db.websites[siteIndex].lastStatus =
          result.errors.length > 0 ? "ERROR" : "OK";
      }
    } catch (error) {
      console.error(`❌ Scheduler error for ${site.url}:`, error);
    }
  }

  await writeDb(db);
  console.log("✅ Daily audit completed.");

  // Send email alerts if new alerts were created
  const newAlerts = db.alerts.filter(
    (a) =>
      !a.dismissed &&
      new Date(a.timestamp) > new Date(Date.now() - 5 * 60 * 1000),
  );
  if (newAlerts.length > 0) {
    try {
      await sendAlertEmail(newAlerts);
    } catch (err) {
      console.error("❌ Alert email failed:", err.message);
    }
    try {
      await sendWhatsAppAlert(newAlerts);
    } catch (err) {
      console.error("❌ WhatsApp alert failed:", err.message);
    }
  }
}
