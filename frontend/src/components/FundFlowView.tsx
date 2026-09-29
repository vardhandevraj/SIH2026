import { ArrowRight, Landmark } from "lucide-react";
import type { FundFlowPath } from "../api/types";
import { shortAddr } from "../utils/format";

export function FundFlowView({ paths }: { paths: FundFlowPath[] }) {
  if (paths.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-500">No fund-flow paths identified toward a candidate VASP.</div>;
  }
  return (
    <div className="space-y-4">
      {paths.map((path) => (
        <div key={path.id} className="rounded-xl border border-slate-800 bg-base-800/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {path.hops.map((hop, idx) => {
              const isVasp = idx === path.hops.length - 1;
              return (
                <div key={`${path.id}-${idx}`} className="flex items-center gap-2">
                  <div
                    className={`rounded-lg px-3 py-2 font-mono text-xs ${
                      isVasp ? "border border-accent-violet/40 bg-accent-violet/15 text-accent-cyan" : idx === 0 ? "border border-accent-indigo/40 bg-accent-indigo/15 text-white" : "border border-slate-700 bg-base-900 text-slate-300"
                    }`}
                  >
                    {idx === 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Landmark size={12} className="text-accent-indigo" />
                        {shortAddr(hop)}
                      </span>
                    ) : isVasp ? (
                      path.labels[idx]
                    ) : (
                      shortAddr(hop)
                    )}
                  </div>
                  {idx < path.hops.length - 1 ? <ArrowRight size={14} className="text-slate-500" /> : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Chain: <span className="font-mono text-slate-300">{path.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {path.token}</span> ·{" "}
            {path.hopCount} hop{path.hopCount > 1 ? "s" : ""} · {path.txHashes.length} tx
          </div>
        </div>
      ))}
    </div>
  );
}