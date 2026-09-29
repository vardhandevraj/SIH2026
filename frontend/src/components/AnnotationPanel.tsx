import { useCallback, useEffect, useState, type FormEvent } from "react";
import { StickyNote, Plus, Trash2, Loader2 } from "lucide-react";
import { api } from "../api/client";
import type { AddressAnnotation, AnnotationColor } from "../api/types";
import { ANNOTATION_COLORS } from "../utils/colors";
import { shortAddr, timeAgo } from "../utils/format";

const COLOR_ORDER: AnnotationColor[] = ["amber", "rose", "emerald", "cyan", "violet"];

export function AnnotationPanel({ address, compact = false }: { address: string; compact?: boolean }) {
  const [notes, setNotes] = useState<AddressAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [color, setColor] = useState<AnnotationColor>("amber");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const r = await api.annotations(address);
      setNotes(r.annotations);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    setNote("");
    load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.createAnnotation({ address, note: note.trim(), color });
      setNotes((n) => [r.annotation, ...n]);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      await api.deleteAnnotation(id);
    } catch {
      load();
    }
  };

  return (
    <div>
      <form onSubmit={add} className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="Record an investigative finding for this address..."
          className="w-full resize-y rounded-lg border border-slate-700 bg-base-800 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-accent-indigo"
        />
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className={`h-4 w-4 rounded-full ring-2 ring-offset-1 ring-offset-base-900 ${ANNOTATION_COLORS[c].ring} ${color === c ? "scale-110" : "opacity-50"}`}
                style={{ background: ANNOTATION_COLORS[c].dot }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="btn-gradient ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Annotate
          </button>
        </div>
        {error ? <div className="text-[11px] text-rose-400">{error}</div> : null}
      </form>

      <div className="mt-3 space-y-2">
        {loading && !notes.length ? <div className="text-xs text-slate-600">Loading notes...</div> : null}
        {!loading && !notes.length ? <div className="text-xs text-slate-600">No annotations yet for {shortAddr(address)}.</div> : null}
        {notes.map((n) => {
          const c = ANNOTATION_COLORS[n.color] ?? ANNOTATION_COLORS.amber;
          return (
            <div key={n.id} className={`group rounded-lg border border-slate-800 ${c.bg} px-3 py-2`}>
              <div className="flex items-start gap-2">
                <StickyNote size={12} style={{ color: c.dot }} className="mt-0.5 shrink-0" />
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-200">{n.note}</p>
                <button
                  onClick={() => remove(n.id)}
                  className="shrink-0 text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                  aria-label="Delete note"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="mt-1 pl-5 text-[10px] text-slate-500">
                {timeAgo(n.createdAt)}
                {n.tags.length ? ` · ${n.tags.join(", ")}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
