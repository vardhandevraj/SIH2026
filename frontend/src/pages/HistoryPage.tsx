import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { InvestigationRow } from "../api/types";
import { LoadingState, ErrorState } from "../components/State";
import { shortAddr, formatDate } from "../utils/format";

export function HistoryPage() {
  const [rows, setRows] = useState<InvestigationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .investigations()
      .then((r) => setRows(r.investigations))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <History size={20} className="text-accent-cyan" /> Investigation History
          </h1>
          <p className="mt-1 text-xs text-slate-500">All wallet analyses stored for the current investigator session.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState message="Loading history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <div className="text-sm text-slate-400">No investigations recorded.</div>
          <div className="mt-2 text-xs text-slate-500">Run an analysis from the Dashboard to populate history.</div>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-xl">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Likely VASP</th>
                <th className="px-4 py-3 text-right">Confidence</th>
                <th className="px-4 py-3">Investigator</th>
                <th className="px-4 py-3">Analyzed</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{r.id.slice(0, 12)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-accent-cyan">{shortAddr(r.address, 10, 8)}</td>
                  <td className="px-4 py-3 text-sm text-slate-200">{r.likelyVasp ?? <span className="text-slate-500">None</span>}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-white">{r.confidence}%</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.investigator}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(r.analyzedAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.demo ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">DEMO</span> : <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">LIVE</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/investigation/${r.id}`} className="whitespace-nowrap text-xs text-accent-cyan hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}