import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GitCompare, ArrowRight, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api/client";
import type { InvestigationRow, InvestigationDiff } from "../api/types";
import { Card } from "../components/Card";
import { LoadingState } from "../components/State";
import { shortAddr, formatDate } from "../utils/format";

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="flex items-center gap-0.5 text-slate-500"><Minus size={10} />0</span>;
  const positive = value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 ${positive ? "text-emerald-400" : "text-rose-400"}`}>
      <Icon size={10} />
      {positive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

export function DiffPage() {
  const [rows, setRows] = useState<InvestigationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [diff, setDiff] = useState<InvestigationDiff | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .investigations()
      .then((r) => {
        setRows(r.investigations);
        if (r.investigations.length >= 2) {
          setA(r.investigations[1].id);
          setB(r.investigations[0].id);
        } else if (r.investigations.length === 1) {
          setA(r.investigations[0].id);
          setB(r.investigations[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load investigations"))
      .finally(() => setLoading(false));
  }, []);

  const compare = useCallback(async () => {
    if (!a || !b) return;
    setRunning(true);
    setError(null);
    setDiff(null);
    try {
      const r = await api.diff(a, b);
      setDiff(r.diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not compare those investigations");
    } finally {
      setRunning(false);
    }
  }, [a, b]);

  useEffect(() => {
    if (a && b) compare();
  }, [a, b, compare]);

  const grouped = useMemo(() => {
    const map = new Map<string, InvestigationRow[]>();
    for (const r of rows) {
      const key = r.address.toLowerCase();
      map.set(key, [...(map.get(key) || []), r]);
    }
    return map;
  }, [rows]);

  const select = (
    <select
      className="rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
      value=""
      onChange={(e) => {
        const r = rows.find((x) => x.id === e.target.value);
        if (!r) return;
        setA(b || r.id);
        setB(r.id);
      }}
    >
      <option value="">Jump to a recent analysis...</option>
      {Array.from(grouped.entries()).map(([addr, list]) => (
        <optgroup key={addr} label={`${shortAddr(addr, 10, 6)} — ${list[0].likelyVasp ?? "unattributed"}`}>
          {list.map((r) => (
            <option key={r.id} value={r.id}>
              {formatDate(r.analyzedAt)} · confidence {r.confidence}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  if (loading) return <LoadingState message="Loading investigations..." />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <GitCompare size={20} className="text-accent-cyan" /> Investigation Diff
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Compare two analysis runs of the same wallet to see exactly what new evidence changed the attribution.
        </p>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      {!rows.length ? (
        <Card className="text-center text-sm text-slate-500">No investigations yet. Analyse a wallet first.</Card>
      ) : (
        <>
          <Card className="mb-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Before</div>
                <select
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.analyzedAt)} · {shortAddr(r.address)} · {r.likelyVasp ?? "unattributed"} ({r.confidence})
                    </option>
                  ))}
                </select>
              </div>
              <ArrowRight size={16} className="mb-3 shrink-0 text-slate-600" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">After</div>
                <select
                  value={b}
                  onChange={(e) => setB(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.analyzedAt)} · {shortAddr(r.address)} · {r.likelyVasp ?? "unattributed"} ({r.confidence})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto">{select}</div>
            </div>
          </Card>

          {running ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-accent-cyan" /> Comparing...
            </div>
          ) : diff ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Card>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">Confidence</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-xl font-bold text-slate-200">{diff.a.confidence}</span>
                    <ArrowRight size={12} className="text-slate-600" />
                    <span className="font-mono text-xl font-bold text-accent-cyan">{diff.b.confidence}</span>
                  </div>
                  <div className="mt-0.5 text-xs">
                    <Delta value={diff.confidenceDelta} />
                  </div>
                </Card>
                <Card>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">Transactions</div>
                  <div className="mt-1 flex items-baseline gap-2 font-mono text-xl font-bold">
                    <span className="text-slate-200">{diff.a.txCount}</span>
                    <ArrowRight size={12} className="text-slate-600" />
                    <span className="text-accent-cyan">{diff.b.txCount}</span>
                  </div>
                  <div className="mt-0.5 text-xs">
                    <Delta value={diff.txCountDelta} />
                  </div>
                </Card>
                <Card>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">Attribution</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">
                    {diff.vaspChanged ? (
                      <span className="text-amber-400">changed</span>
                    ) : (
                      <span className="text-emerald-400">stable</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{diff.b.likelyVasp ?? "unattributed"}</div>
                </Card>
                <Card>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">Same wallet</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">{diff.sameAddress ? "yes" : "no — different wallets"}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {formatDate(diff.a.analyzedAt)} → {formatDate(diff.b.analyzedAt)}
                  </div>
                </Card>
              </div>

              <Card>
                <div className="mb-3 text-sm font-semibold text-white">Factor movement</div>
                <div className="space-y-2">
                  {diff.factorChanges.map((f) => {
                    const max = Math.max(f.a, f.b, 1);
                    return (
                      <div key={f.key} className="flex items-center gap-3">
                        <span className="w-44 shrink-0 text-[11px] text-slate-500">{f.label}</span>
                        <div className="relative h-5 flex-1 overflow-hidden rounded bg-base-900">
                          <div className="absolute left-0 top-0 h-full bg-slate-700/60" style={{ width: `${(f.a / max) * 100}%` }} />
                          <div
                            className="absolute left-0 top-0 h-full bg-accent-cyan/60"
                            style={{ width: `${(f.b / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right font-mono text-[11px] text-slate-400">
                          {f.a.toFixed(1)} → {f.b.toFixed(1)}
                        </span>
                        <span className="w-16 shrink-0 text-right text-[11px]">
                          <Delta value={Number(f.delta.toFixed(1))} />
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-4 text-[10px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 bg-slate-700/60" /> before
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 bg-accent-cyan/60" /> after
                  </span>
                </div>
              </Card>

              <Card>
                <div className="mb-3 text-sm font-semibold text-white">Candidate score shifts</div>
                {diff.candidateChanges.length ? (
                  <div className="space-y-1.5">
                    {diff.candidateChanges.map((c) => (
                      <div key={c.name} className="flex items-center gap-3 text-xs">
                        <span className="w-56 shrink-0 truncate text-slate-300">{c.name}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-accent-cyan/70" style={{ width: `${Math.max(1, c.bScore)}%` }} />
                        </div>
                        <span className="w-24 shrink-0 text-right font-mono text-slate-400">
                          {c.aScore} → {c.bScore}
                        </span>
                        <span className="w-14 shrink-0 text-right">
                          <Delta value={c.delta} />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">No candidate differences.</div>
                )}
              </Card>

              <div className="flex gap-3 text-xs">
                <Link
                  to={`/investigation/${diff.a.id}`}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan"
                >
                  Open "before" investigation
                </Link>
                <Link
                  to={`/investigation/${diff.b.id}`}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan"
                >
                  Open "after" investigation
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
