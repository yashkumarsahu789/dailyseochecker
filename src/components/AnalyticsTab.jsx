import React, { useState, useEffect } from "react";

import { API_BASE } from "../config.js";

export default function AnalyticsTab({ selectedSite }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      const data = await res.json();
      setSettings(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const siteGA = selectedSite?.gaPropertyId;
  const hasGA = !!siteGA;

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-4xl mb-4 animate-pulse">📊</div>
        Loading...
      </div>
    );
  }

  return (
    <div>
      {hasGA ? (
        <>
          {/* GA Embed - Google Looker Studio or iframe */}
          <div className="mb-6">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-xl">
                  📊
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Google Analytics Connected
                  </h3>
                  <p className="text-xs text-slate-400">Property: {siteGA}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-1">—</div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    Sessions (7d)
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-400 mb-1">
                    —
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    Users (7d)
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400 mb-1">
                    —
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    Bounce Rate
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">—</div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    Avg Duration
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 text-center bg-slate-900/30 rounded-xl p-4">
                <p className="font-bold text-slate-300 mb-2">
                  ⚡ To view live analytics data:
                </p>
                <ol className="text-left space-y-1 max-w-sm mx-auto">
                  <li>
                    1. Go to{" "}
                    <a
                      href="https://analytics.google.com"
                      target="_blank"
                      rel="noopener"
                      className="text-cyan-400 hover:underline"
                    >
                      Google Analytics
                    </a>
                  </li>
                  <li>2. Set up GA4 Data API credentials</li>
                  <li>3. Add your service account JSON to the server</li>
                  <li>4. Live data will appear here automatically</li>
                </ol>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-slate-300 mb-2">
            Google Analytics Not Connected
          </h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Connect your GA4 property to see traffic data, user sessions, and
            bounce rates alongside your SEO scores.
          </p>

          <div className="bg-slate-900/50 rounded-xl p-5 max-w-sm mx-auto text-left">
            <h4 className="text-sm font-bold text-slate-300 mb-3">
              Setup Instructions:
            </h4>
            <ol className="text-xs text-slate-400 space-y-2">
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">1.</span>
                Click the ✏️ edit button on a site card
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">2.</span>
                Add your GA4 Property ID (e.g., "123456789")
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">3.</span>
                Set up GA4 Data API at{" "}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener"
                  className="text-cyan-400 hover:underline"
                >
                  Google Cloud Console
                </a>
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">4.</span>
                Download your credentials JSON and place in project root
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
