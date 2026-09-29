import { useEffect, useState } from "react";
import { FlaskConical, Server, Database, KeyRound, Settings, Gauge } from "lucide-react";
import { api } from "../api/client";
import type { HealthStatus } from "../api/types";
import { LoadingState, ErrorState } from "../components/State";
import { Card, SectionTitle } from "../components/Card";
import { useDemoMode } from "../context/DemoContext";

function StatusBadge({ ok }: { ok: boolean }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-500"}`}>{ok ? "OK" : "Off"}</span>;
}

export function SettingsPage() {
  const { demoMode, setDemoMode } = useDemoMode();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .health()
      .then(setHealth)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <Settings size={20} className="text-accent-cyan" /> Settings
        </h1>
        <p className="mt-1 text-xs text-slate-500">Runtime configuration, data source status and attribution weights.</p>
      </div>

      <Card>
        <SectionTitle>
          <FlaskConical size={14} /> Demo Mode
        </SectionTitle>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-200">Use DEMO data when blockchain API keys are unavailable</div>
            <div className="mt-1 text-xs text-slate-500">
              When enabled, the system generates clearly-labelled synthetic blockchain data so the full flow (graph, scoring, evidence,
              report) can be demonstrated end-to-end without any API keys.
            </div>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${demoMode ? "bg-accent-indigo" : "bg-slate-700"}`}
            aria-label="Toggle demo mode"
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${demoMode ? "left-8" : "left-1"}`} />
          </button>
        </label>
      </Card>

      {loading ? (
        <LoadingState message="Checking backend health..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : health ? (
        <>
          <Card>
            <SectionTitle>
              <Server size={14} /> Backend & Data Sources
            </SectionTitle>
            <div className="space-y-2">
              {[
                { key: "SQLite", val: health.services.database, ok: health.services.database === "sqlite" },
                { key: "Alchemy", val: health.services.alchemy, ok: health.services.alchemy === "configured" },
                { key: "Etherscan", val: health.services.etherscan, ok: health.services.etherscan === "configured" },
                { key: "Groq", val: health.services.groq, ok: health.services.groq === "configured" },
                { key: "Python analysis service", val: health.services.pythonAnalysis, ok: health.services.pythonAnalysis === "configured" },
              ].map((s) => (
                <div key={s.key} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Database size={14} className="text-slate-500" /> {s.key}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {s.val === "configured" ? "configured" : s.val === "sqlite" ? "connected" : "not configured"}
                    </span>
                    <StatusBadge ok={s.ok} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-slate-500">
              API keys live only in the backend environment (<span className="font-mono">.env</span>). They are never sent to the browser. The database is a{" "}
              local SQLite file (<span className="font-mono">backend/data/chaintrace.db</span>).
            </div>
          </Card>

          <Card>
            <SectionTitle>
              <KeyRound size={14} /> Environment
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-base-900/60 px-3 py-2">
                <div className="text-slate-500">Demo mode (server)</div>
                <div className="font-mono text-slate-200">{health.demoMode ? "true" : "false"}</div>
              </div>
              <div className="rounded-lg bg-base-900/60 px-3 py-2">
                <div className="text-slate-500">Demo wallet</div>
                <div className="font-mono text-accent-cyan">{health.demoWallet.slice(0, 16)}...</div>
              </div>
              <div className="rounded-lg bg-base-900/60 px-3 py-2">
                <div className="text-slate-500">Uptime</div>
                <div className="font-mono text-slate-200">{Math.floor(health.uptimeSeconds / 60)}m</div>
              </div>
              <div className="rounded-lg bg-base-900/60 px-3 py-2">
                <div className="text-slate-500">Stored</div>
                <div className="font-mono text-slate-200">
                  {health.store.vasps} VASPs · {health.store.investigations} investigations · {health.store.reports} reports
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>
              <Gauge size={14} /> Attribution Factor Weights (configurable)
            </SectionTitle>
            <div className="space-y-2">
              {[
                ["A. Known VASP Address Interaction", health.attributionWeights.knownAddressInteraction],
                ["B. Graph Distance / Transaction Proximity", health.attributionWeights.graphProximity],
                ["C. Fund Flow Relationship", health.attributionWeights.fundFlow],
                ["D. Wallet Cluster Similarity", health.attributionWeights.clusterSimilarity],
                ["E. Transaction Behaviour Similarity", health.attributionWeights.behaviorSimilarity],
              ].map(([label, w]) => (
                <div key={label as string} className="flex items-center gap-3">
                  <div className="w-60 shrink-0 text-xs text-slate-300">{label as string}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full rounded bg-gradient-to-r from-accent-indigo to-accent-violet"
                      style={{ width: `${Math.max(0, Math.min(100, (w as number) / 1.05))}%` }}
                    />
                  </div>
                  <div className="w-10 text-right font-mono text-xs text-slate-300">{w}%</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-slate-500">
              Set <span className="font-mono">ATTRIBUTION_WEIGHTS</span> JSON in the backend environment to override.
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}