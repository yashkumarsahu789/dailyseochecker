import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getAnalyticsData } from "../utils/firestore.js";

export default function AnalyticsTab({ selectedSite }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    if (selectedSite?.id) {
      setLoading(true);
      setError(null);
      getAnalyticsData(selectedSite.id)
        .then((d) => {
          if (!d) throw new Error("No data found");
          setData(d);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [selectedSite?.id]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 animate-pulse">📊</div>
        <p className="text-slate-400 text-lg">Analyzing your website...</p>
        <p className="text-slate-500 text-sm mt-2">
          Crunching traffic, bounce rate, and improvement data
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-xl text-center">
        <p className="text-lg font-bold mb-2">Failed to load analytics</p>
        <p className="text-sm">{error}</p>
        <p className="text-xs text-slate-500 mt-2">
          Run an audit first to generate data
        </p>
      </div>
    );
  }

  if (!data) return null;

  const {
    trafficEstimate: traffic,
    bounceAnalysis: bounce,
    uxScore: ux,
    exitAnalysis: exit,
    scoreTrends: trends,
    uptimeStats: uptime,
    keywordPerformance: keywords,
    backlinkHealth: backlinks,
    improvements,
  } = data;

  const sectionTabs = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "bounce", icon: "🚪", label: "Bounce Analysis" },
    { id: "exits", icon: "🔄", label: "Exit Points" },
    { id: "trends", icon: "📈", label: "Trends" },
    { id: "improve", icon: "💡", label: "Improvements" },
  ];

  const riskColors = {
    critical: "text-red-400",
    high: "text-red-400",
    warning: "text-amber-400",
    medium: "text-amber-400",
    low: "text-green-400",
    good: "text-green-400",
    unknown: "text-slate-400",
  };

  const riskBg = {
    critical: "bg-red-500/10 border-red-500/30",
    high: "bg-red-500/10 border-red-500/30",
    warning: "bg-amber-500/10 border-amber-500/30",
    medium: "bg-amber-500/10 border-amber-500/30",
    low: "bg-green-500/10 border-green-500/30",
    good: "bg-green-500/10 border-green-500/30",
    unknown: "bg-slate-500/10 border-slate-500/30",
  };

  return (
    <div>
      {/* Section Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeSection === tab.id
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════ OVERVIEW ═══════ */}
      {activeSection === "overview" && (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              icon="👥"
              label="Est. Monthly Visitors"
              value={traffic.estimatedMonthlyVisits.toLocaleString()}
              color="text-blue-400"
              sublabel={`~${traffic.estimatedDailyVisits}/day`}
            />
            <MetricCard
              icon="📉"
              label="Est. Bounce Rate"
              value={
                bounce.estimatedBounceRate !== null
                  ? `${bounce.estimatedBounceRate}%`
                  : "—"
              }
              color={riskColors[bounce.riskLevel]}
              sublabel={
                bounce.riskLevel !== "unknown"
                  ? bounce.riskLevel.toUpperCase()
                  : ""
              }
            />
            <MetricCard
              icon="⭐"
              label="UX Score"
              value={`${ux.score}/100`}
              color={
                ux.score >= 80
                  ? "text-green-400"
                  : ux.score >= 50
                    ? "text-amber-400"
                    : "text-red-400"
              }
              sublabel={ux.level}
            />
            <MetricCard
              icon="📡"
              label="Uptime"
              value={`${uptime.uptimePercent}%`}
              color={
                uptime.uptimePercent >= 99
                  ? "text-green-400"
                  : uptime.uptimePercent >= 95
                    ? "text-amber-400"
                    : "text-red-400"
              }
              sublabel={`${uptime.avgResponseTime}ms avg`}
            />
          </div>

          {/* Traffic Sources Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-lg">
                  🔑
                </span>
                Organic Search Traffic
              </h3>
              <div className="space-y-3">
                <StatRow
                  label="Keywords Ranked"
                  value={`${traffic.rankedKeywords} / ${traffic.totalKeywords}`}
                />
                <StatRow label="Top 3 Positions" value={traffic.top3Keywords} />
                <StatRow
                  label="Top 10 Positions"
                  value={traffic.top10Keywords}
                />
                <StatRow
                  label="Traffic Quality"
                  value={`${traffic.qualityScore}/100`}
                  color={
                    traffic.qualityScore >= 60
                      ? "text-green-400"
                      : traffic.qualityScore >= 30
                        ? "text-amber-400"
                        : "text-red-400"
                  }
                />
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-lg">
                  🔗
                </span>
                Referral Traffic (Backlinks)
              </h3>
              <div className="space-y-3">
                <StatRow label="Active Backlinks" value={backlinks.active} />
                <StatRow
                  label="Unique Domains"
                  value={backlinks.uniqueDomains}
                />
                <StatRow
                  label="Recent Gains (30d)"
                  value={`+${backlinks.recentGains}`}
                  color="text-green-400"
                />
                <StatRow
                  label="Recent Losses (30d)"
                  value={`-${backlinks.recentLosses}`}
                  color={
                    backlinks.recentLosses > 0
                      ? "text-red-400"
                      : "text-slate-400"
                  }
                />
              </div>
            </div>
          </div>

          {/* UX Score Breakdown */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5 mb-6">
            <h3 className="text-sm font-bold text-slate-300 mb-4">
              ✨ User Experience Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(ux.breakdown).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-slate-900/50 rounded-xl p-3 text-center"
                >
                  <div
                    className={`text-2xl font-black mb-1 ${val >= 80 ? "text-green-400" : val >= 50 ? "text-amber-400" : "text-red-400"}`}
                  >
                    {val}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                  <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`h-full rounded-full ${val >= 80 ? "bg-green-500" : val >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════ BOUNCE ANALYSIS ═══════ */}
      {activeSection === "bounce" && (
        <>
          {/* Bounce Rate Gauge */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 mb-6 text-center">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
              Estimated Bounce Rate
            </h3>
            <div
              className={`text-7xl font-black mb-2 ${riskColors[bounce.riskLevel]}`}
            >
              {bounce.estimatedBounceRate !== null
                ? `${bounce.estimatedBounceRate}%`
                : "—"}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Based on {bounce.factors.length} detected issues that cause
              visitors to leave
            </p>
            <div className="w-full max-w-md mx-auto bg-slate-700 rounded-full h-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ${bounce.estimatedBounceRate > 70 ? "bg-gradient-to-r from-red-500 to-red-400" : bounce.estimatedBounceRate > 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" : bounce.estimatedBounceRate > 35 ? "bg-gradient-to-r from-yellow-500 to-yellow-400" : "bg-gradient-to-r from-green-500 to-green-400"}`}
                style={{
                  width: `${bounce.estimatedBounceRate || 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1 max-w-md mx-auto">
              <span>0% (Perfect)</span>
              <span>35% (Good)</span>
              <span>50%+</span>
              <span>70%+ (Bad)</span>
            </div>
          </div>

          {/* Why Users Leave */}
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-red-500 rounded-full" />
            🚪 Why Visitors Leave Your Site
          </h3>
          {bounce.factors.length > 0 ? (
            <div className="space-y-3 mb-6">
              {bounce.factors.map((f, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{f.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm">
                          {f.factor}
                        </span>
                        <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                          {f.impact} bounce rate
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{f.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 text-green-300 p-6 rounded-xl text-center mb-6">
              ✅ No major bounce rate factors detected!
            </div>
          )}

          {/* Positive Factors */}
          {bounce.goodFactors && bounce.goodFactors.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-6 bg-green-500 rounded-full" />
                What's Keeping Users
              </h3>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-2 mb-6">
                {bounce.goodFactors.map((g, i) => (
                  <p key={i} className="text-sm text-green-300">
                    {g}
                  </p>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════ EXIT POINTS ═══════ */}
      {activeSection === "exits" && (
        <>
          {/* Exit Risk Score */}
          <div
            className={`rounded-2xl border p-6 mb-6 text-center ${riskBg[exit.riskLevel]}`}
          >
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
              Exit Risk Score
            </h3>
            <div
              className={`text-6xl font-black mb-2 ${riskColors[exit.riskLevel]}`}
            >
              {exit.riskScore}
              <span className="text-2xl">/100</span>
            </div>
            <p className="text-xs text-slate-500">
              {exit.riskLevel === "good"
                ? "Low exit risk — users are finding what they need"
                : exit.riskLevel === "warning"
                  ? "Some exit issues — users dropping off due to navigation problems"
                  : "High exit risk — users are leaving because of critical issues"}
            </p>
          </div>

          {/* Exit Factors */}
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-amber-500 rounded-full" />
            🔄 Where & Why Users Drop Off
          </h3>
          {exit.factors.length > 0 ? (
            <div className="space-y-3">
              {exit.factors.map((f, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl border border-slate-700 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{f.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {f.area}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            f.severity === "high"
                              ? "bg-red-500/20 text-red-300 border-red-500/30"
                              : f.severity === "medium"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-slate-600/30 text-slate-400 border-slate-500/30"
                          }`}
                        >
                          {f.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">
                        {f.description}
                      </p>
                      <div className="text-xs text-cyan-300/80 flex items-start gap-1.5">
                        <span className="shrink-0">💡</span>
                        <span>{f.fix}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 text-green-300 p-6 rounded-xl text-center">
              ✅ No major exit issues detected — your site navigation is good!
            </div>
          )}
        </>
      )}

      {/* ═══════ TRENDS ═══════ */}
      {activeSection === "trends" && (
        <>
          {/* Trend Direction */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-300">
                📈 Score Trends
              </h3>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  trends.trend === "improving"
                    ? "bg-green-500/10 text-green-400 border-green-500/30"
                    : trends.trend === "declining"
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-slate-600/30 text-slate-400 border-slate-500/30"
                }`}
              >
                {trends.trend === "improving"
                  ? "📈 Improving"
                  : trends.trend === "declining"
                    ? "📉 Declining"
                    : "➡️ Stable"}
              </span>
            </div>

            {/* Score Changes */}
            {trends.changes && Object.keys(trends.changes).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {Object.entries(trends.changes).map(([key, c]) => (
                  <div
                    key={key}
                    className="bg-slate-900/50 rounded-xl p-3 text-center"
                  >
                    <div className="text-[10px] text-slate-500 uppercase mb-2 tracking-wider">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {c.current}
                    </div>
                    {c.change !== 0 && (
                      <div
                        className={`text-xs font-bold mt-1 ${c.change > 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {c.change > 0 ? "▲" : "▼"} {Math.abs(c.change)} pts
                      </div>
                    )}
                    {c.change === 0 && (
                      <div className="text-xs text-slate-500 mt-1">—</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Trend Chart */}
            {trends.history && trends.history.length > 1 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="seo"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="SEO"
                    />
                    <Line
                      type="monotone"
                      dataKey="performance"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Performance"
                    />
                    <Line
                      type="monotone"
                      dataKey="accessibility"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Accessibility"
                    />
                    <Line
                      type="monotone"
                      dataKey="bestPractices"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Best Practices"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {(!trends.history || trends.history.length <= 1) && (
              <div className="text-center py-8 text-slate-500 text-sm">
                Need at least 2 audits to show trend chart. Run more audits!
              </div>
            )}
          </div>

          {/* Keyword Trends */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5">
            <h3 className="text-sm font-bold text-slate-300 mb-4">
              🔑 Keyword Rankings
            </h3>
            <p className="text-xs text-slate-500 mb-4">{keywords.summary}</p>
            {keywords.keywords.length > 0 ? (
              <div className="space-y-2">
                {keywords.keywords.slice(0, 10).map((kw, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-300 truncate flex-1">
                      {kw.keyword}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-bold text-sm ${kw.currentPosition > 0 ? (kw.currentPosition <= 3 ? "text-green-400" : kw.currentPosition <= 10 ? "text-cyan-400" : "text-amber-400") : "text-slate-500"}`}
                      >
                        {kw.currentPosition > 0
                          ? `#${kw.currentPosition}`
                          : "—"}
                      </span>
                      {kw.direction === "up" && (
                        <span className="text-green-400 text-xs font-bold">
                          ▲{kw.change}
                        </span>
                      )}
                      {kw.direction === "down" && (
                        <span className="text-red-400 text-xs font-bold">
                          ▼{Math.abs(kw.change)}
                        </span>
                      )}
                      {kw.direction === "stable" && (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-sm">
                No keywords tracked. Add keywords in the Keywords tab.
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ IMPROVEMENTS ═══════ */}
      {activeSection === "improve" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              💡 Improvement Suggestions
            </h3>
            <span className="text-xs text-slate-500">
              {improvements.length} suggestion(s) based on your data
            </span>
          </div>

          {improvements.length > 0 ? (
            <div className="space-y-4">
              {improvements.map((imp, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5 hover:border-slate-600 transition"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-2xl shrink-0">
                      {imp.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {imp.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            imp.priority === "high"
                              ? "bg-red-500/20 text-red-300 border-red-500/30"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {imp.priority.toUpperCase()} PRIORITY
                        </span>
                        <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded bg-slate-700/50">
                          {imp.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">
                        {imp.description}
                      </p>
                      <div className="space-y-1.5">
                        {imp.actions.map((action, j) => (
                          <div
                            key={j}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="text-cyan-400 shrink-0 mt-0.5">
                              →
                            </span>
                            <span className="text-slate-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 text-green-300 p-8 rounded-xl text-center">
              <div className="text-4xl mb-3">🎉</div>
              <p className="font-bold text-lg mb-1">Everything looks great!</p>
              <p className="text-sm text-green-400/70">
                No major improvements needed. Keep up the good work!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Reusable Components ───

function MetricCard({ icon, label, value, color, sublabel }) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5 text-center hover:border-slate-600 transition">
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-3xl font-black mb-1 ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      {sublabel && (
        <div className="text-[10px] text-slate-600 mt-1">{sublabel}</div>
      )}
    </div>
  );
}

function StatRow({ label, value, color = "text-white" }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 bg-slate-900/30 rounded-lg">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
