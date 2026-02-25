import React, { useState, useEffect } from "react";

import { API_BASE } from "../config.js";

export default function SettingsPanel({ isOpen, onClose }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) fetchSettings();
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      const data = await res.json();
      setSettings(data);
    } catch {
      // Silently fail
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {settings ? (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Audit Schedule */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Daily Audit Schedule (Cron)
              </label>
              <input
                type="text"
                value={settings.cronSchedule}
                onChange={(e) => updateField("cronSchedule", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition"
                placeholder="0 0 * * *"
              />
              <p className="text-xs text-slate-500 mt-1">
                Default: <code className="text-cyan-400">0 0 * * *</code>{" "}
                (midnight daily)
              </p>
            </div>

            {/* Score Drop Threshold */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Score Drop Alert Threshold
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={settings.scoreDropThreshold}
                  onChange={(e) =>
                    updateField("scoreDropThreshold", parseInt(e.target.value))
                  }
                  className="flex-1 accent-red-500"
                />
                <span className="text-lg font-bold text-red-400 min-w-[40px] text-center">
                  {settings.scoreDropThreshold}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Alert when any score drops by this many points or more
              </p>
            </div>

            {/* Uptime Check Interval */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Uptime Check Interval (minutes)
              </label>
              <select
                value={settings.uptimeCheckInterval}
                onChange={(e) =>
                  updateField("uptimeCheckInterval", parseInt(e.target.value))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition"
              >
                <option value={1}>Every 1 minute</option>
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
              </select>
            </div>

            {/* Max Reports Per Site */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Max Reports Per Site
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={settings.maxReportsPerSite}
                  onChange={(e) =>
                    updateField("maxReportsPerSite", parseInt(e.target.value))
                  }
                  className="flex-1 accent-cyan-500"
                />
                <span className="text-lg font-bold text-cyan-400 min-w-[40px] text-center">
                  {settings.maxReportsPerSite}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Older reports beyond this limit are auto-deleted
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800 pt-2">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                📧 Email Notifications
              </h3>
            </div>

            {/* SMTP Host */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                SMTP Host
              </label>
              <input
                type="text"
                value={settings.smtpHost || ""}
                onChange={(e) => updateField("smtpHost", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder="smtp.gmail.com"
              />
            </div>

            {/* SMTP Port + User */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={settings.smtpPort || 587}
                  onChange={(e) =>
                    updateField("smtpPort", parseInt(e.target.value))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  SMTP User
                </label>
                <input
                  type="email"
                  value={settings.smtpUser || ""}
                  onChange={(e) => updateField("smtpUser", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* SMTP Password */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                SMTP Password / App Password
              </label>
              <input
                type="password"
                value={settings.smtpPass || ""}
                onChange={(e) => updateField("smtpPass", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder="••••••••"
              />
            </div>

            {/* Send To */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Send Alerts To
              </label>
              <input
                type="email"
                value={settings.emailTo || ""}
                onChange={(e) => updateField("emailTo", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder="your@email.com"
              />
            </div>

            {/* Email Actions */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/settings/test-email`, {
                      method: "POST",
                    });
                    const data = await res.json();
                    alert(res.ok ? "✅ Test email sent!" : `❌ ${data.error}`);
                  } catch {
                    alert("❌ Failed to send test email");
                  }
                }}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              >
                📧 Send Test
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${API_BASE}/settings/weekly-report`,
                      { method: "POST" },
                    );
                    const data = await res.json();
                    alert(
                      res.ok ? "✅ Weekly report sent!" : `❌ ${data.error}`,
                    );
                  } catch {
                    alert("❌ Failed");
                  }
                }}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              >
                📊 Send Report
              </button>
            </div>

            {/* ──── WHATSAPP ALERTS ──── */}
            <div className="border-t border-slate-800 pt-4 mt-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3">
                📱 WhatsApp Alerts (CallMeBot)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Phone (with country code)
                  </label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="+91XXXXXXXXXX"
                    value={settings.whatsappPhone || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappPhone: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    CallMeBot API Key
                  </label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Your API key"
                    value={settings.whatsappApiKey || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappApiKey: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    OR Custom Webhook URL
                  </label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="https://..."
                    value={settings.whatsappWebhookUrl || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappWebhookUrl: e.target.value,
                      })
                    }
                  />
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${API_BASE}/settings/test-whatsapp`,
                        { method: "POST" },
                      );
                      const data = await res.json();
                      alert(
                        res.ok ? "✅ WhatsApp test sent!" : `❌ ${data.error}`,
                      );
                    } catch {
                      alert("❌ Failed to send WhatsApp test");
                    }
                  }}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-green-700 hover:bg-green-600 text-white transition"
                >
                  📱 Send WhatsApp Test
                </button>
                <p className="text-[10px] text-slate-600">
                  Setup: Add +34 644 71 27 74 to contacts → send "I allow
                  callmebot to send me messages" → get API key
                </p>
              </div>
            </div>

            {/* ──── PDF REPORTS ──── */}
            <div className="border-t border-slate-800 pt-4 mt-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3">
                📄 PDF / HTML Reports
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/report/summary`);
                      const data = await res.json();
                      if (data.html) {
                        const w = window.open("", "_blank");
                        w.document.write(data.html);
                        w.document.close();
                      }
                    } catch {
                      alert("❌ Failed to generate report");
                    }
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                >
                  📊 Summary Report
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                Opens report in new tab. Use Ctrl+P to print/save as PDF.
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className={`w-full py-3 rounded-xl font-bold transition text-sm ${
                saved
                  ? "bg-emerald-600 text-white"
                  : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
              } disabled:opacity-50`}
            >
              {saved ? "✅ Saved!" : saving ? "Saving..." : "Save Settings"}
            </button>

            {/* Info */}
            <p className="text-[11px] text-slate-600 text-center">
              Cron/interval changes take effect after restart. Gmail users: use
              App Passwords.
            </p>
          </div>
        ) : (
          <div className="p-10 text-center text-slate-500">
            Loading settings...
          </div>
        )}
      </div>
    </div>
  );
}
