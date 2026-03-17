import { runSeoAudit } from "./utils/seoAudit.js";
import { addReport, updateWebsite, getWebsite } from "./utils/db.js";

async function test() {
  try {
    const url = "https://lifesolvenow.vercel.app/";
    const id = "1773595536460";
    console.log("Starting audit for", url);
    const result = await runSeoAudit(url);
    console.log("Audit finished, adding report...");
    result.websiteId = Number(id);
    
    try {
      await addReport(result);
      console.log("Report added.");
    } catch (dbErr) {
      console.error("DB Error in addReport:", dbErr.message);
      return;
    }

    try {
      await updateWebsite(id, {
        lastRun: new Date().toISOString(),
        lastScores: result.scores,
        lastStatus: result.errors.length > 0 ? "ERROR" : "OK",
      });
      console.log("Website updated.");
    } catch (dbErr) {
      console.error("DB Error in updateWebsite:", dbErr.message);
      return;
    }

  } catch (err) {
    console.error("General error:", err);
  }
}

test();
