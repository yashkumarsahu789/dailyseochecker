import cron from "node-cron";
import https from "https";
import http from "http";
import { readDb, writeDb } from "./scheduler.js";

// ============ UPTIME MONITOR ============
// Pings all tracked sites every 5 minutes
// Stores uptime records and creates alerts on failure

export function startUptimeMonitor() {
  console.log("✅ Uptime Monitor initialized (checks every 5 minutes)");

  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    await checkAllSites();
  });

  // Also run immediately on startup (after 10s delay)
  setTimeout(() => checkAllSites(), 10000);
}

async function checkAllSites() {
  const db = readDb();
  if (!db.uptime) db.uptime = [];

  for (const site of db.websites) {
    try {
      const result = await pingSite(site.url);

      db.uptime.push({
        siteId: site.id,
        status: result.statusCode,
        responseTime: result.responseTime,
        ok: result.ok,
        timestamp: new Date().toISOString(),
      });

      if (!result.ok) {
        // Create alert for downtime
        if (!db.alerts) db.alerts = [];
        db.alerts.push({
          id: Date.now() + Math.random(),
          siteId: site.id,
          siteName: new URL(site.url).hostname,
          siteUrl: site.url,
          type: "downtime",
          statusCode: result.statusCode,
          message: `Site returned ${result.statusCode || "TIMEOUT"}`,
          timestamp: new Date().toISOString(),
          dismissed: false,
        });
        console.log(
          `🔴 DOWN: ${site.url} — Status: ${result.statusCode || "TIMEOUT"} (${result.responseTime}ms)`,
        );
      }
    } catch (err) {
      // Even on error, log downtime
      db.uptime.push({
        siteId: site.id,
        status: 0,
        responseTime: 0,
        ok: false,
        timestamp: new Date().toISOString(),
      });
    }
  }

  writeDb(db);
}

function pingSite(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith("https") ? https : http;

    const req = client.get(
      url,
      {
        timeout: 10000,
        headers: { "User-Agent": "LifeSolveNow-UptimeBot/1.0" },
      },
      (res) => {
        const responseTime = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          responseTime,
          ok: res.statusCode >= 200 && res.statusCode < 400,
        });
        res.resume(); // Consume response to free memory
      },
    );

    req.on("error", () => {
      resolve({
        statusCode: 0,
        responseTime: Date.now() - start,
        ok: false,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        statusCode: 0,
        responseTime: 10000,
        ok: false,
      });
    });
  });
}
