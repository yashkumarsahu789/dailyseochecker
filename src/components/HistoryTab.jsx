import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function HistoryTab({ reports }) {
  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        📈 Score History
        <span className="text-sm font-normal text-slate-400">
          — Track your progress over time
        </span>
      </h3>

      {reports.length < 2 ? (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-8 rounded-xl text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg font-semibold mb-1">Not enough data yet</p>
          <p className="text-sm text-slate-400">
            Run at least 2 audits to see trends. Each audit adds a data point.
          </p>
        </div>
      ) : (
        <>
          {/* Line Chart */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-8">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={[...reports].reverse().map((r) => ({
                  date: new Date(r.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  }),
                  Performance: Math.round(r.scores?.performance || 0),
                  Accessibility: Math.round(r.scores?.accessibility || 0),
                  "Best Practices": Math.round(r.scores?.bestPractices || 0),
                  SEO: Math.round(r.scores?.seo || 0),
                }))}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "12px",
                  }}
                  labelStyle={{
                    color: "#e2e8f0",
                    fontWeight: "bold",
                  }}
                  itemStyle={{ color: "#94a3b8" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Performance"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Accessibility"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Best Practices"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="SEO"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* History Table */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                  <th className="text-left p-4">Date</th>
                  <th className="text-center p-4">Perf</th>
                  <th className="text-center p-4">A11y</th>
                  <th className="text-center p-4">BP</th>
                  <th className="text-center p-4">SEO</th>
                  <th className="text-center p-4">Δ</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => {
                  const prev = reports[i + 1];
                  const currAvg = Math.round(
                    ((r.scores?.performance || 0) +
                      (r.scores?.accessibility || 0) +
                      (r.scores?.bestPractices || 0) +
                      (r.scores?.seo || 0)) /
                      4,
                  );
                  const prevAvg = prev
                    ? Math.round(
                        ((prev.scores?.performance || 0) +
                          (prev.scores?.accessibility || 0) +
                          (prev.scores?.bestPractices || 0) +
                          (prev.scores?.seo || 0)) /
                          4,
                      )
                    : null;
                  const delta = prevAvg !== null ? currAvg - prevAvg : null;
                  return (
                    <tr
                      key={r.timestamp}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition"
                    >
                      <td className="p-4 text-sm text-slate-300">
                        {new Date(r.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {i === 0 && (
                          <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                            Latest
                          </span>
                        )}
                      </td>
                      <td
                        className={`text-center p-4 font-bold ${r.scores?.performance >= 80 ? "text-green-400" : r.scores?.performance >= 50 ? "text-amber-400" : "text-red-400"}`}
                      >
                        {Math.round(r.scores?.performance || 0)}
                      </td>
                      <td
                        className={`text-center p-4 font-bold ${r.scores?.accessibility >= 80 ? "text-green-400" : r.scores?.accessibility >= 50 ? "text-amber-400" : "text-red-400"}`}
                      >
                        {Math.round(r.scores?.accessibility || 0)}
                      </td>
                      <td
                        className={`text-center p-4 font-bold ${r.scores?.bestPractices >= 80 ? "text-green-400" : r.scores?.bestPractices >= 50 ? "text-amber-400" : "text-red-400"}`}
                      >
                        {Math.round(r.scores?.bestPractices || 0)}
                      </td>
                      <td
                        className={`text-center p-4 font-bold ${r.scores?.seo >= 80 ? "text-green-400" : r.scores?.seo >= 50 ? "text-amber-400" : "text-red-400"}`}
                      >
                        {Math.round(r.scores?.seo || 0)}
                      </td>
                      <td className="text-center p-4 font-bold">
                        {delta !== null ? (
                          <span
                            className={
                              delta > 0
                                ? "text-green-400"
                                : delta < 0
                                  ? "text-red-400"
                                  : "text-slate-400"
                            }
                          >
                            {delta > 0
                              ? `▲ +${delta}`
                              : delta < 0
                                ? `▼ ${delta}`
                                : "—"}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
