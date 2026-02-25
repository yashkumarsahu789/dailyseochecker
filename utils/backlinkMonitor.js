import axios from "axios";
import * as cheerio from "cheerio";
import cron from "node-cron";
import { readDb, writeDb } from "./scheduler.js";

// ============ BACKLINK MONITOR ============
// Checks for backlinks pointing to tracked sites using Google search queries
// Runs daily at 2:00 AM

export function startBacklinkMonitor() {
  console.log("✅ Backlink Monitor initialized (daily at 2:00 AM)");

  cron.schedule("0 2 * * *", async () => {
    console.log("🔗 Running backlink check...");
    await checkAllBacklinks();
  });
}

export async function checkAllBacklinks() {
  const db = readDb();
  if (!db.backlinks) db.backlinks = [];

  for (const site of db.websites) {
    try {
      const hostname = new URL(site.url).hostname;
      console.log(`🔗 Checking backlinks for ${hostname}...`);

      const newBacklinks = await findBacklinks(hostname);

      // Merge with existing — track new and lost
      const existingUrls = new Set(
        db.backlinks
          .filter((b) => b.siteId === site.id && b.active)
          .map((b) => b.sourceUrl),
      );

      for (const bl of newBacklinks) {
        if (!existingUrls.has(bl.sourceUrl)) {
          db.backlinks.push({
            id: Date.now() + Math.random(),
            siteId: site.id,
            sourceUrl: bl.sourceUrl,
            sourceDomain: bl.sourceDomain,
            anchorText: bl.anchorText,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            active: true,
          });
          console.log(`   ✅ NEW backlink: ${bl.sourceDomain}`);
        } else {
          // Update lastSeen for existing
          const existing = db.backlinks.find(
            (b) => b.siteId === site.id && b.sourceUrl === bl.sourceUrl,
          );
          if (existing) existing.lastSeen = new Date().toISOString();
        }
      }

      // Mark backlinks not found in latest scan as potentially lost
      const foundUrls = new Set(newBacklinks.map((b) => b.sourceUrl));
      db.backlinks
        .filter(
          (b) =>
            b.siteId === site.id && b.active && !foundUrls.has(b.sourceUrl),
        )
        .forEach((b) => {
          // Only mark lost after 7 days of not being seen
          const daysSinceLastSeen =
            (Date.now() - new Date(b.lastSeen).getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysSinceLastSeen > 7) {
            b.active = false;
            b.lostDate = new Date().toISOString();
            console.log(`   ❌ LOST backlink: ${b.sourceDomain}`);
          }
        });

      // Rate-limit between sites
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.error(`   ❌ Backlink check error for ${site.url}:`, err.message);
    }
  }

  writeDb(db);
  console.log("✅ Backlink check completed.");
}

async function findBacklinks(targetDomain) {
  const backlinks = [];

  try {
    // Method 1: Search Google for links to the domain
    const query = encodeURIComponent(
      `link:${targetDomain} -site:${targetDomain}`,
    );
    const url = `https://www.google.com/search?q=${query}&num=50&hl=en`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);

    $("div.g").each((_, el) => {
      const linkEl = $(el).find("a[href]").first();
      const href = linkEl.attr("href") || "";

      // Filter out Google-owned or non-http links
      if (
        href.startsWith("http") &&
        !href.includes("google.com") &&
        !href.includes("youtube.com") &&
        !href.includes("webcache.googleusercontent")
      ) {
        try {
          const sourceUrl = new URL(href);
          if (sourceUrl.hostname !== targetDomain) {
            backlinks.push({
              sourceUrl: href,
              sourceDomain: sourceUrl.hostname,
              anchorText: $(el).find("h3").first().text() || sourceUrl.hostname,
            });
          }
        } catch {
          // Invalid URL
        }
      }
    });
  } catch (err) {
    console.error(`   Google search error for backlinks:`, err.message);
  }

  return backlinks;
}
