import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  startScheduler,
  runAllAudits,
  readDb,
  writeDb,
} from "./utils/scheduler.js";
import { runSeoAudit } from "./utils/seoAudit.js";
import { startUptimeMonitor } from "./utils/uptimeMonitor.js";
import {
  startKeywordTracker,
  checkAllKeywords,
} from "./utils/keywordTracker.js";
import { sendTestEmail, sendWeeklyReport } from "./utils/emailService.js";
import { startBacklinkMonitor } from "./utils/backlinkMonitor.js";
import { sendWhatsAppTest } from "./utils/whatsappService.js";
import { generateReport, generateSummaryReport } from "./utils/pdfReport.js";
import {
  generateActionPlan,
  generateLinkSuggestions,
  generateFleetPlan,
} from "./utils/actionPlanEngine.js";
import path from "path";

dotenv.config({ path: "./src/.env" });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Add Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; font-src 'self' https://r2cdn.perplexity.ai; connect-src 'self' http://localhost:3000; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval';",
  );
  next();
});

// Initialize Scheduler & Uptime Monitor & Keyword Tracker & Backlink Monitor
startScheduler();
startUptimeMonitor();
startKeywordTracker();
startBacklinkMonitor();

// API: Get all tracked websites
app.get("/api/websites", (req, res) => {
  try {
    const db = readDb();
    res.json(db.websites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Add a new website
app.post("/api/websites", (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const db = readDb();
    if (db.websites.find((w) => w.url === url)) {
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

    db.websites.push(newSite);
    writeDb(db);
    res.json(newSite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Trigger Manual Audit
app.post("/api/websites/:id/audit", async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    const site = db.websites.find((w) => w.id == id);

    if (!site) return res.status(404).json({ error: "Website not found" });

    // Run audit asynchronously so we don't block
    runSeoAudit(site.url)
      .then((result) => {
        const currentDb = readDb(); // Re-read to get latest state
        result.websiteId = parseInt(id);

        currentDb.reports.push(result);

        const siteIndex = currentDb.websites.findIndex((s) => s.id == id);
        if (siteIndex !== -1) {
          currentDb.websites[siteIndex].lastRun = new Date().toISOString();
          currentDb.websites[siteIndex].lastScores = result.scores;
          currentDb.websites[siteIndex].lastStatus =
            result.errors.length > 0 ? "ERROR" : "OK";
        }
        writeDb(currentDb);
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

// API: Get Reports for a website
app.get("/api/reports/:id", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    const reports = db.reports.filter((r) => r.websiteId == id);

    // Return latest 10 reports, sorted by date desc
    const sortedReports = reports
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
    res.json(sortedReports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete a website and its reports
app.delete("/api/websites/:id", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    db.websites = db.websites.filter((w) => w.id != id);
    db.reports = db.reports.filter((r) => r.websiteId != id);
    writeDb(db);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update site metadata (notes, tags, group, gaPropertyId)
app.patch("/api/websites/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { notes, tags, group, gaPropertyId } = req.body;
    const db = readDb();
    const site = db.websites.find((w) => String(w.id) === String(id));
    if (!site) return res.status(404).json({ error: "Not found" });

    if (notes !== undefined) site.notes = notes;
    if (tags !== undefined) site.tags = tags;
    if (group !== undefined) site.group = group;
    if (gaPropertyId !== undefined) site.gaPropertyId = gaPropertyId;
    writeDb(db);
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get all distinct groups
app.get("/api/groups", (req, res) => {
  try {
    const db = readDb();
    const groups = [...new Set(db.websites.map((w) => w.group || "Ungrouped"))];
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Compare with Competitor
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

// ============ BACKLINKS API ============

// API: Get backlinks for a site
app.get("/api/websites/:id/backlinks", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    const backlinks = (db.backlinks || []).filter(
      (b) => String(b.siteId) === String(id),
    );
    const active = backlinks.filter((b) => b.active);
    const lost = backlinks.filter((b) => !b.active);
    res.json({ active, lost, total: active.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ UPTIME API ============

// API: Get uptime records for a site (last 24h)
app.get("/api/uptime/:id", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const records = (db.uptime || [])
      .filter(
        (u) =>
          String(u.siteId) === String(id) &&
          new Date(u.timestamp) > twentyFourHoursAgo,
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ KEYWORD RANK API ============

// API: Add keywords to track for a site
app.post("/api/websites/:id/keywords", (req, res) => {
  try {
    const { id } = req.params;
    const { keywords } = req.body; // array of strings
    if (!keywords || !Array.isArray(keywords))
      return res.status(400).json({ error: "keywords array required" });

    const db = readDb();
    const site = db.websites.find((w) => String(w.id) === String(id));
    if (!site) return res.status(404).json({ error: "Website not found" });

    // Merge keywords (no duplicates)
    site.keywords = [...new Set([...(site.keywords || []), ...keywords])];
    writeDb(db);
    res.json({ keywords: site.keywords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get keyword rank history for a site
app.get("/api/websites/:id/keywords", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    const site = db.websites.find((w) => String(w.id) === String(id));
    const keywords = site?.keywords || [];
    const ranks = (db.keywordRanks || []).filter(
      (r) => String(r.siteId) === String(id),
    );
    res.json({ keywords, ranks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete a keyword from tracking
app.delete("/api/websites/:id/keywords/:keyword", (req, res) => {
  try {
    const { id, keyword } = req.params;
    const db = readDb();
    const site = db.websites.find((w) => String(w.id) === String(id));
    if (site) {
      site.keywords = (site.keywords || []).filter(
        (k) => k !== decodeURIComponent(keyword),
      );
      // Also remove rank history for this keyword
      db.keywordRanks = (db.keywordRanks || []).filter(
        (r) =>
          !(
            String(r.siteId) === String(id) &&
            r.keyword === decodeURIComponent(keyword)
          ),
      );
      writeDb(db);
    }
    res.json({ message: "Keyword removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Trigger manual keyword rank check for a site
app.post("/api/websites/:id/keywords/check", async (req, res) => {
  try {
    res.json({ message: "Keyword check started" });
    await checkAllKeywords();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ALERTS API ============

// API: Get all active alerts
app.get("/api/alerts", (req, res) => {
  try {
    const db = readDb();
    const alerts = (db.alerts || [])
      .filter((a) => !a.dismissed)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Dismiss an alert
app.delete("/api/alerts/:id", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDb();
    const alert = db.alerts.find((a) => String(a.id) === String(id));
    if (alert) {
      alert.dismissed = true;
      writeDb(db);
    }
    res.json({ message: "Alert dismissed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Dismiss all alerts
app.delete("/api/alerts", (req, res) => {
  try {
    const db = readDb();
    (db.alerts || []).forEach((a) => (a.dismissed = true));
    writeDb(db);
    res.json({ message: "All alerts dismissed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SETTINGS API ============

const DEFAULT_SETTINGS = {
  cronSchedule: "0 0 * * *",
  scoreDropThreshold: 5,
  uptimeCheckInterval: 5,
  maxReportsPerSite: 30,
};

// API: Get settings
app.get("/api/settings", (req, res) => {
  try {
    const db = readDb();
    res.json({ ...DEFAULT_SETTINGS, ...(db.settings || {}) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update settings
app.put("/api/settings", (req, res) => {
  try {
    const db = readDb();
    db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}), ...req.body };
    writeDb(db);
    res.json(db.settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Test email
app.post("/api/settings/test-email", async (req, res) => {
  try {
    await sendTestEmail();
    res.json({ message: "Test email sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Trigger weekly report manually
app.post("/api/settings/weekly-report", async (req, res) => {
  try {
    await sendWeeklyReport();
    res.json({ message: "Weekly report sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// API: Test WhatsApp
app.post("/api/settings/test-whatsapp", async (req, res) => {
  try {
    await sendWhatsAppTest();
    res.json({ message: "WhatsApp test sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PDF REPORT API ============

// API: Generate PDF report for a site
app.get("/api/websites/:id/report", (req, res) => {
  try {
    const { id } = req.params;
    const result = generateReport(id);
    res.json({ filename: result.filename, html: result.html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Generate summary report for all sites
app.get("/api/report/summary", (req, res) => {
  try {
    const result = generateSummaryReport();
    res.json({ filename: result.filename, html: result.html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve generated report files
app.use("/reports", express.static(path.resolve("data/reports")));

// ============ AI ACTION PLAN API ============

// API: Get action plan for a site
app.get("/api/websites/:id/action-plan", (req, res) => {
  try {
    const { id } = req.params;
    const plan = generateActionPlan(id);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get internal link suggestions across all sites
app.get("/api/link-suggestions", (req, res) => {
  try {
    const suggestions = generateLinkSuggestions();
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get fleet-wide action plan (all sites)
app.get("/api/fleet-plan", (req, res) => {
  try {
    const fleet = generateFleetPlan();
    res.json(fleet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
