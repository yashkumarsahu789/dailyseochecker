import axios from "axios";
import * as cheerio from "cheerio";
import { readDb, writeDb } from "./db.js";

// ============ BACKLINK MONITOR ============
// Called by Firebase Scheduled Function daily at 2 AM

export async function checkAllBacklinks() {
  const db = await readDb();
  if (!db.backlinks) db.backlinks = [];

  for (const site of db.websites) {
    try {
      const hostname = new URL(site.url).hostname;
      console.log(`🔗 Checking backlinks for ${hostname}...`);

      const newBacklinks = await findBacklinks(hostname);

      const existingUrls = new Set(
        db.backlinks
          .filter((b) => String(b.siteId) === String(site.id) && b.active)
          .map((b) => b.sourceUrl),
      );

      for (const bl of newBacklinks) {
        if (!existingUrls.has(bl.sourceUrl)) {
          db.backlinks.push({
            id: Date.now() + Math.random(),
            siteId: Number(site.id),
            sourceUrl: bl.sourceUrl,
            sourceDomain: bl.sourceDomain,
            anchorText: bl.anchorText,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            active: true,
          });
          console.log(`   ✅ NEW backlink: ${bl.sourceDomain}`);
        } else {
          const existing = db.backlinks.find(
            (b) =>
              String(b.siteId) === String(site.id) &&
              b.sourceUrl === bl.sourceUrl,
          );
          if (existing) existing.lastSeen = new Date().toISOString();
        }
      }

      const foundUrls = new Set(newBacklinks.map((b) => b.sourceUrl));
      db.backlinks
        .filter(
          (b) =>
            String(b.siteId) === String(site.id) &&
            b.active &&
            !foundUrls.has(b.sourceUrl),
        )
        .forEach((b) => {
          const daysSinceLastSeen =
            (Date.now() - new Date(b.lastSeen).getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysSinceLastSeen > 7) {
            b.active = false;
            b.lostDate = new Date().toISOString();
            console.log(`   ❌ LOST backlink: ${b.sourceDomain}`);
          }
        });

      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.error(`   ❌ Backlink check error for ${site.url}:`, err.message);
    }
  }

  await writeDb(db);
  console.log("✅ Backlink check completed.");
}

async function findBacklinks(targetDomain) {
  const backlinks = [];

  try {
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
