import { readDb } from "../firestore.js";

// ============ REPORT GENERATOR ============
// Generates HTML reports (no file system write in Cloud Functions)
// Returns HTML string that frontend can render or print-to-PDF

export async function generateReport(siteId) {
  const db = await readDb();
  const site = db.websites.find((w) => String(w.id) === String(siteId));
  if (!site) throw new Error("Site not found");

  const reports = (db.reports || [])
    .filter((r) => String(r.websiteId) === String(siteId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const latestReport = reports[0];
  const uptime = (db.uptime || []).filter(
    (u) => String(u.siteId) === String(siteId),
  );
  const backlinks = (db.backlinks || []).filter(
    (b) => String(b.siteId) === String(siteId) && b.active,
  );
  const keywords = site.keywords || [];
  const keywordRanks = (db.keywordRanks || []).filter(
    (r) => String(r.siteId) === String(siteId),
  );

  const hostname = new URL(site.url).hostname;
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const getColor = (score) => {
    if (score >= 90) return "#22c55e";
    if (score >= 70) return "#eab308";
    if (score >= 50) return "#f97316";
    return "#ef4444";
  };

  const uptimeChecks = uptime.length;
  const uptimeUp = uptime.filter((u) => u.status === "up").length;
  const uptimePercent =
    uptimeChecks > 0 ? ((uptimeUp / uptimeChecks) * 100).toFixed(1) : "—";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SEO Report — ${hostname}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #1e293b; }
    .header h1 { font-size: 28px; color: #06b6d4; margin-bottom: 8px; }
    .header p { color: #94a3b8; font-size: 14px; }
    .scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
    .score-card { background: #1e293b; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #334155; }
    .score-card .value { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
    .score-card .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; color: #06b6d4; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #1e293b; }
    .metric-row { display: flex; justify-content: space-between; padding: 10px 16px; background: #1e293b; border-radius: 8px; margin-bottom: 6px; }
    .metric-row .label { color: #94a3b8; }
    .metric-row .value { font-weight: 600; }
    .footer { text-align: center; color: #475569; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; background: #1e293b; }
    td { padding: 8px 12px; border-bottom: 1px solid #1e293b; font-size: 14px; }
    @media print { body { background: white; color: #1e293b; } .score-card, .metric-row, th { background: #f1f5f9; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 SEO Report</h1>
      <p><strong>${hostname}</strong> — ${date}</p>
      <p style="margin-top: 4px; font-size: 12px;">${site.url}</p>
    </div>
    <div class="scores">
      <div class="score-card">
        <div class="value" style="color: ${getColor(site.lastScores?.seo || 0)}">${site.lastScores?.seo ?? "—"}</div>
        <div class="label">SEO</div>
      </div>
      <div class="score-card">
        <div class="value" style="color: ${getColor(site.lastScores?.performance || 0)}">${site.lastScores?.performance ?? "—"}</div>
        <div class="label">Performance</div>
      </div>
      <div class="score-card">
        <div class="value" style="color: ${getColor(site.lastScores?.accessibility || 0)}">${site.lastScores?.accessibility ?? "—"}</div>
        <div class="label">Accessibility</div>
      </div>
      <div class="score-card">
        <div class="value" style="color: ${getColor(site.lastScores?.bestPractices || 0)}">${site.lastScores?.bestPractices ?? "—"}</div>
        <div class="label">Best Practices</div>
      </div>
    </div>
    <div class="section">
      <h2>📋 Overview</h2>
      <div class="metric-row"><span class="label">URL</span><span class="value">${site.url}</span></div>
      <div class="metric-row"><span class="label">Status</span><span class="value">${site.lastStatus || "PENDING"}</span></div>
      <div class="metric-row"><span class="label">Last Audit</span><span class="value">${site.lastRun ? new Date(site.lastRun).toLocaleString() : "Never"}</span></div>
      <div class="metric-row"><span class="label">Group</span><span class="value">${site.group || "Ungrouped"}</span></div>
      <div class="metric-row"><span class="label">Tags</span><span class="value">${(site.tags || []).map((t) => "#" + t).join(", ") || "None"}</span></div>
      ${site.notes ? `<div class="metric-row"><span class="label">Notes</span><span class="value">${site.notes}</span></div>` : ""}
    </div>
    <div class="section">
      <h2>📡 Uptime</h2>
      <div class="metric-row"><span class="label">Uptime %</span><span class="value" style="color: ${parseFloat(uptimePercent) >= 99 ? "#22c55e" : "#ef4444"}">${uptimePercent}%</span></div>
      <div class="metric-row"><span class="label">Total Checks</span><span class="value">${uptimeChecks}</span></div>
    </div>
    <div class="section">
      <h2>🔗 Backlinks (${backlinks.length} active)</h2>
      ${
        backlinks.length > 0
          ? `<table>
        <thead><tr><th>Source</th><th>Anchor Text</th><th>First Seen</th></tr></thead>
        <tbody>${backlinks
          .slice(0, 20)
          .map(
            (b) =>
              `<tr><td>${b.sourceDomain}</td><td>${b.anchorText}</td><td>${new Date(b.firstSeen).toLocaleDateString()}</td></tr>`,
          )
          .join("")}</tbody>
      </table>`
          : `<p style="color: #64748b; text-align: center; padding: 20px;">No backlinks detected yet</p>`
      }
    </div>
    <div class="section">
      <h2>🔑 Keywords (${keywords.length} tracked)</h2>
      ${
        keywords.length > 0
          ? `<table>
        <thead><tr><th>Keyword</th><th>Latest Rank</th></tr></thead>
        <tbody>${keywords
          .map((kw) => {
            const rank = keywordRanks
              .filter((r) => r.keyword === kw)
              .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            return `<tr><td>${kw}</td><td>${rank ? (rank.position > 0 ? "#" + rank.position : "Not found") : "—"}</td></tr>`;
          })
          .join("")}</tbody>
      </table>`
          : `<p style="color: #64748b; text-align: center; padding: 20px;">No keywords tracked</p>`
      }
    </div>
    <div class="footer">
      <p>Generated by SEO Automation Dashboard — ${date}</p>
      <p style="margin-top: 4px;">Print this page (Ctrl+P) to save as PDF</p>
    </div>
  </div>
</body>
</html>`;

  const filename = `seo-report_${hostname}_${Date.now()}.html`;
  console.log(`📄 Report generated: ${filename}`);
  return { filename, html };
}

export async function generateSummaryReport() {
  const db = await readDb();
  const sites = db.websites || [];
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const getColor = (score) => {
    if (score >= 90) return "#22c55e";
    if (score >= 70) return "#eab308";
    if (score >= 50) return "#f97316";
    return "#ef4444";
  };

  const avgSeo =
    sites.length > 0
      ? Math.round(
          sites.reduce((s, w) => s + (w.lastScores?.seo || 0), 0) /
            sites.length,
        )
      : 0;
  const avgPerf =
    sites.length > 0
      ? Math.round(
          sites.reduce((s, w) => s + (w.lastScores?.performance || 0), 0) /
            sites.length,
        )
      : 0;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SEO Summary Report — ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #1e293b; }
    .header h1 { font-size: 28px; color: #06b6d4; margin-bottom: 8px; }
    .header p { color: #94a3b8; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
    .sum-card { background: #1e293b; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #334155; }
    .sum-card .value { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
    .sum-card .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { text-align: left; padding: 10px 14px; color: #94a3b8; font-size: 11px; text-transform: uppercase; background: #1e293b; }
    td { padding: 10px 14px; border-bottom: 1px solid #1e293b; font-size: 14px; }
    .footer { text-align: center; color: #475569; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; }
    @media print { body { background: white; color: #1e293b; } .sum-card, th { background: #f1f5f9; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 SEO Summary Report</h1>
      <p>${date} — ${sites.length} sites tracked</p>
    </div>
    <div class="summary">
      <div class="sum-card">
        <div class="value" style="color: #06b6d4">${sites.length}</div>
        <div class="label">Total Sites</div>
      </div>
      <div class="sum-card">
        <div class="value" style="color: ${getColor(avgSeo)}">${avgSeo}</div>
        <div class="label">Avg SEO</div>
      </div>
      <div class="sum-card">
        <div class="value" style="color: ${getColor(avgPerf)}">${avgPerf}</div>
        <div class="label">Avg Performance</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>Site</th><th>SEO</th><th>Performance</th><th>Status</th><th>Last Audit</th></tr>
      </thead>
      <tbody>
        ${sites
          .map(
            (s) =>
              `<tr>
            <td><strong>${new URL(s.url).hostname}</strong></td>
            <td style="color: ${getColor(s.lastScores?.seo || 0)}">${s.lastScores?.seo ?? "—"}</td>
            <td style="color: ${getColor(s.lastScores?.performance || 0)}">${s.lastScores?.performance ?? "—"}</td>
            <td>${s.lastStatus || "PENDING"}</td>
            <td>${s.lastRun ? new Date(s.lastRun).toLocaleDateString() : "Never"}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="footer">
      <p>Generated by SEO Automation Dashboard — ${date}</p>
      <p style="margin-top: 4px;">Print this page (Ctrl+P) to save as PDF</p>
    </div>
  </div>
</body>
</html>`;

  const filename = `seo-summary_${Date.now()}.html`;
  console.log(`📄 Summary report generated: ${filename}`);
  return { filename, html };
}
