import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { api } from "../api/client";
import type { VaspEntity } from "../api/types";
import { LoadingState } from "../components/State";
import { Card } from "../components/Card";
import { formatDate } from "../utils/format";

const emptyForm = (): { name: string; entityType: string; address: string; label: string; source: string; confidence: number } => ({
  name: "",
  entityType: "",
  address: "",
  label: "",
  source: "manual",
  confidence: 50,
});

export function VaspsPage() {
  const [vasps, setVasps] = useState<VaspEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const didMount = useRef(false);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.vasps(q || undefined);
      setVasps(r.vasps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load VASP database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const id = setTimeout(() => {
      load(search);
    }, 250);
    return () => clearTimeout(id);
  }, [search, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createVasp({
        name: form.name,
        entityType: form.entityType,
        knownAddresses: [{ address: form.address, label: form.label || "Manually added", demoSample: false }],
        source: form.source,
        confidence: form.confidence,
        tags: ["manual", "investigator-added"],
      });
      setForm(emptyForm());
      setShowForm(false);
      load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create VASP");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this VASP entity and its known addresses?")) return;
    try {
      await api.deleteVasp(id);
      load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete VASP");
    }
  };

  const count = vasps.reduce((acc, v) => acc + (v.knownAddresses?.length ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Building2 size={20} className="text-accent-cyan" /> VASP Known-Address Database
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {vasps.length} entities · {count} known addresses · seeded/sample addresses are clearly marked{" "}
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">DEMO / SAMPLE ADDRESS</span>. Do not treat invented
            addresses as verified real-world VASP labels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entities..."
              className="w-52 rounded-lg border border-slate-700 bg-base-800 px-8 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-gradient flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white">
            <Plus size={14} /> Add VASP
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <span>{error}</span>
          <button onClick={() => load(search)} className="shrink-0 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs hover:bg-rose-500/10">
            Retry
          </button>
        </div>
      ) : null}

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Name (e.g. Demo Exchange)" className="rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo" />
            <input value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} required placeholder="Entity type (e.g. Exchange - CEX)" className="rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required placeholder="0x... known address" className="rounded-lg border border-slate-700 bg-base-800 px-3 py-2 font-mono text-xs outline-none focus:border-accent-indigo" />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Address label (optional)" className="rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo" />
            <button type="submit" disabled={saving} className="btn-gradient flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save VASP
            </button>
          </form>
          <div className="mt-2 text-[11px] text-slate-500">
            New addresses are added as non-demo ("verified/manual" source). Demo labels are only applied by the built-in seed data.
          </div>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState message="Loading VASP database..." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {vasps.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">{v.name}</div>
                  <div className="text-xs text-slate-500">
                    {v.entityType} · {v.blockchain}
                  </div>
                </div>
                <button onClick={() => remove(v.id)} className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:border-rose-500/40 hover:text-rose-400">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(v.tags ?? []).map((t) => (
                  <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {t}
                  </span>
                ))}
                {v.source && v.source !== "manual" ? (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">{v.source}</span>
                ) : null}
              </div>
              <button onClick={() => setExpanded(expanded === v.id ? null : v.id)} className="mt-3 text-xs text-accent-cyan hover:underline">
                {expanded === v.id ? "Hide" : "Show"} known addresses ({v.knownAddresses?.length ?? 0})
              </button>
              <div className="mt-2 text-[11px] text-slate-600">Updated {formatDate(v.lastUpdated)}</div>
              {expanded === v.id ? (
                <div className="mt-3 space-y-1.5">
                  {(v.knownAddresses ?? []).map((a) => (
                    <div key={a.address} className="flex items-center justify-between gap-2 rounded-lg bg-base-900/60 px-3 py-1.5">
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] text-accent-cyan">{a.address}</span>
                        <div className="text-[10px] text-slate-500">{a.label}</div>
                      </div>
                      {a.demoSample ? (
                        <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase text-amber-400">Demo / Sample</span>
                      ) : (
                        <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase text-emerald-400">Manual</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <div className="mt-4 text-[11px] text-slate-600">
        Tip: for runtime address lookups during analysis, addresses may be added via <span className="font-mono">POST /api/vasps</span>.
      </div>
    </div>
  );
}