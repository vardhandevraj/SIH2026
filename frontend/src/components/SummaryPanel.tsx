import { AlertTriangle, Building2, Repeat, ShieldAlert } from "lucide-react";
import type { InvestigationSummary } from "../api/types";
import { StatCard } from "./StatCard";

export function SummaryPanel({ summary }: { summary: InvestigationSummary }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Repeat size={13} />} label="Total volume (ETH)" value={summary.totalVolumeEth.toLocaleString()} />
        <StatCard icon={<Building2 size={13} />} label="Connected entities" value={summary.connectedEntities} />
        <StatCard label="Known VASP interactions" value={summary.knownVaspInteractions} sub="edges touching VASP nodes" />
        <StatCard label="In / Out (ETH)" value={`${summary.inboundVolume} / ${summary.outboundVolume}`} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
          <ShieldAlert size={14} className="text-rose-400" />
          Risk / Suspicious Patterns
        </div>
        {summary.suspiciousPatterns.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-base-800/40 p-4 text-sm text-slate-400">
            No suspicious patterns flagged. Wallet behaves like a lower-risk active address.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.suspiciousPatterns.map((p, i) => (
              <div key={`${p.id}-${i}`} className="render-lazy flex items-start gap-3 rounded-lg border border-slate-800 bg-base-800/40 p-3">
                <AlertTriangle
                  size={15}
                  className={`mt-0.5 ${p.severity === "HIGH" ? "text-rose-400" : p.severity === "MEDIUM" ? "text-amber-400" : "text-slate-400"}`}
                />
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    {p.label}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        p.severity === "HIGH" ? "bg-rose-500/15 text-rose-300" : p.severity === "MEDIUM" ? "bg-amber-500/15 text-amber-300" : "bg-slate-500/15 text-slate-400"
                      }`}
                    >
                      {p.severity}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{p.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}