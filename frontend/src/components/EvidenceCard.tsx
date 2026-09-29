import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import type { EvidenceItem, EvidenceStrength } from "../api/types";

const strengthStyles: Record<EvidenceStrength, { border: string; text: string; bg: string }> = {
  HIGH: { border: "border-emerald-500/40", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  MEDIUM: { border: "border-cyan-500/40", text: "text-cyan-400", bg: "bg-cyan-500/10" },
  LOW: { border: "border-slate-600/50", text: "text-slate-400", bg: "bg-slate-500/10" },
};

const icons = {
  vasp: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
};

export function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  const s = strengthStyles[evidence.strength];
  const Icon = evidence.strength === "HIGH" ? icons.vasp : icons.info;
  const isWarning = evidence.type === "data-warning";

  return (
    <div className={`glass render-lazy rounded-xl border-l-2 p-4 ${isWarning ? "border-l-amber-500/70" : s.border}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-1.5 ${isWarning ? "bg-amber-500/10 text-amber-400" : s.bg} ${s.text}`}>
          {isWarning ? <AlertTriangle size={15} /> : <Icon size={15} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-100">{evidence.title}</div>
            <span className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>
              {evidence.strength}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{evidence.description}</p>
          <div className="mt-2 text-[11px] text-slate-600">{evidence.source}</div>
          {evidence.relatedTransactions.length > 0 ? (
            <div className="mt-2 flex max-h-16 flex-wrap gap-1 overflow-y-auto scrollbar-thin">
              {evidence.relatedTransactions.slice(0, 8).map((h) => (
                <span key={h} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  {h.slice(0, 10)}...
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}