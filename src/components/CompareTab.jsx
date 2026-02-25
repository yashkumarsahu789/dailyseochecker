import React, { useState } from "react";

export default function CompareTab({ reports, selectedSite, apiBase }) {
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorReport, setCompetitorReport] = useState(null);
  const [comparingLoading, setComparingLoading] = useState(false);

  const handleCompare = async () => {
    if (!competitorUrl) return;
    setComparingLoading(true);
    setCompetitorReport(null);
    try {
      const res = await fetch(`${apiBase}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: competitorUrl }),
      });
      const data = await res.json();
      setCompetitorReport(data);
    } catch (err) {
      console.error("Compare failed:", err);
    } finally {
      setComparingLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        ⚔️ Competitor Analysis
        <span className="text-sm font-normal text-slate-400">
          — See how you stack up
        </span>
      </h3>

      {/* Competitor URL Input */}
      <div className="flex gap-3 mb-8">
        <input
          type="url"
          value={competitorUrl}
          onChange={(e) => setCompetitorUrl(e.target.value)}
          placeholder="Enter competitor URL (e.g., https://competitor.com)"
          className="flex-1 bg-slate-800 border border-slate-700 text-white px-5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500"
        />
        <button
          onClick={handleCompare}
          disabled={comparingLoading || !competitorUrl}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2"
        >
          {comparingLoading ? (
            <>
              <span className="animate-spin">⏳</span> Scanning...
            </>
          ) : (
            <>⚔️ Compare</>
          )}
        </button>
      </div>

      {/* Comparison Results */}
      {competitorReport && reports[0] && (
        <div className="space-y-6">
          {/* Side by Side Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Your Site */}
            <div className="bg-slate-800 rounded-2xl border border-cyan-500/30 p-6">
              <h4 className="text-cyan-400 font-bold text-sm uppercase tracking-wider mb-4">
                🏠 Your Site
              </h4>
              <div className="text-xs text-slate-400 mb-4 truncate">
                {selectedSite.url}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["performance", "accessibility", "bestPractices", "seo"].map(
                  (key) => (
                    <div
                      key={key}
                      className="text-center p-3 bg-slate-900 rounded-xl"
                    >
                      <div className="text-[10px] text-slate-500 uppercase">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                      <div
                        className={`text-2xl font-black mt-1 ${
                          reports[0].scores[key] >= 80
                            ? "text-green-400"
                            : reports[0].scores[key] >= 50
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {Math.round(reports[0].scores[key] || 0)}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Competitor */}
            <div className="bg-slate-800 rounded-2xl border border-orange-500/30 p-6">
              <h4 className="text-orange-400 font-bold text-sm uppercase tracking-wider mb-4">
                🎯 Competitor
              </h4>
              <div className="text-xs text-slate-400 mb-4 truncate">
                {competitorUrl}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["performance", "accessibility", "bestPractices", "seo"].map(
                  (key) => {
                    const yourScore = Math.round(reports[0].scores[key] || 0);
                    const theirScore = Math.round(
                      competitorReport.scores?.[key] || 0,
                    );
                    const winning = theirScore > yourScore;
                    return (
                      <div
                        key={key}
                        className="text-center p-3 bg-slate-900 rounded-xl"
                      >
                        <div className="text-[10px] text-slate-500 uppercase">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </div>
                        <div
                          className={`text-2xl font-black mt-1 ${
                            winning ? "text-red-400" : "text-green-400"
                          }`}
                        >
                          {theirScore}
                          {winning && <span className="text-xs ml-1">👑</span>}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          {/* Verdict */}
          {(() => {
            const yourAvg = Math.round(
              ["performance", "accessibility", "bestPractices", "seo"].reduce(
                (sum, k) => sum + (reports[0].scores[k] || 0),
                0,
              ) / 4,
            );
            const theirAvg = Math.round(
              ["performance", "accessibility", "bestPractices", "seo"].reduce(
                (sum, k) => sum + (competitorReport.scores?.[k] || 0),
                0,
              ) / 4,
            );
            const diff = yourAvg - theirAvg;
            return (
              <div
                className={`p-6 rounded-2xl border text-center ${
                  diff > 0
                    ? "bg-green-500/10 border-green-500/30"
                    : diff < 0
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-slate-800 border-slate-700"
                }`}
              >
                <div className="text-5xl mb-3">
                  {diff > 0 ? "🏆" : diff < 0 ? "⚠️" : "🤝"}
                </div>
                <p
                  className={`text-lg font-bold ${
                    diff > 0
                      ? "text-green-400"
                      : diff < 0
                        ? "text-red-400"
                        : "text-slate-300"
                  }`}
                >
                  {diff > 0
                    ? `You're winning by ${diff} points! Keep it up.`
                    : diff < 0
                      ? `Competitor leads by ${Math.abs(diff)} points. Time to optimize!`
                      : "It's a tie! Push ahead with fixes."}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Your avg: {yourAvg} vs Competitor avg: {theirAvg}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {!competitorReport && !comparingLoading && (
        <div className="bg-slate-800/50 border border-dashed border-slate-700 text-slate-400 p-12 rounded-2xl text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-semibold text-slate-300">
            Enter a competitor URL above
          </p>
          <p className="text-sm">
            We'll run a full audit on them and compare side-by-side.
          </p>
        </div>
      )}

      {comparingLoading && (
        <div className="bg-slate-800/50 border border-orange-500/20 text-orange-300 p-12 rounded-2xl text-center">
          <div className="text-5xl mb-4 animate-bounce">⚔️</div>
          <p className="text-lg font-semibold">Scanning competitor...</p>
          <p className="text-sm text-slate-400">
            This may take 30-60 seconds depending on the site.
          </p>
        </div>
      )}
    </div>
  );
}
