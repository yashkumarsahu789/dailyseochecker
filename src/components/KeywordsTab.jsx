import React, { useState, useEffect } from "react";

import { API_BASE } from "../config.js";

export default function KeywordsTab({ selectedSite }) {
  const [keywords, setKeywords] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (selectedSite) fetchKeywords();
  }, [selectedSite]);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/websites/${selectedSite.id}/keywords`,
      );
      const data = await res.json();
      setKeywords(data.keywords || []);
      setRanks(data.ranks || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    try {
      await fetch(`${API_BASE}/websites/${selectedSite.id}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: [newKeyword.trim().toLowerCase()] }),
      });
      setNewKeyword("");
      fetchKeywords();
    } catch {
      // Silently fail
    }
  };

  const removeKeyword = async (keyword) => {
    try {
      await fetch(
        `${API_BASE}/websites/${selectedSite.id}/keywords/${encodeURIComponent(keyword)}`,
        { method: "DELETE" },
      );
      fetchKeywords();
    } catch {
      // Silently fail
    }
  };

  const triggerCheck = async () => {
    setChecking(true);
    try {
      await fetch(`${API_BASE}/websites/${selectedSite.id}/keywords/check`, {
        method: "POST",
      });
      // Wait a bit then refresh
      setTimeout(() => {
        fetchKeywords();
        setChecking(false);
      }, 5000);
    } catch {
      setChecking(false);
    }
  };

  // Get latest rank for a keyword
  const getLatestRank = (keyword) => {
    const kwRanks = ranks
      .filter((r) => r.keyword === keyword)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return kwRanks[0] || null;
  };

  // Get best rank ever for a keyword
  const getBestRank = (keyword) => {
    const kwRanks = ranks.filter(
      (r) => r.keyword === keyword && r.position > 0,
    );
    if (kwRanks.length === 0) return null;
    return Math.min(...kwRanks.map((r) => r.position));
  };

  // Get trend (compare latest vs previous)
  const getTrend = (keyword) => {
    const kwRanks = ranks
      .filter((r) => r.keyword === keyword && r.position > 0)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (kwRanks.length < 2) return null;
    const diff = kwRanks[1].position - kwRanks[0].position; // positive = improved
    return diff;
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-4xl mb-4 animate-pulse">🔑</div>
        Loading keywords...
      </div>
    );
  }

  return (
    <div>
      {/* Add Keyword Form */}
      <form onSubmit={addKeyword} className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="Add keyword to track (e.g., 'seo audit tool')..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition text-sm"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-bold transition text-sm whitespace-nowrap"
        >
          + Add
        </button>
        <button
          type="button"
          onClick={triggerCheck}
          disabled={checking || keywords.length === 0}
          className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-5 py-3 rounded-xl font-bold transition text-sm whitespace-nowrap disabled:opacity-40"
        >
          {checking ? "Checking..." : "🔍 Check Now"}
        </button>
      </form>

      {/* Keywords Table */}
      {keywords.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
          <div className="text-5xl mb-4">🔑</div>
          <h3 className="text-xl font-bold text-slate-300 mb-2">
            No keywords being tracked
          </h3>
          <p className="text-slate-500 text-sm">
            Add keywords above to start tracking their Google ranking.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-5">Keyword</div>
            <div className="col-span-2 text-center">Current Rank</div>
            <div className="col-span-2 text-center">Best Rank</div>
            <div className="col-span-2 text-center">Trend</div>
            <div className="col-span-1 text-center"></div>
          </div>

          {/* Table Body */}
          {keywords.map((kw) => {
            const latest = getLatestRank(kw);
            const best = getBestRank(kw);
            const trend = getTrend(kw);

            return (
              <div
                key={kw}
                className="grid grid-cols-12 gap-4 px-5 py-4 border-t border-slate-700/50 hover:bg-slate-700/20 transition items-center"
              >
                {/* Keyword */}
                <div className="col-span-5">
                  <span className="text-white font-medium text-sm">{kw}</span>
                  {latest && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Last checked:{" "}
                      {new Date(latest.timestamp).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Current Rank */}
                <div className="col-span-2 text-center">
                  {latest ? (
                    <span
                      className={`text-lg font-bold ${
                        latest.position <= 3
                          ? "text-emerald-400"
                          : latest.position <= 10
                            ? "text-cyan-400"
                            : latest.position <= 30
                              ? "text-yellow-400"
                              : latest.position > 0
                                ? "text-orange-400"
                                : "text-red-400"
                      }`}
                    >
                      {latest.position > 0 ? `#${latest.position}` : "100+"}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-sm">—</span>
                  )}
                </div>

                {/* Best Rank */}
                <div className="col-span-2 text-center">
                  {best ? (
                    <span className="text-emerald-400 font-bold">#{best}</span>
                  ) : (
                    <span className="text-slate-600 text-sm">—</span>
                  )}
                </div>

                {/* Trend */}
                <div className="col-span-2 text-center">
                  {trend !== null ? (
                    <span
                      className={`text-sm font-bold ${
                        trend > 0
                          ? "text-emerald-400"
                          : trend < 0
                            ? "text-red-400"
                            : "text-slate-500"
                      }`}
                    >
                      {trend > 0
                        ? `↑${trend}`
                        : trend < 0
                          ? `↓${Math.abs(trend)}`
                          : "—"}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-sm">—</span>
                  )}
                </div>

                {/* Delete */}
                <div className="col-span-1 text-center">
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="text-slate-600 hover:text-red-400 transition p-1"
                    title="Remove keyword"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 text-xs text-slate-600 text-center">
        Keywords are checked daily at 1:00 AM. Use "Check Now" to trigger
        manually.
      </div>
    </div>
  );
}
