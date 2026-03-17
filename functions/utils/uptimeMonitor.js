import https from "https";
import http from "http";
import { readDb, writeDb } from "./db.js";

// ============ UPTIME MONITOR ============
// Called by Firebase Scheduled Function every 5 minutes

export async function checkAllSites() {
  const db = await readDb();
  if (!db.uptime) db.uptime = [];

  for (const site of db.websites) {
    try {
      const result = await pingSite(site.url);

      db.uptime.push({
        siteId: Number(site.id),
        status: result.statusCode,
        responseTime: result.responseTime,
        ok: result.ok,
        timestamp: new Date().toISOString(),
      });

      if (!result.ok) {
        if (!db.alerts) db.alerts = [];
        db.alerts.push({
          id: Date.now() + Math.random(),
          siteId: Number(site.id),
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
      db.uptime.push({
        siteId: Number(site.id),
        status: 0,
        responseTime: 0,
        ok: false,
        timestamp: new Date().toISOString(),
      });
    }
  }

  await writeDb(db);
}

function pingSite(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith("https") ? https : http;

    const req = client.get(
      url,
      {
        timeout: 10000,
        headers: { "User-Agent": "DailySEO-UptimeBot/1.0" },
      },
      (res) => {
        const responseTime = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          responseTime,
          ok: res.statusCode >= 200 && res.statusCode < 400,
        });
        res.resume();
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
