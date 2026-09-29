import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Plus, Trash2, Loader2, X, CheckCircle2 } from "lucide-react";
import { api } from "../api/client";
import type { CaseFile } from "../api/types";
import { Card } from "../components/Card";
import { LoadingState } from "../components/State";
import { shortAddr, timeAgo } from "../utils/format";

export function CasesPage() {
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.cases();
      setCases(r.cases);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.createCase({ name: name.trim(), description: description.trim() || null });
      setCases((c) => [r.case, ...c]);
      setName("");
      setDescription("");
      setExpanded(r.case.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the case");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: CaseFile) => {
    const status = c.status === "open" ? "closed" : "open";
    setCases((x) => x.map((i) => (i.id === c.id ? { ...i, status } : i)));
    try {
      await api.updateCase(c.id, { status });
    } catch {
      load();
    }
  };

  const remove = async (c: CaseFile) => {
    if (!window.confirm(`Delete case "${c.name}" and all of its entries?`)) return;
    setCases((x) => x.filter((i) => i.id !== c.id));
    try {
      await api.deleteCase(c.id);
    } catch {
      load();
    }
  };

  const addEntry = async (caseId: string) => {
    const addr = (draft[caseId] || "").trim();
    if (!addr) return;
    setDraft((d) => ({ ...d, [caseId]: "" }));
    try {
      const r = await api.addCaseEntry(caseId, { address: addr });
      setCases((x) => x.map((c) => (c.id === caseId ? { ...c, entries: [...c.entries, r.entry] } : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the address");
    }
  };

  const removeEntry = async (caseId: string, entryId: string) => {
    setCases((x) => x.map((c) => (c.id === caseId ? { ...c, entries: c.entries.filter((e) => e.id !== entryId) } : c)));
    try {
      await api.removeCaseEntry(entryId);
    } catch {
      load();
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <FolderOpen size={20} className="text-accent-cyan" /> Case Files
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Group related addresses into an investigation so evidence, annotations and wallets stay together.
        </p>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      <Card className="mb-5">
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Case name (e.g. Operation Foglight)"
            required
            className="w-64 rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} New case
          </button>
        </form>
      </Card>

      {loading ? (
        <LoadingState message="Loading cases..." />
      ) : !cases.length ? (
        <Card className="text-center text-sm text-slate-500">No cases yet. Create one above to start grouping wallets.</Card>
      ) : (
        <div className="grid gap-3">
          {cases.map((c) => {
            const open = expanded === c.id;
            return (
              <Card key={c.id} className={c.status === "closed" ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          c.status === "open" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/40 text-slate-400"
                        }`}
                      >
                        {c.status}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {c.entries.length} address{c.entries.length === 1 ? "" : "es"}
                      </span>
                    </div>
                    {c.description ? <p className="mt-1 text-xs text-slate-400">{c.description}</p> : null}
                    <div className="mt-1 text-[10px] text-slate-600">
                      created {timeAgo(c.createdAt)} · updated {timeAgo(c.updatedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => toggleStatus(c)}
                      className="flex items-center gap-1 rounded-lg border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    >
                      <CheckCircle2 size={10} /> {c.status === "open" ? "Close" : "Reopen"}
                    </button>
                    <button
                      onClick={() => setExpanded(open ? null : c.id)}
                      className="rounded-lg border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    >
                      {open ? "Hide" : "Open"}
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:border-rose-500/40 hover:text-rose-400"
                      aria-label="Delete case"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    {c.entries.length ? (
                      <div className="mb-3 space-y-1.5">
                        {c.entries.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 rounded-lg bg-base-900/60 px-3 py-1.5">
                            <Link to={`/wallet/${e.address}`} className="font-mono text-[11px] text-accent-cyan hover:underline">
                              {shortAddr(e.address, 10, 6)}
                            </Link>
                            <Link to={`/timeline/${e.address}`} className="text-[11px] text-slate-400 hover:text-accent-cyan">
                              {e.label || "Timeline"}
                            </Link>
                            {e.note ? <span className="truncate text-[11px] text-slate-500">{e.note}</span> : null}
                            <button
                              onClick={() => removeEntry(c.id, e.id)}
                              className="ml-auto shrink-0 text-slate-600 hover:text-rose-400"
                              aria-label="Remove from case"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-3 text-xs text-slate-600">No addresses in this case yet.</div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={draft[c.id] || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addEntry(c.id);
                          }
                        }}
                        placeholder="0x... address to add to this case"
                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-base-800 px-3 py-1.5 font-mono text-xs outline-none focus:border-accent-indigo"
                      />
                      <button
                        onClick={() => addEntry(c.id)}
                        className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
