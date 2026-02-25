import React, { useState } from "react";
import { checklist } from "../constants/checklist";
import { checkMeta } from "../constants/checkMetadata";
import { getChecklistStatus } from "../utils/statusHelpers";
import { generatePdfReport } from "../utils/generatePdfReport";
import { getScoreColor } from "./ScoreCard";

export default function AuditTab({ reports, selectedSite }) {
  const [activeCatFilter, setActiveCatFilter] = useState(null);

  // Helper functions
  const impactWeight = { High: 3, Medium: 2, Low: 1 };
  const impactOrder = { High: 0, Medium: 1, Low: 2 };
  const sortByImpact = (arr) =>
    [...arr].sort(
      (a, b) =>
        (impactOrder[a.meta.impact] || 2) - (impactOrder[b.meta.impact] || 2),
    );

  const report = reports[0];

  if (!report) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-6 rounded-xl mb-8 text-center">
        No audit data available yet. Click "Run Audit" on the dashboard to
        generate a report.
      </div>
    );
  }

  // Calculate statuses for all items
  const itemStatuses = checklist.map((item) => ({
    ...item,
    status: getChecklistStatus(item, report),
    meta: checkMeta[item.task] || {
      impact: "Low",
      fix: "Review: Check and optimize.",
      why: "Minor SEO signal.",
      effort: "Low",
    },
  }));

  // Split into 2 groups (sorted by impact within each)
  const failed = sortByImpact(
    itemStatuses.filter((i) => i.status.automated && !i.status.pass),
  );
  const passed = sortByImpact(
    itemStatuses.filter((i) => i.status.automated && i.status.pass),
  );

  // Weighted scoring
  const allChecked = [...failed, ...passed];
  const maxScore = allChecked.reduce(
    (sum, i) => sum + (impactWeight[i.meta.impact] || 1),
    0,
  );
  const earnedScore = passed.reduce(
    (sum, i) => sum + (impactWeight[i.meta.impact] || 1),
    0,
  );
  const auditScore =
    maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;

  const allCategories = [...new Set(checklist.map((c) => c.cat))];

  const filterByCat = (items) =>
    activeCatFilter ? items.filter((i) => i.cat === activeCatFilter) : items;

  const filteredFailed = filterByCat(failed);
  const filteredPassed = filterByCat(passed);

  const impactColors = {
    High: "bg-red-500/20 text-red-300 border-red-500/30",
    Medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Low: "bg-slate-600/30 text-slate-400 border-slate-500/30",
  };

  const handleCopyMarkdown = (items, title) => {
    let md = `### ${title}\n\n`;
    md +=
      "| # | Check | Category | Impact | Status | What We Found | What To Do |\n";
    md += "|---|---|---|---|---|---|---|\n";
    items.forEach((item, i) => {
      const statusIcon = item.status.pass ? "✅" : "❌";
      const impactIcon =
        item.meta.impact === "High"
          ? "🔴"
          : item.meta.impact === "Medium"
            ? "🟡"
            : "⚪";
      md += `| ${i + 1} | **${item.task}** | ${item.cat} | ${impactIcon} ${item.meta.impact} | ${statusIcon} | ${item.status.details || "-"} | ${item.meta.fix || "-"} |\n`;
    });
    navigator.clipboard.writeText(md);
    alert(`${title} copied to clipboard!`);
  };

  const renderItem = (item) => (
    <div
      key={item.id}
      className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition group"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Impact Badge */}
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded border ${impactColors[item.meta.impact]}`}
            >
              {item.meta.impact === "High"
                ? "🔴"
                : item.meta.impact === "Medium"
                  ? "🟡"
                  : "⚪"}{" "}
              {item.meta.impact}
            </span>
            {/* Auto Badge */}
            <span className="text-[9px] font-bold bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
              AUTO
            </span>
            {/* Category Tag (clickable) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveCatFilter(
                  activeCatFilter === item.cat ? null : item.cat,
                );
              }}
              className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider cursor-pointer transition border ${activeCatFilter === item.cat ? "bg-cyan-600 text-white border-cyan-500" : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"}`}
            >
              {item.cat}
            </button>
            <h4 className="font-bold text-slate-200 text-sm">{item.task}</h4>
            {/* Why-it-matters tooltip */}
            {item.meta.why && (
              <span className="relative group/tip">
                <span className="text-slate-500 hover:text-cyan-400 cursor-help text-xs transition">
                  ℹ️
                </span>
                <span className="absolute left-0 bottom-full mb-1 hidden group-hover/tip:block bg-slate-900 text-slate-300 text-[11px] px-3 py-2 rounded-lg border border-slate-600 shadow-xl z-50 w-64 leading-relaxed whitespace-normal">
                  {item.meta.why}
                </span>
              </span>
            )}
          </div>
          {/* Details */}
          {item.status.details && (
            <div
              className={`text-xs p-2 rounded mt-1 border ${item.status.pass ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}
            >
              {item.status.details}
            </div>
          )}
          {/* Verb-first Recommendation (only for failed checks) */}
          {!item.status.pass && item.meta.fix && (
            <div className="text-xs text-amber-300/80 mt-2 flex items-start gap-1.5">
              <span className="shrink-0">💡</span>
              <span>{item.meta.fix}</span>
            </div>
          )}
        </div>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/50 transition whitespace-nowrap self-start"
          >
            Open Tool ↗
          </a>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Scores Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {["performance", "accessibility", "bestPractices", "seo"].map((key) => (
          <div
            key={key}
            className="bg-slate-800 p-6 rounded-2xl text-center border border-slate-700 shadow-lg"
          >
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </div>
            <div
              className={`text-4xl font-black ${getScoreColor(report.scores[key])}`}
            >
              {Math.round(report.scores[key] || 0)}
            </div>
          </div>
        ))}
      </div>

      {/* 42-Point Checklist - Grouped View */}
      <div>
        {/* Audit Score + Summary Bar */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div
                className={`text-6xl font-black ${auditScore >= 80 ? "text-emerald-400" : auditScore >= 50 ? "text-amber-400" : "text-rose-400"}`}
              >
                {auditScore}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Life Solve Now — 42-Point SEO Audit
                </h3>
                <p className="text-slate-400 text-sm">
                  {allChecked.length} checks completed · Weighted score (High=3,
                  Med=2, Low=1)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-full font-bold text-xs border border-red-500/20">
                ❌ {failed.length} Failed
              </div>
              <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full font-bold text-xs border border-green-500/20">
                ✅ {passed.length} Passed
              </div>
            </div>
          </div>
          {/* Score Bar */}
          <div className="mt-4 w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${auditScore >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : auditScore >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-rose-500 to-rose-400"}`}
              style={{ width: `${auditScore}%` }}
            />
          </div>
        </div>

        {/* Legend + Category Filter Bar */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Legend */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-800/40 px-5 py-3 rounded-xl border border-slate-700/40 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-slate-500 font-medium">Legend:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>{" "}
                <span className="text-slate-400">Failed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>{" "}
                <span className="text-slate-400">Passed</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
                AUTO
              </span>
              <span className="text-slate-500">= Automated</span>
              <span className="text-slate-600 mx-1">|</span>
              <span className="text-slate-500">ℹ️ = hover for SEO impact</span>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap bg-slate-800/40 px-5 py-3 rounded-xl border border-slate-700/40 text-xs">
            <span className="text-slate-500 font-medium mr-1">Filter:</span>
            <button
              onClick={() => setActiveCatFilter(null)}
              className={`px-3 py-1 rounded-full font-medium transition border ${!activeCatFilter ? "bg-cyan-600 text-white border-cyan-500" : "bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600 hover:text-white"}`}
            >
              All ({checklist.length})
            </button>
            {allCategories.map((cat) => {
              const count = itemStatuses.filter((i) => i.cat === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setActiveCatFilter(activeCatFilter === cat ? null : cat)
                  }
                  className={`px-3 py-1 rounded-full font-medium transition border ${activeCatFilter === cat ? "bg-cyan-600 text-white border-cyan-500" : "bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600 hover:text-white"}`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions Bar: Copy + PDF */}
        <div className="flex justify-end gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
            <button
              onClick={() => handleCopyMarkdown(failed, "Failed Checks")}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition border border-red-500/20"
            >
              📋 Copy Failed
            </button>
            <button
              onClick={() =>
                handleCopyMarkdown(
                  [...failed, ...passed],
                  "Full SEO Audit Report",
                )
              }
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition border border-slate-600"
            >
              📋 Copy Full Report
            </button>
          </div>

          <div className="w-px bg-slate-700 mx-1 hidden md:block"></div>

          <button
            onClick={() =>
              generatePdfReport(
                selectedSite,
                report,
                checklist,
                itemStatuses,
                auditScore,
              )
            }
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-2.5 rounded-xl font-bold transition shadow-lg shadow-purple-500/20 flex items-center gap-2 text-sm"
          >
            📄 Download PDF Report
          </button>
        </div>

        {/* ❌ FAILED Section */}
        {filteredFailed.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-red-500 rounded-full inline-block"></span>
              ❌ Failed — Needs Fixing ({filteredFailed.length})
            </h3>
            <div className="space-y-2">{filteredFailed.map(renderItem)}</div>
          </div>
        )}

        {/* ✅ PASSED Section */}
        {filteredPassed.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-green-500 rounded-full inline-block"></span>
              ✅ Passed — Looking Good ({filteredPassed.length})
            </h3>
            <div className="space-y-2">{filteredPassed.map(renderItem)}</div>
          </div>
        )}
      </div>
    </>
  );
}
