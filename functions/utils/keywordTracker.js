import axios from "axios";
import * as cheerio from "cheerio";
import { readDb, writeDb } from "../firestore.js";

// ============ KEYWORD RANK TRACKER ============
// Called by Firebase Scheduled Function daily at 1 AM

export async function checkAllKeywords() {
  const db = await readDb();
  if (!db.keywordRanks) db.keywordRanks = [];

  for (const site of db.websites) {
    const keywords = site.keywords || [];
    if (keywords.length === 0) continue;

    const hostname = new URL(site.url).hostname;
    console.log(`🔑 Checking ${keywords.length} keywords for ${hostname}...`);

    for (const keyword of keywords) {
      try {
        const position = await getGoogleRank(keyword, hostname);

        db.keywordRanks.push({
          siteId: Number(site.id),
          keyword,
          position,
          date: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString(),
        });

        console.log(
          `   "${keyword}" → ${position > 0 ? `#${position}` : "Not in top 100"}`,
        );

        // Rate limit
        await sleep(2000 + Math.random() * 3000);
      } catch (err) {
        console.error(`   ❌ Error checking "${keyword}":`, err.message);
      }
    }
  }

  await writeDb(db);
  console.log("✅ Keyword rank check completed.");
}

async function getGoogleRank(keyword, targetDomain) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://www.google.com/search?q=${query}&num=100&hl=en`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    let position = 0;
    let rank = 0;

    $("div.g, div[data-sokoban-container]").each((_, el) => {
      rank++;
      const links = $(el).find("a[href]");
      for (let i = 0; i < links.length; i++) {
        const href = $(links[i]).attr("href") || "";
        if (href.includes(targetDomain)) {
          position = rank;
          return false;
        }
      }
    });

    return position;
  } catch (err) {
    console.error(`   Google search error for "${keyword}":`, err.message);
    return 0;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
