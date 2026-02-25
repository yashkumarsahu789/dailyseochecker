import cron from "node-cron";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { runSeoAudit } from "./seoAudit.js";
import { sendAlertEmail, sendWeeklyReport } from "./emailService.js";
import {
  sendWhatsAppAlert,
  sendWhatsAppWeeklySummary,
} from "./whatsappService.js";

// ============ SQLite Setup ============
// DATA_DIR env var lets Railway Volume override the path (e.g. /data)
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve("data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "db.sqlite");
const LEGACY_JSON = path.join(DATA_DIR, "db.json");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL"); // safe for concurrent reads

// ─── Create tables ───
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TEXT,
    last_run TEXT,
    last_scores TEXT,
    last_status TEXT,
    keywords TEXT DEFAULT '[]',
    group_name TEXT,
    tags TEXT DEFAULT '[]',
    notes TEXT,
    ga_property_id TEXT
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER,
    url TEXT,
    timestamp TEXT,
    scores TEXT,
    audits TEXT,
    errors TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reports_site ON reports(website_id);
  CREATE INDEX IF NOT EXISTS idx_reports_time ON reports(timestamp);

  CREATE TABLE IF NOT EXISTS alerts (
    id REAL PRIMARY KEY,
    site_id INTEGER,
    site_name TEXT,
    site_url TEXT,
    type TEXT,
    category TEXT,
    old_score REAL,
    new_score REAL,
    drop_amount REAL,
    message TEXT,
    timestamp TEXT,
    dismissed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS uptime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER,
    url TEXT,
    status TEXT,
    response_time INTEGER,
    timestamp TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_uptime_site ON uptime(website_id);

  CREATE TABLE IF NOT EXISTS keyword_ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER,
    keyword TEXT,
    rank INTEGER,
    timestamp TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_kwranks_site ON keyword_ranks(website_id);

  CREATE TABLE IF NOT EXISTS backlinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER,
    url TEXT,
    source TEXT,
    anchor TEXT,
    status TEXT,
    first_seen TEXT,
    last_seen TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_backlinks_site ON backlinks(website_id);
`);

console.log(`✅ SQLite DB ready at ${DB_PATH}`);

// ─── One-time migration from db.json ───
const migrated = sqlite
  .prepare("SELECT value FROM settings WHERE key='migrated_from_json'")
  .get();
if (!migrated && fs.existsSync(LEGACY_JSON)) {
  try {
    console.log("🔄 Migrating data from db.json → SQLite...");
    const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, "utf-8"));

    const insertSite = sqlite.prepare(`
      INSERT OR REPLACE INTO websites (id,url,created_at,last_run,last_scores,last_status,keywords,group_name,tags,notes,ga_property_id)
      VALUES (@id,@url,@created_at,@last_run,@last_scores,@last_status,@keywords,@group_name,@tags,@notes,@ga_property_id)
    `);
    const insertReport = sqlite.prepare(`
      INSERT INTO reports (website_id,url,timestamp,scores,audits,errors)
      VALUES (@website_id,@url,@timestamp,@scores,@audits,@errors)
    `);
    const insertAlert = sqlite.prepare(`
      INSERT OR REPLACE INTO alerts (id,site_id,site_name,site_url,type,category,old_score,new_score,drop_amount,message,timestamp,dismissed)
      VALUES (@id,@site_id,@site_name,@site_url,@type,@category,@old_score,@new_score,@drop_amount,@message,@timestamp,@dismissed)
    `);
    const insertUptime = sqlite.prepare(`
      INSERT INTO uptime (website_id,url,status,response_time,timestamp)
      VALUES (@website_id,@url,@status,@response_time,@timestamp)
    `);
    const insertKwRank = sqlite.prepare(`
      INSERT INTO keyword_ranks (website_id,keyword,rank,timestamp)
      VALUES (@website_id,@keyword,@rank,@timestamp)
    `);

    const migrateAll = sqlite.transaction(() => {
      // Websites
      for (const w of legacy.websites || []) {
        insertSite.run({
          id: w.id,
          url: w.url,
          created_at: w.createdAt || null,
          last_run: w.lastRun || null,
          last_scores: JSON.stringify(w.lastScores || {}),
          last_status: w.lastStatus || null,
          keywords: JSON.stringify(w.keywords || []),
          group_name: w.group || null,
          tags: JSON.stringify(w.tags || []),
          notes: w.notes || null,
          ga_property_id: w.gaPropertyId || null,
        });
      }
      // Reports
      for (const r of legacy.reports || []) {
        insertReport.run({
          website_id: r.websiteId || null,
          url: r.url,
          timestamp: r.timestamp,
          scores: JSON.stringify(r.scores || {}),
          audits: JSON.stringify(r.audits || {}),
          errors: JSON.stringify(r.errors || []),
        });
      }
      // Alerts
      for (const a of legacy.alerts || []) {
        insertAlert.run({
          id: a.id,
          site_id: a.siteId || null,
          site_name: a.siteName || null,
          site_url: a.siteUrl || null,
          type: a.type || null,
          category: a.category || null,
          old_score: a.oldScore || null,
          new_score: a.newScore || null,
          drop_amount: a.drop || null,
          message: a.message || null,
          timestamp: a.timestamp,
          dismissed: a.dismissed ? 1 : 0,
        });
      }
      // Settings
      const settings = legacy.settings || {};
      const upsertSetting = sqlite.prepare(
        "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
      );
      for (const [k, v] of Object.entries(settings)) {
        upsertSetting.run(k, typeof v === "string" ? v : JSON.stringify(v));
      }
      // Uptime
      for (const u of legacy.uptime || []) {
        insertUptime.run({
          website_id: u.websiteId || null,
          url: u.url,
          status: u.status,
          response_time: u.responseTime || null,
          timestamp: u.timestamp,
        });
      }
      // Keyword ranks
      for (const k of legacy.keywordRanks || []) {
        insertKwRank.run({
          website_id: k.websiteId || null,
          keyword: k.keyword,
          rank: k.rank,
          timestamp: k.date || k.timestamp,
        });
      }
      // Mark migrated
      upsertSetting.run("migrated_from_json", "true");
    });

    migrateAll();

    // Rename legacy file so we don't migrate again
    fs.renameSync(LEGACY_JSON, LEGACY_JSON + ".bak");
    console.log("✅ Migration complete. db.json renamed to db.json.bak");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  }
}

// ============ readDb / writeDb ============
// These maintain the same JSON shape used by all other modules.
// This is the ONLY place that knows about SQLite.

export function readDb() {
  // --- Websites ---
  const websites = sqlite
    .prepare("SELECT * FROM websites")
    .all()
    .map((w) => ({
      id: w.id,
      url: w.url,
      createdAt: w.created_at,
      lastRun: w.last_run,
      lastScores: tryParse(w.last_scores, {}),
      lastStatus: w.last_status,
      keywords: tryParse(w.keywords, []),
      group: w.group_name,
      tags: tryParse(w.tags, []),
      notes: w.notes,
      gaPropertyId: w.ga_property_id,
    }));

  // --- Reports ---
  const reports = sqlite
    .prepare("SELECT * FROM reports ORDER BY timestamp DESC")
    .all()
    .map((r) => ({
      id: r.id,
      websiteId: r.website_id,
      url: r.url,
      timestamp: r.timestamp,
      scores: tryParse(r.scores, {}),
      audits: tryParse(r.audits, {}),
      errors: tryParse(r.errors, []),
    }));

  // --- Alerts ---
  const alerts = sqlite
    .prepare("SELECT * FROM alerts ORDER BY timestamp DESC")
    .all()
    .map((a) => ({
      id: a.id,
      siteId: a.site_id,
      siteName: a.site_name,
      siteUrl: a.site_url,
      type: a.type,
      category: a.category,
      oldScore: a.old_score,
      newScore: a.new_score,
      drop: a.drop_amount,
      message: a.message,
      timestamp: a.timestamp,
      dismissed: a.dismissed === 1,
    }));

  // --- Settings (key-value → object) ---
  const settingsRows = sqlite.prepare("SELECT key,value FROM settings").all();
  const settings = {};
  for (const row of settingsRows) {
    if (row.key === "migrated_from_json") continue;
    settings[row.key] = tryParse(row.value, row.value);
  }

  // --- Uptime ---
  const uptime = sqlite
    .prepare("SELECT * FROM uptime ORDER BY timestamp DESC")
    .all()
    .map((u) => ({
      id: u.id,
      websiteId: u.website_id,
      url: u.url,
      status: u.status,
      responseTime: u.response_time,
      timestamp: u.timestamp,
    }));

  // --- Keyword Ranks ---
  const keywordRanks = sqlite
    .prepare("SELECT * FROM keyword_ranks ORDER BY timestamp DESC")
    .all()
    .map((k) => ({
      id: k.id,
      websiteId: k.website_id,
      keyword: k.keyword,
      rank: k.rank,
      date: k.timestamp,
    }));

  // --- Backlinks ---
  const backlinks = sqlite
    .prepare("SELECT * FROM backlinks ORDER BY last_seen DESC")
    .all()
    .map((b) => ({
      id: b.id,
      websiteId: b.website_id,
      url: b.url,
      source: b.source,
      anchor: b.anchor,
      status: b.status,
      firstSeen: b.first_seen,
      lastSeen: b.last_seen,
    }));

  return {
    websites,
    reports,
    alerts,
    settings,
    uptime,
    keywordRanks,
    backlinks,
  };
}

export function writeDb(data) {
  const db = sqlite;

  const tx = db.transaction(() => {
    // ─── Websites ───
    if (data.websites) {
      const upsert = db.prepare(`
        INSERT OR REPLACE INTO websites
          (id,url,created_at,last_run,last_scores,last_status,keywords,group_name,tags,notes,ga_property_id)
        VALUES
          (@id,@url,@created_at,@last_run,@last_scores,@last_status,@keywords,@group_name,@tags,@notes,@ga_property_id)
      `);
      for (const w of data.websites) {
        upsert.run({
          id: w.id,
          url: w.url,
          created_at: w.createdAt || null,
          last_run: w.lastRun || null,
          last_scores: JSON.stringify(w.lastScores || {}),
          last_status: w.lastStatus || null,
          keywords: JSON.stringify(w.keywords || []),
          group_name: w.group || null,
          tags: JSON.stringify(w.tags || []),
          notes: w.notes || null,
          ga_property_id: w.gaPropertyId || null,
        });
      }
    }

    // ─── Reports ───
    if (data.reports) {
      // Only insert reports that don't have an id yet (new ones from this run)
      const insertReport = db.prepare(`
        INSERT INTO reports (website_id,url,timestamp,scores,audits,errors)
        VALUES (@website_id,@url,@timestamp,@scores,@audits,@errors)
      `);
      for (const r of data.reports) {
        if (!r.id) {
          insertReport.run({
            website_id: r.websiteId || null,
            url: r.url,
            timestamp: r.timestamp,
            scores: JSON.stringify(r.scores || {}),
            audits: JSON.stringify(r.audits || {}),
            errors: JSON.stringify(r.errors || []),
          });
        }
      }
    }

    // ─── Alerts ───
    if (data.alerts) {
      const upsertAlert = db.prepare(`
        INSERT OR REPLACE INTO alerts
          (id,site_id,site_name,site_url,type,category,old_score,new_score,drop_amount,message,timestamp,dismissed)
        VALUES
          (@id,@site_id,@site_name,@site_url,@type,@category,@old_score,@new_score,@drop_amount,@message,@timestamp,@dismissed)
      `);
      for (const a of data.alerts) {
        upsertAlert.run({
          id: a.id,
          site_id: a.siteId || null,
          site_name: a.siteName || null,
          site_url: a.siteUrl || null,
          type: a.type || null,
          category: a.category || null,
          old_score: a.oldScore || null,
          new_score: a.newScore || null,
          drop_amount: a.drop || null,
          message: a.message || null,
          timestamp: a.timestamp,
          dismissed: a.dismissed ? 1 : 0,
        });
      }
    }

    // ─── Settings ───
    if (data.settings) {
      const upsertSetting = db.prepare(
        "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
      );
      for (const [k, v] of Object.entries(data.settings)) {
        upsertSetting.run(k, typeof v === "string" ? v : JSON.stringify(v));
      }
    }

    // ─── Uptime ───
    if (data.uptime) {
      const insertUptime = db.prepare(`
        INSERT OR IGNORE INTO uptime (id,website_id,url,status,response_time,timestamp)
        VALUES (@id,@website_id,@url,@status,@response_time,@timestamp)
      `);
      for (const u of data.uptime) {
        if (u.id) {
          insertUptime.run({
            id: u.id,
            website_id: u.websiteId || null,
            url: u.url,
            status: u.status,
            response_time: u.responseTime || null,
            timestamp: u.timestamp,
          });
        }
      }
    }

    // ─── Keyword Ranks ───
    if (data.keywordRanks) {
      const insertKw = db.prepare(`
        INSERT OR IGNORE INTO keyword_ranks (id,website_id,keyword,rank,timestamp)
        VALUES (@id,@website_id,@keyword,@rank,@timestamp)
      `);
      for (const k of data.keywordRanks) {
        if (k.id) {
          insertKw.run({
            id: k.id,
            website_id: k.websiteId || null,
            keyword: k.keyword,
            rank: k.rank,
            timestamp: k.date || k.timestamp,
          });
        }
      }
    }

    // ─── Backlinks ───
    if (data.backlinks) {
      const upsertBl = db.prepare(`
        INSERT OR REPLACE INTO backlinks (id,website_id,url,source,anchor,status,first_seen,last_seen)
        VALUES (@id,@website_id,@url,@source,@anchor,@status,@first_seen,@last_seen)
      `);
      for (const b of data.backlinks) {
        if (b.id) {
          upsertBl.run({
            id: b.id,
            website_id: b.websiteId || null,
            url: b.url,
            source: b.source || null,
            anchor: b.anchor || null,
            status: b.status || null,
            first_seen: b.firstSeen || null,
            last_seen: b.lastSeen || null,
          });
        }
      }
    }
  });

  tx();
}

// Helper to safely JSON.parse
function tryParse(str, fallback) {
  if (str == null) return fallback;
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ─── Direct SQLite accessors used by server.js ───
// These let server.js do targeted operations without loading the full db.
export const sqliteDb = sqlite;

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

// ============ DATA CLEANUP ============
function cleanupOldData(db) {
  const maxReports = db.settings.maxReportsPerSite || 30;
  const now = new Date();

  // Trim reports per site to maxReports (delete oldest beyond limit)
  const siteIds = [...new Set(db.reports.map((r) => r.websiteId))];
  for (const siteId of siteIds) {
    const siteReports = db.reports
      .filter((r) => r.websiteId === siteId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (siteReports.length > maxReports) {
      const toDelete = siteReports
        .slice(maxReports)
        .map((r) => r.id)
        .filter(Boolean);
      if (toDelete.length > 0) {
        const placeholders = toDelete.map(() => "?").join(",");
        sqlite
          .prepare(`DELETE FROM reports WHERE id IN (${placeholders})`)
          .run(...toDelete);
        db.reports = db.reports.filter((r) => !toDelete.includes(r.id));
      }
    }
  }

  // Trim dismissed alerts older than 30 days
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  sqlite
    .prepare("DELETE FROM alerts WHERE dismissed=1 AND timestamp < ?")
    .run(thirtyDaysAgo.toISOString());
  db.alerts = db.alerts.filter(
    (a) => !a.dismissed || new Date(a.timestamp) > thirtyDaysAgo,
  );

  // Trim uptime records older than 7 days
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  sqlite
    .prepare("DELETE FROM uptime WHERE timestamp < ?")
    .run(sevenDaysAgo.toISOString());

  // Trim keyword ranks older than 90 days
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
  sqlite
    .prepare("DELETE FROM keyword_ranks WHERE timestamp < ?")
    .run(ninetyDaysAgo.toISOString());
}

export function startScheduler() {
  console.log("✅ Daily SEO Scheduler initialized (runs at midnight)");

  // Run every day at midnight (0 0 * * *)
  cron.schedule("0 0 * * *", async () => {
    console.log("🔄 Running daily SEO audit...");
    await runAllAudits();
  });

  // Weekly report email — every Monday at 7:00 AM
  cron.schedule("0 7 * * 1", async () => {
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
}

export async function runAllAudits() {
  const db = readDb();
  const websites = db.websites;

  console.log(`📊 Found ${websites.length} websites to audit.`);

  for (const site of websites) {
    console.log(`🔍 Auditing ${site.url}...`);
    try {
      const result = await runSeoAudit(site.url);

      // Add website ID to report
      result.websiteId = site.id;

      // --- SCORE DROP DETECTION ---
      detectScoreDrops(db, site, result.scores);

      // Save report (no id yet → writeDb will INSERT)
      db.reports.push(result);

      // Update website last run
      const siteIndex = db.websites.findIndex((s) => s.id === site.id);
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

  // --- DATA CLEANUP ---
  cleanupOldData(db);

  writeDb(db);
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

// readDb and writeDb are exported inline above as 'export function'
