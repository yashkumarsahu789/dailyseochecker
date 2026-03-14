import React, { useState, useEffect } from "react";

import HistoryTab from "./HistoryTab";
import CompareTab from "./CompareTab";
import SiteHealthTab from "./SiteHealthTab";
import AuditTab from "./AuditTab";
import ScoreCard from "./ScoreCard";
import AlertsBanner from "./AlertsBanner";
import DashboardSummary from "./DashboardSummary";
import UptimeTab from "./UptimeTab";
import KeywordsTab from "./KeywordsTab";
import SettingsPanel from "./SettingsPanel";
import SiteEditModal from "./SiteEditModal";
import BacklinksTab from "./BacklinksTab";
import AnalyticsTab from "./AnalyticsTab";
import ActionPlanTab from "./ActionPlanTab";

import { API_BASE } from "../config.js";

export default function SeoDashboard() {
  const [websites, setWebsites] = useState([]);
  const [urlInput, setUrlInput] = useState("");
  const [selectedSite, setSelectedSite] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorConsole, setErrorConsole] = useState([]);

  const [modalTab, setModalTab] = useState("audit");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [theme, setTheme] = useState(
    localStorage.getItem("seo-theme") || "dark",
  );
  const [activeGroup, setActiveGroup] = useState("All");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("seo-theme", next);
  };

  // Get distinct groups from websites
  const groups = [
    "All",
    ...new Set(websites.map((w) => w.group || "Ungrouped")),
  ];

  // Filter websites by active group
  const filteredWebsites =
    activeGroup === "All"
      ? websites
      : websites.filter((w) => (w.group || "Ungrouped") === activeGroup);

  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      const res = await fetch(`${API_BASE}/websites`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setWebsites(data);
      }
    } catch (err) {
      logError("Network", "Failed to fetch websites", err);
    }
  };

  const addWebsite = async (e) => {
    e.preventDefault();
    if (!urlInput) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/websites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUrlInput("");
      fetchWebsites();
    } catch (err) {
      logError("Add Site", "Failed to add website", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSite = async (id) => {
    if (!confirm("Delete this site and all its reports?")) return;
    try {
      await fetch(`${API_BASE}/websites/${id}`, { method: "DELETE" });
      fetchWebsites();
    } catch (err) {
      logError("Delete", "Failed to delete website", err);
    }
  };

  const runAudit = async (id) => {
    try {
      logError("Audit", `Starting audit for site ID: ${id}...`, {});
      const res = await fetch(`${API_BASE}/websites/${id}/audit`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Start Polling
      setWebsites((prev) =>
        prev.map((w) => (w.id === id ? { ...w, lastStatus: "RUNNING" } : w)),
      );
      pollStatus(id);
    } catch (err) {
      logError("Audit", "Failed to start audit", err);
    }
  };

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/websites`);
        const data = await res.json();
        const site = data.find((w) => w.id === id);

        if (
          site &&
          site.lastStatus !== "PENDING" &&
          site.lastStatus !== "RUNNING"
        ) {
          clearInterval(interval);
          setWebsites(data);
          // Refresh report if we are viewing this site
          // Note: accessing selectedSite state in closure might be stale, but good enough for now
          // A safer way is to just fetch reports if the modal is open for this ID
          if (selectedSite && selectedSite.id === id) {
            viewReport(site);
          }
        }
      } catch (err) {
        // Ignore poll errors
      }
    }, 3000); // Check every 3 seconds

    // Stop polling after 2 minutes to prevent infinite loops
    setTimeout(() => clearInterval(interval), 120000);
  };

  const viewReport = async (site) => {
    setSelectedSite(site);
    try {
      const res = await fetch(`${API_BASE}/reports/${site.id}`);
      const data = await res.json();
      setReports(data || []);
    } catch (err) {
      logError("Report", "Failed to load report history", err);
    }
  };

  const logError = (category, message, details) => {
    const detailMsg = details ? details.message || JSON.stringify(details) : "";
    setErrorConsole((prev) => [
      {
        category,
        message,
        details: detailMsg,
        time: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  return (
    <div
      className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 font-sans"
      data-theme={theme}
    >
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 text-center relative">
          <h1 className="text-4xl font-extrabold bg-linear-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent mb-2">
            SEO Automation Dashboard
          </h1>
          <p className="text-slate-400">42-Point Professional SEO Audit</p>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white w-10 h-10 rounded-full flex items-center justify-center transition text-xl"
              title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white w-10 h-10 rounded-full flex items-center justify-center transition text-xl"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Settings Modal */}
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        {/* Console Section */}
        {errorConsole.length > 0 && (
          <div className="mb-8 bg-slate-800 border-l-4 border-red-500 rounded p-4 overflow-hidden shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-red-400 font-bold flex items-center">
                <span className="mr-2">⚠️</span> Error Console
              </h3>
              <button
                onClick={() => setErrorConsole([])}
                className="text-xs text-slate-400 hover:text-white bg-slate-700 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto font-mono text-sm text-red-200 bg-slate-900/50 p-2 rounded">
              {errorConsole.map((err, idx) => (
                <div
                  key={idx}
                  className="mb-1 pb-1 border-b border-red-900/30 last:border-0 wrap-break-word"
                >
                  <span className="text-slate-500 text-xs">[{err.time}]</span>{" "}
                  <span className="font-bold">[{err.category}]</span>:{" "}
                  {err.message}
                  {err.details && (
                    <div className="ml-4 text-xs opacity-75 mt-1">
                      {String(err.details).substring(0, 200)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Drop Alerts */}
        <AlertsBanner />

        {/* Add Website */}
        <form
          onSubmit={addWebsite}
          className="mb-12 flex gap-4 max-w-2xl mx-auto"
        >
          <input
            type="url"
            placeholder="Enter website URL (e.g., https://example.com)..."
            required
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-6 py-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition text-lg shadow-inner"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-8 py-4 rounded-lg font-bold transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 text-lg whitespace-nowrap"
          >
            {loading ? "Adding..." : "Track Website"}
          </button>
        </form>

        {/* Dashboard Summary */}
        <DashboardSummary websites={websites} />

        {/* Group Filter Bar */}
        {groups.length > 1 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mr-2">
              🏷️ Groups:
            </span>
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeGroup === g
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Websites Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredWebsites.map((site) => (
            <div
              key={site.id}
              className="relative bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer group shadow-xl hover:shadow-cyan-500/10 flex flex-col h-full animate-fade-in"
              onClick={() => viewReport(site)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="overflow-hidden flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate mb-1">
                    {new URL(site.url).hostname}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">{site.url}</p>
                </div>
                <span
                  className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded ml-2 shrink-0 ${site.lastStatus === "OK" ? "bg-green-500/10 text-green-400" : site.lastStatus === "ERROR" ? "bg-red-500/10 text-red-400" : "bg-slate-700 text-slate-400"}`}
                >
                  {site.lastStatus || "PENDING"}
                </span>
              </div>

              {/* Group & Tags */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {site.group && site.group !== "Ungrouped" && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold">
                    {site.group}
                  </span>
                )}
                {(site.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Notes */}
              {site.notes && (
                <p className="text-xs text-slate-500 mb-4 line-clamp-2 italic">
                  📝 {site.notes}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <ScoreCard
                  label="Performance"
                  score={site.lastScores?.performance}
                />
                <ScoreCard label="SEO" score={site.lastScores?.seo} />
              </div>

              <div className="mt-auto pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-400">
                <span>
                  Last:{" "}
                  {site.lastRun
                    ? new Date(site.lastRun).toLocaleDateString()
                    : "Never"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSite(site);
                    }}
                    className="flex items-center gap-1 bg-slate-700 hover:bg-purple-600 hover:text-white px-2.5 py-1.5 rounded transition text-slate-400"
                    title="Edit site"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSite(site.id);
                    }}
                    className="flex items-center gap-1 bg-slate-700 hover:bg-red-600 hover:text-white px-2.5 py-1.5 rounded transition text-slate-400"
                    title="Delete site"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      runAudit(site.id);
                    }}
                    className="flex items-center gap-1 bg-slate-700 hover:bg-cyan-600 hover:text-white px-3 py-1.5 rounded transition font-medium text-slate-300"
                  >
                    Run Audit ⚡
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {websites.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-800/50 rounded-3xl border border-dashed border-slate-700">
            <div className="text-6xl mb-4">🕸️</div>
            <h3 className="text-2xl font-bold text-slate-300 mb-2">
              No websites being tracked
            </h3>
            <p className="text-slate-500">
              Add a URL above to start monitoring your SEO.
            </p>
          </div>
        )}

        {/* Detailed Report Modal */}
        {selectedSite && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8">
            <div className="bg-slate-900 w-full max-w-5xl h-full max-h-[90vh] rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col relative">
              {/* Modal Header */}
              <div className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">
                    {new URL(selectedSite.url).hostname}
                  </h2>
                  <a
                    href={selectedSite.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                  >
                    {selectedSite.url} ↗
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `${API_BASE}/websites/${selectedSite.id}/report`,
                        );
                        const data = await res.json();
                        if (data.html) {
                          const w = window.open("", "_blank");
                          w.document.write(data.html);
                          w.document.close();
                        }
                      } catch {
                        alert("❌ Failed to generate report");
                      }
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-4 h-10 rounded-full flex items-center justify-center transition text-sm font-bold gap-1"
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => setSelectedSite(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white w-10 h-10 rounded-full flex items-center justify-center transition text-2xl"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="px-6 md:px-8 pt-4 pb-0 flex gap-1 bg-slate-800/20 border-b border-slate-800 overflow-x-auto custom-scrollbar">
                {[
                  "ai-plan",
                  "audit",
                  "history",
                  "compare",
                  "site-health",
                  "uptime",
                  "keywords",
                  "backlinks",
                  "analytics",
                ].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setModalTab(tab)}
                    className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition capitalize ${
                      modalTab === tab
                        ? "bg-slate-900 text-cyan-400 border border-slate-700 border-b-slate-900 -mb-px"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    {tab === "ai-plan" && "🧠 "}
                    {tab === "audit" && "📋 "}
                    {tab === "history" && "📈 "}
                    {tab === "compare" && "⚔️ "}
                    {tab === "site-health" && "🕷️ "}
                    {tab === "uptime" && "📡 "}
                    {tab === "keywords" && "🔑 "}
                    {tab === "backlinks" && "🔗 "}
                    {tab === "analytics" && "📊 "}
                    {tab === "site-health"
                      ? "Site Health"
                      : tab === "ai-plan"
                        ? "AI Plan"
                        : tab}
                  </button>
                ))}
              </div>

              <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                {/* ===== AI PLAN TAB ===== */}
                {modalTab === "ai-plan" && (
                  <ActionPlanTab selectedSite={selectedSite} />
                )}

                {/* ===== AUDIT TAB ===== */}
                {modalTab === "audit" && (
                  <AuditTab reports={reports} selectedSite={selectedSite} />
                )}

                {/* ===== HISTORY TAB ===== */}
                {modalTab === "history" && <HistoryTab reports={reports} />}

                {/* ===== COMPARE TAB ===== */}
                {modalTab === "compare" && (
                  <CompareTab
                    reports={reports}
                    selectedSite={selectedSite}
                    apiBase={API_BASE}
                  />
                )}

                {/* ===== SITE HEALTH TAB ===== */}
                {modalTab === "site-health" && (
                  <SiteHealthTab reports={reports} />
                )}

                {/* ===== UPTIME TAB ===== */}
                {modalTab === "uptime" && (
                  <UptimeTab selectedSite={selectedSite} />
                )}

                {/* ===== KEYWORDS TAB ===== */}
                {modalTab === "keywords" && (
                  <KeywordsTab selectedSite={selectedSite} />
                )}

                {/* ===== BACKLINKS TAB ===== */}
                {modalTab === "backlinks" && (
                  <BacklinksTab selectedSite={selectedSite} />
                )}

                {/* ===== ANALYTICS TAB ===== */}
                {modalTab === "analytics" && (
                  <AnalyticsTab selectedSite={selectedSite} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Site Edit Modal */}
      {editingSite && (
        <SiteEditModal
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSaved={fetchWebsites}
        />
      )}
    </div>
  );
}
