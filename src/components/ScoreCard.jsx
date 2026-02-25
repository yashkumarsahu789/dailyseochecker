import React from "react";

export function getScoreColor(score) {
  if (score == null) return "text-slate-500";
  if (score >= 90) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

export function formatScore(score) {
  return score != null ? Math.round(score) : "-";
}

export default function ScoreCard({ label, score }) {
  return (
    <div className="bg-slate-900/50 p-3 rounded-xl text-center border border-slate-700/30">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
        {formatScore(score)}
      </div>
    </div>
  );
}
