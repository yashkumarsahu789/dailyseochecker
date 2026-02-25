import React from "react";

export default function SiteHealthTab({ reports }) {
  const crawl = reports[0]?.audits?.siteCrawl;

  if (!crawl || !crawl.pages || crawl.pages.length === 0) {
    return (
      <div>
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          🕷️ Site Health
          <span className="text-sm font-normal text-slate-400">
            — Multi-page crawl results
          </span>
        </h3>
        <div className="bg-slate-800/50 border border-dashed border-slate-700 text-slate-400 p-12 rounded-2xl text-center">
          <div className="text-5xl mb-4">🕷️</div>
          <p className="text-lg font-semibold text-slate-300">
            No crawl data yet
          </p>
          <p className="text-sm">
            Run an audit to scan your site's internal pages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        🕷️ Site Health
        <span className="text-sm font-normal text-slate-400">
          — Multi-page crawl results
        </span>
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 text-center">
          <div className="text-3xl font-black text-cyan-400">
            {crawl.pagesCrawled}
          </div>
          <div className="text-xs text-slate-400 mt-1">Pages Crawled</div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 text-center">
          <div className="text-3xl font-black text-slate-300">
            {crawl.totalInternalLinks}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Internal Links Found
          </div>
        </div>
        <div
          className={`bg-slate-800 rounded-2xl p-4 border text-center ${crawl.duplicateTitles?.length > 0 ? "border-amber-500/30" : "border-slate-700"}`}
        >
          <div
            className={`text-3xl font-black ${crawl.duplicateTitles?.length > 0 ? "text-amber-400" : "text-green-400"}`}
          >
            {crawl.duplicateTitles?.length || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Duplicate Titles</div>
        </div>
        <div
          className={`bg-slate-800 rounded-2xl p-4 border text-center ${crawl.totalIssues > 0 ? "border-red-500/30" : "border-slate-700"}`}
        >
          <div
            className={`text-3xl font-black ${crawl.totalIssues > 0 ? "text-red-400" : "text-green-400"}`}
          >
            {crawl.totalIssues}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total Issues</div>
        </div>
      </div>

      {/* Crawled Pages Table */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-700">
          <h4 className="font-bold text-white">Crawled Pages</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="px-6 py-3 text-left">URL</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-center">Speed</th>
              </tr>
            </thead>
            <tbody>
              {crawl.pages.map((page, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {page.isHome && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                          HOME
                        </span>
                      )}
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 truncate max-w-[250px] block"
                      >
                        {page.url.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        page.status === 200
                          ? "bg-green-500/20 text-green-400"
                          : page.status === "ERROR"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 truncate max-w-[200px]">
                    {page.title === "(missing)" ||
                    page.title === "(unreachable)" ? (
                      <span className="text-red-400">{page.title}</span>
                    ) : (
                      page.title
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-mono ${
                        page.loadTime < 1000
                          ? "text-green-400"
                          : page.loadTime < 3000
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {page.loadTime}ms
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Duplicate Titles */}
      {crawl.duplicateTitles?.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-6">
          <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
            ⚠️ Duplicate Titles Found ({crawl.duplicateTitles.length})
          </h4>
          {crawl.duplicateTitles.map((dup, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <p className="text-white font-medium text-sm mb-1">
                "{dup.title}"
              </p>
              <div className="flex flex-wrap gap-1">
                {dup.pages.map((p, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded"
                  >
                    {p.replace(/^https?:\/\//, "")}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate Descriptions */}
      {crawl.duplicateDescriptions?.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-6">
          <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
            ⚠️ Duplicate Descriptions ({crawl.duplicateDescriptions.length})
          </h4>
          {crawl.duplicateDescriptions.map((dup, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <p className="text-white italic text-sm mb-1">"{dup.desc}"</p>
              <div className="flex flex-wrap gap-1">
                {dup.pages.map((p, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded"
                  >
                    {p.replace(/^https?:\/\//, "")}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Clear */}
      {crawl.totalIssues === 0 && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-green-400 font-bold text-lg">
            Site Health is Perfect!
          </p>
          <p className="text-slate-400 text-sm">
            No duplicate titles, no missing meta data, all pages reachable.
          </p>
        </div>
      )}
    </div>
  );
}
