import nodemailer from "nodemailer";
import { readDb } from "./db.js";

// ============ EMAIL SERVICE ============

function getTransporter() {
  // Note: this is now async-compatible but we call readDb sync-style
  // since readDb returns the full db object
  return readDb().then((db) => {
    const settings = db.settings || {};
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      return null;
    }
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });
  });
}

async function getEmailTo() {
  const db = await readDb();
  return (db.settings || {}).emailTo || "";
}

export async function sendAlertEmail(alerts) {
  const transporter = await getTransporter();
  const emailTo = await getEmailTo();
  if (!transporter || !emailTo) return;

  const alertRows = alerts
    .map(
      (a) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${a.siteName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:${a.type === "downtime" ? "#ef4444" : "#f97316"}">${a.type === "downtime" ? "🔴 DOWN" : "⚠️ Score Drop"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${a.message}</td>
        </tr>`,
    )
    .join("");

  await transporter.sendMail({
    from: `"SEO Dashboard" <${transporter.options?.auth?.user}>`,
    to: emailTo,
    subject: `🚨 SEO Alert: ${alerts.length} issue(s) detected`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px">
        <h2 style="color:#06b6d4;margin-bottom:16px">🚨 SEO Dashboard Alerts</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr style="background:#1e293b">
              <th style="padding:8px;text-align:left;color:#94a3b8">Site</th>
              <th style="padding:8px;text-align:left;color:#94a3b8">Type</th>
              <th style="padding:8px;text-align:left;color:#94a3b8">Details</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>
        <p style="color:#64748b;font-size:12px">— SEO Automation Dashboard</p>
      </div>
    `,
  });
  console.log(`📧 Alert email sent to ${emailTo}`);
}

export async function sendWeeklyReport() {
  const transporter = await getTransporter();
  const emailTo = await getEmailTo();
  if (!transporter || !emailTo) return;

  const db = await readDb();
  const sites = db.websites || [];
  if (sites.length === 0) return;

  const avgSeo = Math.round(
    sites.reduce((sum, s) => sum + (s.lastScores?.seo || 0), 0) / sites.length,
  );
  const avgPerf = Math.round(
    sites.reduce((sum, s) => sum + (s.lastScores?.performance || 0), 0) /
      sites.length,
  );
  const needsAttention = sites.filter(
    (s) =>
      (s.lastScores?.seo || 0) < 80 || (s.lastScores?.performance || 0) < 80,
  ).length;

  const siteRows = sites
    .map(
      (s) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #334155">${new URL(s.url).hostname}</td>
          <td style="padding:8px;border-bottom:1px solid #334155;color:${(s.lastScores?.seo || 0) >= 80 ? "#22c55e" : "#ef4444"}">${s.lastScores?.seo ?? "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #334155;color:${(s.lastScores?.performance || 0) >= 80 ? "#22c55e" : "#ef4444"}">${s.lastScores?.performance ?? "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #334155">${s.lastRun ? new Date(s.lastRun).toLocaleDateString() : "Never"}</td>
        </tr>`,
    )
    .join("");

  const weekAlerts = (db.alerts || []).filter(
    (a) =>
      !a.dismissed &&
      new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );

  await transporter.sendMail({
    from: `"SEO Dashboard" <${transporter.options?.auth?.user}>`,
    to: emailTo,
    subject: `📊 Weekly SEO Report — Avg SEO: ${avgSeo} | Avg Perf: ${avgPerf}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px">
        <h2 style="color:#06b6d4;margin-bottom:20px">📊 Weekly SEO Report</h2>
        <div style="display:flex;gap:12px;margin-bottom:20px">
          <div style="flex:1;background:#1e293b;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:#06b6d4">${sites.length}</div>
            <div style="color:#94a3b8;font-size:12px">Sites</div>
          </div>
          <div style="flex:1;background:#1e293b;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:${avgSeo >= 80 ? "#22c55e" : "#ef4444"}">${avgSeo}</div>
            <div style="color:#94a3b8;font-size:12px">Avg SEO</div>
          </div>
          <div style="flex:1;background:#1e293b;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:${avgPerf >= 80 ? "#22c55e" : "#ef4444"}">${avgPerf}</div>
            <div style="color:#94a3b8;font-size:12px">Avg Perf</div>
          </div>
          <div style="flex:1;background:#1e293b;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:${needsAttention > 0 ? "#f97316" : "#22c55e"}">${needsAttention}</div>
            <div style="color:#94a3b8;font-size:12px">Need Attention</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr style="background:#1e293b">
              <th style="padding:8px;text-align:left;color:#94a3b8">Site</th>
              <th style="padding:8px;text-align:left;color:#94a3b8">SEO</th>
              <th style="padding:8px;text-align:left;color:#94a3b8">Perf</th>
              <th style="padding:8px;text-align:left;color:#94a3b8">Last Audit</th>
            </tr>
          </thead>
          <tbody>${siteRows}</tbody>
        </table>
        ${
          weekAlerts.length > 0
            ? `<p style="color:#f97316;font-size:14px">⚠️ ${weekAlerts.length} alert(s) this week</p>`
            : `<p style="color:#22c55e;font-size:14px">✅ No alerts this week</p>`
        }
        <p style="color:#64748b;font-size:12px;margin-top:16px">— SEO Automation Dashboard</p>
      </div>
    `,
  });
  console.log(`📧 Weekly report sent to ${emailTo}`);
}

export async function sendTestEmail() {
  const transporter = await getTransporter();
  const emailTo = await getEmailTo();
  if (!transporter || !emailTo) {
    throw new Error("Email not configured. Set SMTP settings first.");
  }

  await transporter.sendMail({
    from: `"SEO Dashboard" <${transporter.options?.auth?.user}>`,
    to: emailTo,
    subject: "✅ SEO Dashboard Test Email",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px">
        <h2 style="color:#22c55e">✅ Email Configuration Working!</h2>
        <p style="color:#94a3b8">Your SEO Dashboard email notifications are properly configured.</p>
      </div>
    `,
  });
  console.log(`📧 Test email sent to ${emailTo}`);
}
