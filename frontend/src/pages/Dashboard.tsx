import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSearch, History, ArrowRight } from "lucide-react";
import { AnalyzeForm } from "../components/AnalyzeForm";
import { api } from "../api/client";
import type { InvestigationRow } from "../api/types";
import { shortAddr, formatDate } from "../utils/format";

export function Dashboard() {
  const [recent, setRecent] = useState<InvestigationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .investigations()
      .then((r) => setRecent(r.investigations))
      .catch(() => setRecent([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Investigate an Unknown Wallet</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter an Ethereum address to collect on-chain activity, build a transaction graph and compute explainable VASP attribution.
        </p>
      </div>

      <div className="glass mb-8 rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
          <FileSearch size={15} className="text-accent-cyan" /> New Investigation
        </div>
        <AnalyzeForm compact />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
          <History size={15} className="text-accent-cyan" /> Recent Investigations
        </h2>
        <Link to="/history" className="flex items-center gap-1 text-xs text-accent-cyan hover:underline">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="glass flex items-center justify-center rounded-xl py-10 text-sm text-slate-500">Loading history...</div>
      ) : recent.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <div className="text-sm text-slate-400">No investigations yet.</div>
          <div className="mt-2 text-xs text-slate-500">Run the Demo Investigation above to see a complete end-to-end analysis.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Wallet</th>
                <th className="pb-2 pr-3">Likely VASP</th>
                <th className="pb-2 pr-3 text-right">Confidence</th>
                <th className="pb-2 pr-3">Analyzed</th>
                <th className="pb-2 pr-3">Mode</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-3 font-mono text-xs text-accent-cyan">{shortAddr(r.address, 10, 8)}</td>
                  <td className="py-2.5 pr-3">{r.likelyVasp ?? "No attribution"}</td>
                  <td className="py-2.5 pr-3 text-right font-mono text-xs">{r.confidence}%</td>
                  <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDate(r.analyzedAt)}</td>
                  <td className="py-2.5 pr-3 text-xs">{r.demo ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">DEMO</span> : <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">LIVE</span>}</td>
                  <td className="py-2.5">
                    <Link to={`/investigation/${r.id}`} className="text-xs text-accent-cyan hover:underline">
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