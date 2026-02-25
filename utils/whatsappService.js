import axios from "axios";
import { readDb } from "./scheduler.js";

// ============ WHATSAPP ALERT SERVICE ============
// Sends alerts via WhatsApp using CallMeBot or custom webhook
// Setup: https://www.callmebot.com/blog/free-api-whatsapp-messages/
//
// To setup CallMeBot:
// 1. Add phone number +34 644 71 27 74 to your contacts
// 2. Send "I allow callmebot to send me messages" via WhatsApp
// 3. You'll receive your API key
// 4. Enter phone + apikey in Settings panel

function getWhatsAppConfig() {
  const db = readDb();
  const settings = db.settings || {};
  return {
    phone: settings.whatsappPhone || "",
    apiKey: settings.whatsappApiKey || "",
    webhookUrl: settings.whatsappWebhookUrl || "", // Custom webhook alternative
  };
}

// ============ SEND WHATSAPP ALERT ============
export async function sendWhatsAppAlert(alerts) {
  const config = getWhatsAppConfig();

  // Method 1: Custom webhook (e.g., Twilio, WAHA, etc.)
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

  // Method 2: CallMeBot Free API
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

  // Not configured — skip silently
}

// ============ SEND WEEKLY SUMMARY VIA WHATSAPP ============
export async function sendWhatsAppWeeklySummary() {
  const config = getWhatsAppConfig();
  if (!config.phone && !config.webhookUrl) return;

  const db = readDb();
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

// ============ TEST WHATSAPP ============
export async function sendWhatsAppTest() {
  const config = getWhatsAppConfig();
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

// ============ FORMAT HELPERS ============
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
