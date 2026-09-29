import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Star, Plus, Trash2, Bell, BellRing, RefreshCw, Loader2, Radar } from "lucide-react";
import { api, type ApiError } from "../api/client";
import type { WatchlistEntry, AlertRule, AlertEvent, AlertKind } from "../api/types";
import { Card } from "../components/Card";
import { LoadingState } from "../components/State";
import { shortAddr, timeAgo } from "../utils/format";

const ALERT_LABELS: Record<AlertKind, string> = {
  "new-transactions": "New transactions",
  "confidence-change": "Confidence shift",
  "new-vasp-contact": "New VASP contact",
};

const POLL_MS = 60000;

export function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ address: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, a] = await Promise.all([api.watchlist(), api.alertRules()]);
      setEntries(w.entries);
      setRules(a.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const runCheck = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const r = await api.checkAlerts();
      if (!mounted.current) return;
      setLastChecked(new Date().toISOString());
      if (r.events.length) setEvents((prev) => [...r.events, ...prev].slice(0, 40));
    } catch {
      if (!mounted.current) return;
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  // Background polling turns the watchlist into a monitor.
  useEffect(() => {
    if (!entries.length) return;
    const id = window.setInterval(() => runCheck(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [entries.length, runCheck]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await api.addWatchlist({ address: form.address.trim(), label: form.label.trim() || null });
      setEntries((x) => [r.entry, ...x]);
      setForm({ address: "", label: "" });
    } catch (err) {
      setError((err as ApiError).message || "Could not add to the watchlist");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setEntries((x) => x.filter((e) => e.id !== id));
    setRules((r) => r.filter((x) => x.address !== id));
    try {
      await api.removeWatchlist(id);
    } catch {
      load();
    }
  };

  const addRule = async (address: string, kind: AlertKind) => {
    try {
      const r = await api.createAlert({ address, kind });
      setRules((x) => [...x, r.rule]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the alert rule");
    }
  };

  const removeRule = async (id: string) => {
    setRules((r) => r.filter((x) => x.id !== id));
    try {
      await api.deleteAlert(id);
    } catch {
      load();
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Star size={20} className="text-amber-400" /> Watchlist & Alerts
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Monitored addresses are re-analysed automatically
            {entries.length ? ` every ${POLL_MS / 1000}s` : ""} and compared against their last known state.
          </p>
        </div>
        <button
          onClick={() => runCheck(false)}
          disabled={checking || !entries.length}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan disabled:opacity-40"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Check now
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      ) : null}

      <Card className="mb-5">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="0x... address to monitor"
            required
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-base-800 px-3 py-2 font-mono text-sm outline-none focus:border-accent-indigo"
          />
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Label (optional)"
            className="w-52 rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Watch
          </button>
        </form>
      </Card>

      {loading ? (
        <LoadingState message="Loading watchlist..." />
      ) : !entries.length ? (
        <Card className="text-center text-sm text-slate-500">
          Nothing monitored yet. Add an address above to start tracking its transactions, attribution confidence and VASP contacts.
        </Card>
      ) : (
        <div className="grid gap-3">
          {entries.map((e) => {
            const entryRules = rules.filter((r) => r.address === e.address);
            return (
              <Card key={e.id}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/wallet/${e.address}`} className="font-mono text-sm text-accent-cyan hover:underline">
                        {shortAddr(e.address, 12, 8)}
                      </Link>
                      {e.label ? <span className="text-sm text-slate-200">{e.label}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>added {timeAgo(e.createdAt)}</span>
                      {e.lastCheckedAt ? (
                        <span>
                          last checked {timeAgo(e.lastCheckedAt)} · {e.lastCheckedTxCount} tx · conf{" "}
                          <span className="text-slate-300">{e.lastCheckedConfidence}</span>
                        </span>
                      ) : (
                        <span className="text-amber-400/80">not yet checked</span>
                      )}
                      {e.tags.length ? <span>{e.tags.join(", ")}</span> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(Object.keys(ALERT_LABELS) as AlertKind[]).map((k) => {
                        const active = entryRules.some((r) => r.kind === k);
                        return (
                          <button
                            key={k}
                            onClick={() => (active ? removeRule(entryRules.find((r) => r.kind === k)!.id) : addRule(e.address, k))}
                            className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                              active
                                ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                                : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                            }`}
                          >
                            {active ? <BellRing size={9} className="mr-1 inline" /> : <Bell size={9} className="mr-1 inline" />}
                            {ALERT_LABELS[k]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to={`/timeline/${e.address}`}
                      className="flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:border-accent-indigo/40 hover:text-accent-cyan"
                    >
                      <Radar size={11} /> Timeline
                    </Link>
                    <button
                      onClick={() => remove(e.id)}
                      className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:border-rose-500/40 hover:text-rose-400"
                      aria-label="Stop watching"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {events.length ? (
        <Card className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <BellRing size={15} className="text-amber-400" /> Alert feed
            {lastChecked ? <span className="text-[11px] font-normal text-slate-600">checked {timeAgo(lastChecked)}</span> : null}
          </div>
          <div className="space-y-1.5">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  ev.severity === "critical"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    : ev.severity === "warning"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : "border-slate-800 bg-base-900/50 text-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] opacity-70">{shortAddr(ev.address)}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">{ev.kind}</span>
                  <span className="ml-auto text-[10px] opacity-60">{timeAgo(ev.createdAt)}</span>
                </div>
                <div className="mt-0.5">{ev.message}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {entries.length && !events.length ? (
        <div className="mt-4 text-center text-[11px] text-slate-600">
          No alerts triggered yet. Alerts fire when a watched wallet gains transactions, shifts attribution confidence, or contacts a new VASP.
        </div>
      ) : null}
    </div>
  );
}
