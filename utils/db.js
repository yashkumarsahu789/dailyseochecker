import sqlite3 from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = sqlite3(path.join(dataDir, "db.sqlite"));
db.pragma("journal_mode = WAL");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS websites (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TEXT,
    last_run TEXT,
    last_scores TEXT,
    last_status TEXT,
    keywords TEXT,
    group_name TEXT,
    tags TEXT,
    notes TEXT,
    ga_property_id TEXT
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id TEXT,
    url TEXT,
    timestamp TEXT,
    scores TEXT,
    audits TEXT,
    errors TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    siteId TEXT,
    url TEXT,
    type TEXT,
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
    siteId TEXT,
    timestamp TEXT,
    ok INTEGER,
    status INTEGER,
    responseTime INTEGER
  );

  CREATE TABLE IF NOT EXISTS keyword_ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siteId TEXT,
    keyword TEXT,
    position INTEGER,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS backlinks (
    id TEXT PRIMARY KEY,
    siteId TEXT,
    url TEXT,
    sourceDomain TEXT,
    targetUrl TEXT,
    anchorText TEXT,
    firstSeen TEXT,
    lastSeen TEXT,
    active INTEGER,
    lostDate TEXT
  );
`);

// Migrations for existing local dbs
try { db.exec("ALTER TABLE backlinks ADD COLUMN firstSeen TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE backlinks ADD COLUMN lastSeen TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE backlinks ADD COLUMN active INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE backlinks ADD COLUMN lostDate TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE websites ADD COLUMN keywords TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE websites ADD COLUMN tags TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE websites ADD COLUMN notes TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE websites ADD COLUMN ga_property_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE alerts ADD COLUMN dismissed INTEGER DEFAULT 0"); } catch (e) {}

const tryParse = (str, fallback) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

// Async wrapper to match Firebase APIs
export async function readDb() {
  const websites = db
    .prepare("SELECT * FROM websites")
    .all()
    .map((w) => ({
      id: w.id,
      url: w.url,
      createdAt: w.created_at,
      lastRun: w.last_run,
      lastScores: tryParse(w.last_scores, null),
      lastStatus: w.last_status,
      keywords: tryParse(w.keywords, []),
      group: w.group_name,
      tags: tryParse(w.tags, []),
      notes: w.notes,
      gaPropertyId: w.ga_property_id,
    }));

  const reports = db
    .prepare("SELECT * FROM reports ORDER BY timestamp DESC LIMIT 500")
    .all()
    .map((r) => ({
      id: String(r.id),
      websiteId: r.website_id,
      url: r.url,
      timestamp: r.timestamp,
      scores: tryParse(r.scores, {}),
      audits: tryParse(r.audits, {}),
      errors: tryParse(r.errors, []),
    }));

  const alerts = db
    .prepare("SELECT * FROM alerts ORDER BY timestamp DESC")
    .all()
    .map((a) => ({
      id: a.id,
      siteId: a.siteId,
      url: a.url,
      type: a.type,
      message: a.message,
      timestamp: a.timestamp,
      dismissed: a.dismissed === 1,
    }));

  const settingsRaw = db.prepare("SELECT * FROM settings").all();
  const settings = {};
  for (const s of settingsRaw) {
    settings[s.key] = tryParse(s.value, s.value);
  }

  const uptime = db
    .prepare("SELECT * FROM uptime ORDER BY timestamp DESC LIMIT 1000")
    .all()
    .map((u) => ({
      id: String(u.id),
      siteId: u.siteId,
      timestamp: u.timestamp,
      ok: u.ok === 1,
      status: u.status,
      responseTime: u.responseTime,
    }));

  const keywordRanks = db
    .prepare("SELECT * FROM keyword_ranks ORDER BY timestamp DESC LIMIT 1000")
    .all()
    .map((k) => ({
      id: String(k.id),
      siteId: k.siteId,
      keyword: k.keyword,
      position: k.position,
      timestamp: k.timestamp,
    }));

  const backlinks = db
    .prepare("SELECT * FROM backlinks ORDER BY lastSeen DESC")
    .all()
    .map((b) => ({
      id: b.id,
      siteId: b.siteId,
      url: b.url,
      sourceDomain: b.sourceDomain,
      targetUrl: b.targetUrl,
      anchorText: b.anchorText,
      firstSeen: b.firstSeen,
      lastSeen: b.lastSeen,
      active: b.active === 1,
      lostDate: b.lostDate,
    }));

  return { websites, reports, alerts, settings, uptime, keywordRanks, backlinks };
}

export async function writeDb(data) {
  const tx = db.transaction(() => {
    if (data.websites) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO websites 
        (id, url, created_at, last_run, last_scores, last_status, keywords, group_name, tags, notes, ga_property_id)
        VALUES (@id, @url, @created_at, @last_run, @last_scores, @last_status, @keywords, @group_name, @tags, @notes, @ga_property_id)
      `);
      for (const w of data.websites) {
        stmt.run({
          id: String(w.id),
          url: w.url,
          created_at: w.createdAt || null,
          last_run: w.lastRun || null,
          last_scores: JSON.stringify(w.lastScores || null),
          last_status: w.lastStatus || null,
          keywords: JSON.stringify(w.keywords || []),
          group_name: w.group || "Ungrouped",
          tags: JSON.stringify(w.tags || []),
          notes: w.notes || "",
          ga_property_id: w.gaPropertyId || "",
        });
      }
    }

    if (data.reports) {
      const stmt = db.prepare(`
        INSERT INTO reports (website_id, url, timestamp, scores, audits, errors)
        VALUES (@website_id, @url, @timestamp, @scores, @audits, @errors)
      `);
      for (const r of data.reports) {
        if (!r._persisted && !r.id) { // Hack to distinguish new reports vs existing ones sent back
          stmt.run({
            website_id: String(r.websiteId),
            url: r.url,
            timestamp: r.timestamp,
            scores: JSON.stringify(r.scores || {}),
            audits: JSON.stringify(r.audits || {}),
            errors: JSON.stringify(r.errors || []),
          });
          r._persisted = true;
        }
      }
    }

    if (data.alerts) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO alerts (id, siteId, url, type, message, timestamp, dismissed)
        VALUES (@id, @siteId, @url, @type, @message, @timestamp, @dismissed)
      `);
      for (const a of data.alerts) {
        stmt.run({
          id: String(a.id || Date.now() + Math.random()),
          siteId: String(a.siteId),
          url: a.url,
          type: a.type,
          message: a.message,
          timestamp: a.timestamp,
          dismissed: a.dismissed ? 1 : 0,
        });
      }
    }

    if (data.settings) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)`);
      for (const [key, value] of Object.entries(data.settings)) {
        stmt.run({ key, value: JSON.stringify(value) });
      }
    }

    if (data.uptime) {
      const stmt = db.prepare(`
        INSERT INTO uptime (siteId, timestamp, ok, status, responseTime)
        VALUES (@siteId, @timestamp, @ok, @status, @responseTime)
      `);
      for (const u of data.uptime) {
        if (!u._persisted && !u.id) {
          stmt.run({
            siteId: String(u.siteId),
            timestamp: u.timestamp,
            ok: u.ok ? 1 : 0,
            status: u.status,
            responseTime: u.responseTime,
          });
          u._persisted = true;
        }
      }
    }

    if (data.keywordRanks) {
      const stmt = db.prepare(`
        INSERT INTO keyword_ranks (siteId, keyword, position, timestamp)
        VALUES (@siteId, @keyword, @position, @timestamp)
      `);
      for (const k of data.keywordRanks) {
        if (!k._persisted && !k.id) {
          stmt.run({
            siteId: String(k.siteId),
            keyword: k.keyword,
            position: k.position,
            timestamp: k.timestamp,
          });
          k._persisted = true;
        }
      }
    }

    if (data.backlinks) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO backlinks (id, siteId, url, sourceDomain, targetUrl, anchorText, firstSeen, lastSeen, active, lostDate)
        VALUES (@id, @siteId, @url, @sourceDomain, @targetUrl, @anchorText, @firstSeen, @lastSeen, @active, @lostDate)
      `);
      for (const b of data.backlinks) {
        stmt.run({
          id: String(b.id || Date.now() + Math.random()),
          siteId: String(b.siteId),
          url: b.url,
          sourceDomain: b.sourceDomain,
          targetUrl: b.targetUrl,
          anchorText: b.anchorText || "",
          firstSeen: b.firstSeen,
          lastSeen: b.lastSeen,
          active: b.active ? 1 : 0,
          lostDate: b.lostDate || null,
        });
      }
    }
  });

  tx();
}

// Targeted helpers mirroring firestore.js
export async function getWebsite(id) {
  const row = db.prepare("SELECT * FROM websites WHERE id = ?").get(String(id));
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    createdAt: row.created_at,
    lastRun: row.last_run,
    lastScores: tryParse(row.last_scores, null),
    lastStatus: row.last_status,
    keywords: tryParse(row.keywords, []),
    group: row.group_name,
    tags: tryParse(row.tags, []),
    notes: row.notes,
    gaPropertyId: row.ga_property_id,
  };
}

export async function addWebsite(siteData) {
  await writeDb({ websites: [siteData] });
  return siteData;
}

export async function updateWebsite(id, updates) {
  const site = await getWebsite(id);
  if (site) {
    const merged = { ...site, ...updates };
    await writeDb({ websites: [merged] });
  }
}

export async function deleteWebsite(id) {
  db.prepare("DELETE FROM websites WHERE id = ?").run(String(id));
  db.prepare("DELETE FROM reports WHERE website_id = ?").run(String(id));
  db.prepare("DELETE FROM uptime WHERE siteId = ?").run(String(id));
  db.prepare("DELETE FROM keyword_ranks WHERE siteId = ?").run(String(id));
  db.prepare("DELETE FROM backlinks WHERE siteId = ?").run(String(id));
}

export async function getAllWebsites() {
  const { websites } = await readDb();
  return websites;
}

export async function getReportsForSite(siteId) {
  const { reports } = await readDb();
  return reports.filter(r => String(r.websiteId) === String(siteId));
}

export async function addReport(report) {
  await writeDb({ reports: [report] });
}

export async function getAlerts() {
  const { alerts } = await readDb();
  return alerts.filter(a => !a.dismissed);
}

export async function dismissAlert(id) {
  db.prepare("UPDATE alerts SET dismissed = 1 WHERE id = ?").run(String(id));
}

export async function dismissAllAlerts() {
  db.prepare("UPDATE alerts SET dismissed = 1 WHERE dismissed = 0").run();
}

export async function getSettings() {
  const { settings } = await readDb();
  return settings;
}

export async function updateSettings(newSettings) {
  await writeDb({ settings: newSettings });
}

export async function getUptime(siteId) {
  const { uptime } = await readDb();
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return uptime.filter(u => String(u.siteId) === String(siteId) && new Date(u.timestamp).getTime() > twentyFourHoursAgo).reverse(); // asc
}

export async function getKeywords(siteId) {
  const site = await getWebsite(siteId);
  const keywords = site?.keywords || [];
  const { keywordRanks } = await readDb();
  const ranks = keywordRanks.filter(k => String(k.siteId) === String(siteId));
  return { keywords, ranks };
}

export async function getBacklinks(siteId) {
  const { backlinks } = await readDb();
  const all = backlinks.filter(b => String(b.siteId) === String(siteId));
  const active = all.filter(b => b.active);
  const lost = all.filter(b => !b.active);
  return { active, lost, total: active.length };
}

export async function getGroups() {
  const { websites } = await readDb();
  return [...new Set(websites.map(w => w.group || "Ungrouped"))];
}

export { db };
