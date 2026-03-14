import React, { useState, useEffect } from "react";

import { API_BASE } from "../config.js";

export default function AlertsBanner() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchAlerts();
    // Poll every 30 seconds for new alerts
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts`);
      const data = await res.json();
      if (Array.isArray(data)) setAlerts(data);
    } catch {
      // Silently fail
    }
  };

  const dismissAlert = async (id) => {
    try {
      await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => String(a.id) !== String(id)));
    } catch {
      // Silently fail
    }
  };

  const dismissAll = async () => {
    try {
      await fetch(`${API_BASE}/alerts`, { method: "DELETE" });
      setAlerts([]);
    } catch {
      // Silently fail
    }
  };

  const getCatLabel = (cat) => {
    const labels = {
      performance: "Performance",
      accessibility: "Accessibility",
      bestPractices: "Best Practices",
      seo: "SEO",
    };
    return labels[cat] || cat;
  };

  if (alerts.length === 0) return null;

  return (
    <div className="mb-8 bg-linear-to-r from-red-950/60 to-amber-950/40 border border-red-500/30 rounded-2xl p-5 shadow-xl shadow-red-500/5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-red-400 font-bold flex items-center gap-2 text-lg">
          <span className="text-2xl animate-pulse">🔔</span>
          Score Drop Alerts
          <span className="bg-red-500/20 text-red-300 text-xs px-2.5 py-1 rounded-full font-bold">
            {alerts.length}
          </span>
        </h3>
        <button
          onClick={dismissAll}
          className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
        >
          Dismiss All
        </button>
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3 border border-red-500/10 hover:border-red-500/30 transition group"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Drop indicator */}
              <div className="flex flex-col items-center">
                <span className="text-red-400 font-bold text-lg">
                  ↓{alert.drop}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  pts
                </span>
              </div>

              {/* Info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white truncate text-sm">
                    {alert.siteName}
                  </span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                    {getCatLabel(alert.category)}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span className="text-green-400">{alert.oldScore}</span>
                  <span>→</span>
                  <span className="text-red-400">{alert.newScore}</span>
                  <span className="text-slate-600">•</span>
                  <span>{new Date(alert.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-slate-600 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition ml-2"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
