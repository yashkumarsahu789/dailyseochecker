import React, { useState, useEffect } from "react";

import { API_BASE } from "../config.js";

export default function ActionPlanTab({ selectedSite }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkSuggestions, setLinkSuggestions] = useState([]);

  useEffect(() => {
    if (selectedSite) fetchPlan();
  }, [selectedSite]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const [planRes, linksRes] = await Promise.all([
        fetch(`${API_BASE}/websites/${selectedSite.id}/action-plan`),
        fetch(`${API_BASE}/link-suggestions`),
      ]);
      const planData = await planRes.json();
      const linksData = await linksRes.json();
      setPlan(planData);
      setLinkSuggestions(linksData || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-4xl mb-4 animate-pulse">🧠</div>
        Analyzing your site...
      </div>
    );
  }

  if (!plan || plan.actionPlan?.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
        <div className="text-5xl mb-4">
          {plan?.totalIssues === 0 ? "🎉" : "📋"}
        </div>
        <h3 className="text-xl font-bold text-slate-300 mb-2">
          {plan?.totalIssues === 0
            ? "All checks passed!"
            : "No audit data available"}
        </h3>
        <p className="text-slate-500 text-sm">
          {plan?.totalIssues === 0
            ? "Your site is in great shape. Focus on content and backlinks."
            : "Run an audit to generate your AI action plan."}
        </p>
      </div>
    );
  }

  const healthColors = {
    excellent: {
      bg: "from-emerald-500/10 to-emerald-500/5",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      emoji: "🟢",
    },
    good: {
      bg: "from-blue-500/10 to-blue-500/5",
      text: "text-blue-400",
      border: "border-blue-500/20",
      emoji: "🔵",
    },
    "needs-work": {
      bg: "from-amber-500/10 to-amber-500/5",
      text: "text-amber-400",
      border: "border-amber-500/20",
      emoji: "🟡",
    },
    critical: {
      bg: "from-red-500/10 to-red-500/5",
      text: "text-red-400",
      border: "border-red-500/20",
      emoji: "🔴",
    },
    unknown: {
      bg: "from-slate-500/10 to-slate-500/5",
      text: "text-slate-400",
      border: "border-slate-500/20",
      emoji: "⚪",
    },
  };

  const h = healthColors[plan.overallHealth] || healthColors.unknown;
  const impactEmoji = { High: "🔴", Medium: "🟡", Low: "⚪" };
  const effortEmoji = { Low: "⚡", Medium: "🔧", High: "🏗️" };

  return (
    <div>
      {/* Health Overview */}
      <div
        className={`bg-gradient-to-br ${h.bg} border ${h.border} rounded-2xl p-6 mb-8`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{h.emoji}</span>
              <h3 className={`text-2xl font-extrabold ${h.text} capitalize`}>
                {plan.overallHealth}
              </h3>
            </div>
            <p className="text-slate-400 text-sm">{plan.summary}</p>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-white">
                {plan.avgScore}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">
                Avg Score
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">
                {plan.totalIssues}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Issues</div>
            </div>
            {plan.estimatedGain > 0 && (
              <div>
                <div className="text-2xl font-bold text-emerald-400">
                  +{plan.estimatedGain}
                </div>
                <div className="text-[10px] text-slate-500 uppercase">
                  Est. Gain
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top 3 Priority Fixes */}
      <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
        🎯 Top 3 Priority Fixes
        <span className="text-[10px] font-normal text-slate-500">
          (sorted by Impact × Quick Win score)
        </span>
      </h3>

      <div className="space-y-4 mb-8">
        {plan.actionPlan.map((item) => (
          <div
            key={item.priority}
            className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden hover:border-slate-500 transition"
          >
            {/* Header bar with priority number */}
            <div
              className={`flex items-center gap-4 px-5 py-4 ${
                item.priority === 1
                  ? "bg-gradient-to-r from-red-600/20 to-orange-600/10 border-b border-red-500/20"
                  : item.priority === 2
                    ? "bg-gradient-to-r from-amber-600/15 to-yellow-600/5 border-b border-amber-500/20"
                    : "bg-gradient-to-r from-blue-600/10 to-cyan-600/5 border-b border-blue-500/20"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                  item.priority === 1
                    ? "bg-red-600 text-white"
                    : item.priority === 2
                      ? "bg-amber-600 text-white"
                      : "bg-blue-600 text-white"
                }`}
              >
                {item.priority}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-base">{item.task}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded uppercase">
                    {item.category}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {impactEmoji[item.impact]} {item.impact} Impact
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {effortEmoji[item.effort]} {item.effort} Effort
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Instruction */}
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-sm shrink-0">💡</span>
                <p className="text-sm text-emerald-300 font-medium">
                  {item.instruction}
                </p>
              </div>

              {/* Why */}
              <div className="flex items-start gap-2">
                <span className="text-slate-500 text-sm shrink-0">📖</span>
                <p className="text-xs text-slate-400">{item.reason}</p>
              </div>

              {/* Details */}
              {item.details && (
                <div className="bg-slate-900/50 rounded-xl p-3 text-xs text-slate-500 border border-slate-700/50">
                  🔍 {item.details}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Next in Queue */}
      {plan.nextSteps && plan.nextSteps.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
            📋 Next in Queue
          </h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            {plan.nextSteps.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b border-slate-700/30 last:border-0"
              >
                <span className="text-xs text-slate-600 font-mono w-5">
                  #{i + 4}
                </span>
                <span className="text-sm text-slate-400">{item.task}</span>
                <span className="text-[10px] bg-slate-700/50 text-slate-500 px-2 py-0.5 rounded ml-auto">
                  {item.category}
                </span>
                <span className="text-[10px] text-slate-600">
                  {impactEmoji[item.impact]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Link Suggestions */}
      {linkSuggestions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
            🔗 Internal Link Suggestions
          </h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            {linkSuggestions.map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 last:border-0 hover:bg-slate-700/10 transition"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium text-cyan-400 truncate">
                    {link.from}
                  </span>
                  <span className="text-slate-600 shrink-0">→</span>
                  <span className="text-sm font-medium text-purple-400 truncate">
                    {link.to}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 shrink-0 max-w-xs text-right">
                  {link.reason}
                </div>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded shrink-0 ${
                    link.strength === "strong"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {link.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-slate-600 text-center">
        Action plan generated using Impact × Quick Win scoring. Fix #1 first for
        maximum ranking boost.
      </div>
    </div>
  );
}
