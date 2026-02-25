import axios from "axios";
import { readDb } from "../firestore.js";

// ============ WHATSAPP ALERT SERVICE ============

async function getWhatsAppConfig() {
  const db = await readDb();
  const settings = db.settings || {};
  return {
    phone: settings.whatsappPhone || "",
    apiKey: settings.whatsappApiKey || "",
    webhookUrl: settings.whatsappWebhookUrl || "",
  };
}

export async function sendWhatsAppAlert(alerts) {
  const config = await getWhatsAppConfig();

  if (config.webhookUrl) {
    try {
      await axios.post(config.webhookUrl, {
        message: formatAlertMessage(alerts),
        alerts: alerts,
      });
      console.log("📱 WhatsApp alert sent via webhook");
      return;
    } catch (err) {
      console.error("❌ WhatsApp webhook error:", err.message);
    }
  }

  if (config.phone && config.apiKey) {
    try {
      const message = encodeURIComponent(formatAlertMessage(alerts));
      const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phone}&text=${message}&apikey=${config.apiKey}`;
      await axios.get(url, { timeout: 10000 });
      console.log(`📱 WhatsApp alert sent to ${config.phone}`);
      return;
    } catch (err) {
      console.error("❌ WhatsApp CallMeBot error:", err.message);
    }
  }
}

export async function sendWhatsAppWeeklySummary() {
  const config = await getWhatsAppConfig();
  if (!config.phone && !config.webhookUrl) return;

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
    (s) => (s.lastScores?.seo || 0) < 80,
  ).length;

  const msg =
    `📊 *Weekly SEO Report*\n\n` +
    `Sites: ${sites.length}\n` +
    `Avg SEO: ${avgSeo}\n` +
    `Avg Perf: ${avgPerf}\n` +
    `Need Attention: ${needsAttention}\n\n` +
    sites
      .map(
        (s) =>
          `• ${new URL(s.url).hostname}: SEO ${s.lastScores?.seo ?? "—"} | Perf ${s.lastScores?.performance ?? "—"}`,
      )
      .join("\n");

  if (config.webhookUrl) {
    try {
      await axios.post(config.webhookUrl, { message: msg });
      console.log("📱 WhatsApp weekly summary sent via webhook");
    } catch (err) {
      console.error("❌ WhatsApp webhook error:", err.message);
    }
  } else if (config.phone && config.apiKey) {
    try {
      const encoded = encodeURIComponent(msg);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phone}&text=${encoded}&apikey=${config.apiKey}`;
      await axios.get(url, { timeout: 10000 });
      console.log(`📱 WhatsApp weekly summary sent to ${config.phone}`);
    } catch (err) {
      console.error("❌ WhatsApp CallMeBot error:", err.message);
    }
  }
}

export async function sendWhatsAppTest() {
  const config = await getWhatsAppConfig();
  if (!config.phone && !config.webhookUrl) {
    throw new Error(
      "WhatsApp not configured. Set phone + API key or webhook URL in Settings.",
    );
  }

  const msg = "✅ SEO Dashboard WhatsApp Test — Connection working!";

  if (config.webhookUrl) {
    await axios.post(config.webhookUrl, { message: msg });
  } else {
    const encoded = encodeURIComponent(msg);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phone}&text=${encoded}&apikey=${config.apiKey}`;
    await axios.get(url, { timeout: 10000 });
  }
  console.log("📱 WhatsApp test message sent");
}

function formatAlertMessage(alerts) {
  const header = `🚨 *SEO Alert: ${alerts.length} issue(s)*\n\n`;
  const body = alerts
    .map((a) => {
      if (a.type === "downtime") {
        return `🔴 *DOWN* — ${a.siteName}\n   ${a.message}`;
      }
      return `⚠️ *Score Drop* — ${a.siteName}\n   ${a.category}: ${a.oldScore} → ${a.newScore} (↓${a.drop})`;
    })
    .join("\n\n");
  return header + body;
}
