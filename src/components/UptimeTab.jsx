import React, { useState, useEffect } from "react";

import { getUptime } from "../utils/firestore.js";export default function UptimeTab({ selectedSite }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedSite) fetchUptime();
  }, [selectedSite]);

  const fetchUptime = async () => {
    setLoading(true);
    try {
      const data = await getUptime(selectedSite.id);
      if (Array.isArray(data)) setRecords(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalChecks = records.length;
  const upChecks = records.filter((r) => r.ok).length;
  const uptimePercent =
    totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(1) : "—";
  const avgResponseTime =
    totalChecks > 0
      ? Math.round(
          records
            .filter((r) => r.ok)
            .reduce((sum, r) => sum + r.responseTime, 0) /
            Math.max(upChecks, 1),
        )
      : 0;
  const lastCheck = records.length > 0 ? records[records.length - 1] : null;

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-4xl mb-4 animate-pulse">🔄</div>
        Loading uptime data...
      </div>
    );
  }

  return (
    <div>
      {/* Uptime Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Uptime % */}
        <div
          className={`rounded-2xl p-5 text-center border ${
            parseFloat(uptimePercent) >= 99
              ? "bg-emerald-500/10 border-emerald-500/20"
              : parseFloat(uptimePercent) >= 95
                ? "bg-yellow-500/10 border-yellow-500/20"
                : "bg-red-500/10 border-red-500/20"
          }`}
        >
          <div
            className={`text-3xl font-extrabold mb-1 ${
              parseFloat(uptimePercent) >= 99
                ? "text-emerald-400"
                : parseFloat(uptimePercent) >= 95
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {uptimePercent}%
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            Uptime (24h)
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-5 text-center">
          <div className="text-3xl font-extrabold text-cyan-400 mb-1">
            {avgResponseTime}
            <span className="text-sm font-normal text-slate-500">ms</span>
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            Avg Response
          </div>
        </div>

        {/* Total Checks */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
          <div className="text-3xl font-extrabold text-slate-300 mb-1">
            {totalChecks}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            Total Checks
          </div>
        </div>

        {/* Current Status */}
        <div
          className={`rounded-2xl p-5 text-center border ${
            lastCheck?.ok
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
        >
          <div
            className={`text-3xl font-extrabold mb-1 ${
              lastCheck?.ok ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {lastCheck?.ok ? "🟢" : lastCheck ? "🔴" : "⚪"}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            Current Status
          </div>
        </div>
      </div>

      {/* Uptime Timeline Bar */}
      {records.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
            Last 24h Timeline
          </h3>
          <div className="flex gap-[2px] h-8 rounded-lg overflow-hidden bg-slate-800 p-1">
            {records.map((r, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all hover:opacity-80 ${
                  r.ok ? "bg-emerald-500" : "bg-red-500"
                }`}
                title={`${new Date(r.timestamp).toLocaleTimeString()} — ${
                  r.ok ? `OK (${r.responseTime}ms)` : `DOWN (${r.status})`
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>
              {records.length > 0
                ? new Date(records[0].timestamp).toLocaleTimeString()
                : ""}
            </span>
            <span>
              {records.length > 0
                ? new Date(
                    records[records.length - 1].timestamp,
                  ).toLocaleTimeString()
                : ""}
            </span>
          </div>
        </div>
      )}

      {/* Recent Checks Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
          Recent Checks
        </h3>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {records.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <div className="text-4xl mb-2">📡</div>
                No uptime data yet. Checks run every 5 minutes.
              </div>
            ) : (
              [...records].reverse().map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-lg ${r.ok ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {r.ok ? "●" : "●"}
                    </span>
                    <span className="text-sm text-slate-300">
                      {new Date(r.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs font-mono px-2 py-1 rounded ${
                        r.ok
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {r.status || "TIMEOUT"}
                    </span>
                    <span className="text-xs text-slate-500 w-16 text-right">
                      {r.responseTime}ms
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
