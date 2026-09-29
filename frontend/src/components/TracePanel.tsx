import { useState } from "react";
import { Link } from "react-router-dom";
import { Route, ChevronRight, CornerDownRight } from "lucide-react";
import type { TraceNode, TraceResult } from "../api/types";
import { vaspColor } from "../utils/colors";
import { shortAddr, formatValue } from "../utils/format";

function nodeLabel(trace: TraceResult, address: string): TraceNode | undefined {
  return trace.nodes.find((n) => n.address.toLowerCase() === address.toLowerCase());
}

/**
 * Multi-hop pivot view: shows how many hops away each VASP sits, and lets the
 * analyst jump straight into any node's own investigation.
 */
export function TracePanel({ trace, onPivot }: { trace: TraceResult; onPivot?: (address: string) => void }) {
  const [openPath, setOpenPath] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          <span className="font-mono text-slate-200">{trace.nodes.length}</span> nodes in {trace.hops} hops
        </span>
        <span>
          <span className="font-mono text-slate-200">{trace.reachableVasps.length}</span> VASPs reachable
        </span>
        {trace.truncated ? <span className="text-amber-400">truncated at hop limit</span> : null}
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-600">Nearest VASPs by hop distance</div>
        <div className="space-y-1.5">
          {trace.reachableVasps.map((v) => (
            <div
              key={v.address}
              className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-base-900/50 px-3 py-2 transition-colors hover:border-slate-700"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-base-900"
                style={{ background: vaspColor(v.name) }}
              >
                {v.hop}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-200">{v.name}</div>
                <div className="truncate font-mono text-[10px] text-slate-500">
                  {shortAddr(v.address, 10, 6)} · {v.entityType}
                </div>
              </div>
              {v.demoSample ? <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase text-amber-400">Demo</span> : null}
              <div className="flex shrink-0 gap-1">
                <Link
                  to={`/graph/${v.address}`}
                  className="rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-accent-indigo/40 hover:text-accent-cyan"
                >
                  Graph
                </Link>
                <button
                  onClick={() => onPivot?.(v.address)}
                  className="rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-accent-indigo/40 hover:text-accent-cyan"
                >
                  Pivot
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {trace.paths.length ? (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-600">Chain-of-custody paths</div>
          <div className="space-y-1">
            {trace.paths.slice(0, 8).map((path, i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-base-900/40">
                <button
                  onClick={() => setOpenPath(openPath === i ? null : i)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-400 hover:text-slate-200"
                >
                  <Route size={11} className="shrink-0 text-accent-cyan" />
                  <ChevronRight size={11} className={`shrink-0 transition-transform ${openPath === i ? "rotate-90" : ""}`} />
                  <span className="truncate">
                    {path.length - 1} hop{path.length - 1 === 1 ? "" : "s"} to{" "}
                    <span className="text-slate-200">{nodeLabel(trace, path[path.length - 1])?.label || shortAddr(path[path.length - 1])}</span>
                  </span>
                </button>
                {openPath === i ? (
                  <div className="border-t border-slate-800/70 px-3 py-2">
                    {path.map((addr, j) => {
                      const n = nodeLabel(trace, addr);
                      const last = j === path.length - 1;
                      return (
                        <div key={j} className="flex items-center gap-2 py-0.5">
                          <CornerDownRight size={11} className="shrink-0 text-slate-600" style={{ marginLeft: j * 8 }} />
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: vaspColor(n?.entity || n?.label || "") }}
                          />
                          <span className={`truncate text-[11px] ${last ? "font-semibold text-accent-cyan" : "text-slate-300"}`}>
                            {n?.label || shortAddr(addr, 8, 6)}
                          </span>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-600">{formatValue(n?.totalVolume, "ETH")}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
