import React from "react";

export default function DashboardSummary({ websites }) {
  if (!websites || websites.length === 0) return null;

  const sitesWithScores = websites.filter((s) => s.lastScores);
  const totalSites = websites.length;

  // Average SEO score
  const avgSeo =
    sitesWithScores.length > 0
      ? Math.round(
          sitesWithScores.reduce(
            (sum, s) => sum + (s.lastScores?.seo || 0),
            0,
          ) / sitesWithScores.length,
        )
      : 0;

  // Average Performance score
  const avgPerf =
    sitesWithScores.length > 0
      ? Math.round(
          sitesWithScores.reduce(
            (sum, s) => sum + (s.lastScores?.performance || 0),
            0,
          ) / sitesWithScores.length,
        )
      : 0;

  // Sites needing attention (SEO < 70)
  const needsAttention = sitesWithScores.filter(
    (s) => (s.lastScores?.seo || 0) < 70,
  ).length;

  // Latest audit
  const latestRun = websites
    .filter((s) => s.lastRun)
    .sort((a, b) => new Date(b.lastRun) - new Date(a.lastRun))[0];

  const getScoreColor = (score) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreBg = (score) => {
    if (score >= 90)
      return "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20";
    if (score >= 70)
      return "from-yellow-500/10 to-yellow-500/5 border-yellow-500/20";
    if (score >= 50)
      return "from-orange-500/10 to-orange-500/5 border-orange-500/20";
    return "from-red-500/10 to-red-500/5 border-red-500/20";
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      {/* Total Sites */}
      <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-2xl p-5 text-center">
        <div className="text-3xl font-extrabold text-cyan-400 mb-1">
          {totalSites}
        </div>
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          Sites Tracked
        </div>
      </div>

      {/* Avg SEO Score */}
      <div
        className={`bg-gradient-to-br ${getScoreBg(avgSeo)} border rounded-2xl p-5 text-center`}
      >
        <div
          className={`text-3xl font-extrabold ${getScoreColor(avgSeo)} mb-1`}
        >
          {avgSeo}
        </div>
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          Avg SEO Score
        </div>
      </div>

      {/* Avg Performance */}
      <div
        className={`bg-gradient-to-br ${getScoreBg(avgPerf)} border rounded-2xl p-5 text-center`}
      >
        <div
          className={`text-3xl font-extrabold ${getScoreColor(avgPerf)} mb-1`}
        >
          {avgPerf}
        </div>
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          Avg Performance
        </div>
      </div>

      {/* Needs Attention */}
      <div
        className={`bg-gradient-to-br ${
          needsAttention > 0
            ? "from-red-500/10 to-red-500/5 border-red-500/20"
            : "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
        } border rounded-2xl p-5 text-center`}
      >
        <div
          className={`text-3xl font-extrabold ${
            needsAttention > 0 ? "text-red-400" : "text-emerald-400"
          } mb-1`}
        >
          {needsAttention > 0 ? needsAttention : "✓"}
        </div>
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          {needsAttention > 0 ? "Need Attention" : "All Healthy"}
        </div>
        {latestRun && (
          <div className="text-[10px] text-slate-600 mt-2">
            Last audit: {new Date(latestRun.lastRun).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
