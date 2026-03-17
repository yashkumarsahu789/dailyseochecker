import React, { useState, useEffect } from "react";

import { getBacklinks } from "../utils/firestore.js";export default function BacklinksTab({ selectedSite }) {
  const [data, setData] = useState({ active: [], lost: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedSite) fetchBacklinks();
  }, [selectedSite]);

  const fetchBacklinks = async () => {
    setLoading(true);
    try {
      const result = await getBacklinks(selectedSite.id);
      setData(result);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-4xl mb-4 animate-pulse">🔗</div>
        Loading backlinks...
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
          <div className="text-3xl font-extrabold text-emerald-400 mb-1">
            {data.active.length}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            Active Backlinks
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
          <div className="text-3xl font-extrabold text-red-400 mb-1">
            {data.lost.length}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">
            Lost Backlinks
          </div>
        </div>
      </div>

      {/* Active Backlinks */}
      {data.active.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
            ✅ Active Backlinks
          </h3>
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {data.active.map((bl) => (
                <div
                  key={bl.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">
                      {bl.sourceDomain}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {bl.anchorText}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-[10px] text-slate-500">
                      First: {new Date(bl.firstSeen).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-emerald-500">
                      Last: {new Date(bl.lastSeen).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lost Backlinks */}
      {data.lost.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
            ❌ Lost Backlinks
          </h3>
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {data.lost.map((bl) => (
                <div
                  key={bl.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-400 font-medium truncate line-through">
                      {bl.sourceDomain}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {bl.anchorText}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-[10px] text-red-400">
                      Lost:{" "}
                      {bl.lostDate
                        ? new Date(bl.lostDate).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.active.length === 0 && data.lost.length === 0 && (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
          <div className="text-5xl mb-4">🔗</div>
          <h3 className="text-xl font-bold text-slate-300 mb-2">
            No backlinks detected yet
          </h3>
          <p className="text-slate-500 text-sm">
            Backlinks are checked daily at 2:00 AM via Google search.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 text-xs text-slate-600 text-center">
        Backlinks checked daily at 2:00 AM via Google search. Results may vary.
      </div>
    </div>
  );
}
