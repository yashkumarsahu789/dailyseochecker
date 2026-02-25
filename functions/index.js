import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import express from "express";
import cors from "cors";
import {
  readDb,
  writeDb,
  getAllWebsites,
  getWebsite,
  addWebsite,
  updateWebsite,
  deleteWebsite,
  getReportsForSite,
  addReport,
  getAlerts,
  dismissAlert,
  dismissAllAlerts,
  getSettings,
  updateSettings,
  getUptime,
  getKeywords,
  getBacklinks,
  getGroups,
} from "./firestore.js";
import { runSeoAudit } from "./utils/seoAudit.js";
import { sendTestEmail, sendWeeklyReport } from "./utils/emailService.js";
import { sendWhatsAppTest } from "./utils/whatsappService.js";
import { generateReport, generateSummaryReport } from "./utils/pdfReport.js";
import {
  generateActionPlan,
  generateLinkSuggestions,
  generateFleetPlan,
} from "./utils/actionPlanEngine.js";

// ============ Express App ============
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ────────── WEBSITES ──────────

// GET /api/websites
app.get("/api/websites", async (req, res) => {
  try {
    const websites = await getAllWebsites();
    res.json(websites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/websites
app.post("/api/websites", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const websites = await getAllWebsites();
    if (websites.find((w) => w.url === url)) {
      return res.status(400).json({ error: "Website already tracked" });
    }

    const newSite = {
      id: Date.now(),
      url,
      createdAt: new Date().toISOString(),
      lastRun: null,
      lastScores: null,
      lastStatus: "PENDING",
      notes: "",
      tags: [],
      group: "Ungrouped",
    };

    await addWebsite(newSite);
    res.json(newSite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/websites/:id/audit
app.post("/api/websites/:id/audit", async (req, res) => {
  try {
    const { id } = req.params;
    const site = await getWebsite(id);
    if (!site) return res.status(404).json({ error: "Website not found" });

    // Run audit asynchronously
    runSeoAudit(site.url)
      .then(async (result) => {
        result.websiteId = Number(id);
        await addReport(result);
        await updateWebsite(id, {
          lastRun: new Date().toISOString(),
          lastScores: result.scores,
          lastStatus: result.errors.length > 0 ? "ERROR" : "OK",
        });
        console.log(`Manual audit finished for ${site.url}`);
      })
      .catch((err) => {
        console.error("Manual audit failed", err);
      });

    res.json({ message: "Audit started", status: "PENDING" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/:id
app.get("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const reports = await getReportsForSite(id);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/websites/:id
app.delete("/api/websites/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteWebsite(id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/websites/:id
app.patch("/api/websites/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, tags, group, gaPropertyId } = req.body;
    const site = await getWebsite(id);
    if (!site) return res.status(404).json({ error: "Not found" });

    const updates = {};
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;
    if (group !== undefined) updates.group = group;
    if (gaPropertyId !== undefined) updates.gaPropertyId = gaPropertyId;

    await updateWebsite(id, updates);
    res.json({ ...site, ...updates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/groups
app.get("/api/groups", async (req, res) => {
  try {
    const groups = await getGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── COMPARE ──────────

app.post("/api/compare", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    console.log(`Running competitor audit for ${url}...`);
    const result = await runSeoAudit(url);
    res.json(result);
  } catch (error) {
    console.error("Compare audit failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// ────────── BACKLINKS ──────────

app.get("/api/websites/:id/backlinks", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getBacklinks(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── UPTIME ──────────

app.get("/api/uptime/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const records = await getUptime(id);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── KEYWORDS ──────────

app.post("/api/websites/:id/keywords", async (req, res) => {
  try {
    const { id } = req.params;
    const { keywords } = req.body;
    if (!keywords || !Array.isArray(keywords))
      return res.status(400).json({ error: "keywords array required" });

    const site = await getWebsite(id);
    if (!site) return res.status(404).json({ error: "Website not found" });

    const mergedKeywords = [
      ...new Set([...(site.keywords || []), ...keywords]),
    ];
    await updateWebsite(id, { keywords: mergedKeywords });
    res.json({ keywords: mergedKeywords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/websites/:id/keywords", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getKeywords(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/websites/:id/keywords/:keyword", async (req, res) => {
  try {
    const { id, keyword } = req.params;
    const site = await getWebsite(id);
    if (site) {
      const updatedKeywords = (site.keywords || []).filter(
        (k) => k !== decodeURIComponent(keyword),
      );
      await updateWebsite(id, { keywords: updatedKeywords });
    }
    res.json({ message: "Keyword removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/websites/:id/keywords/check", async (req, res) => {
  try {
    res.json({ message: "Keyword check started" });
    const { checkAllKeywords } = await import("./utils/keywordTracker.js");
    await checkAllKeywords();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── ALERTS ──────────

app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/alerts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await dismissAlert(id);
    res.json({ message: "Alert dismissed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/alerts", async (req, res) => {
  try {
    await dismissAllAlerts();
    res.json({ message: "All alerts dismissed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── SETTINGS ──────────

const DEFAULT_SETTINGS = {
  cronSchedule: "0 0 * * *",
  scoreDropThreshold: 5,
  uptimeCheckInterval: 5,
  maxReportsPerSite: 30,
};

app.get("/api/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ ...DEFAULT_SETTINGS, ...settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const currentSettings = await getSettings();
    const merged = { ...DEFAULT_SETTINGS, ...currentSettings, ...req.body };
    await updateSettings(merged);
    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/settings/test-email", async (req, res) => {
  try {
    await sendTestEmail();
    res.json({ message: "Test email sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/settings/weekly-report", async (req, res) => {
  try {
    await sendWeeklyReport();
    res.json({ message: "Weekly report sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/settings/test-whatsapp", async (req, res) => {
  try {
    await sendWhatsAppTest();
    res.json({ message: "WhatsApp test sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── REPORTS (PDF/HTML) ──────────

app.get("/api/websites/:id/report", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await generateReport(id);
    res.json({ filename: result.filename, html: result.html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/report/summary", async (req, res) => {
  try {
    const result = await generateSummaryReport();
    res.json({ filename: result.filename, html: result.html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── AI ACTION PLAN ──────────

app.get("/api/websites/:id/action-plan", async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await generateActionPlan(id);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/link-suggestions", async (req, res) => {
  try {
    const suggestions = await generateLinkSuggestions();
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/fleet-plan", async (req, res) => {
  try {
    const fleet = await generateFleetPlan();
    res.json(fleet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ────────── ANALYTICS & INSIGHTS ──────────

app.get("/api/websites/:id/analytics", async (req, res) => {
  try {
    const { id } = req.params;
    const { getWebsiteAnalytics } = await import("./utils/analyticsService.js");
    const analytics = await getWebsiteAnalytics(id);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Export as Firebase Cloud Function ============
export const api = onRequest(
  { region: "asia-south1", timeoutSeconds: 300, memory: "512MiB" },
  app,
);

// ============ Scheduled Functions ============

// Daily SEO Audit — runs at midnight IST
export const dailyAudit = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    console.log("🔄 Running daily SEO audit...");
    const { runAllAudits } = await import("./utils/scheduler.js");
    await runAllAudits();
  },
);

// Uptime check — every 5 minutes
export const uptimeCheck = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "asia-south1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async () => {
    const { checkAllSites } = await import("./utils/uptimeMonitor.js");
    await checkAllSites();
  },
);

// Keyword rank check — daily at 1 AM IST
export const keywordCheck = onSchedule(
  {
    schedule: "0 1 * * *",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    console.log("🔑 Running daily keyword rank check...");
    const { checkAllKeywords } = await import("./utils/keywordTracker.js");
    await checkAllKeywords();
  },
);

// Backlink check — daily at 2 AM IST
export const backlinkCheck = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    console.log("🔗 Running backlink check...");
    const { checkAllBacklinks } = await import("./utils/backlinkMonitor.js");
    await checkAllBacklinks();
  },
);

// Weekly report — Monday at 7 AM IST
export const weeklyReport = onSchedule(
  {
    schedule: "0 7 * * 1",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    console.log("📧 Sending weekly report...");
    try {
      await sendWeeklyReport();
    } catch (err) {
      console.error("❌ Weekly report email failed:", err.message);
    }
    try {
      const { sendWhatsAppWeeklySummary } =
        await import("./utils/whatsappService.js");
      await sendWhatsAppWeeklySummary();
    } catch (err) {
      console.error("❌ WhatsApp weekly summary failed:", err.message);
    }
  },
);
