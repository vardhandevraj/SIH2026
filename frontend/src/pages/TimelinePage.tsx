import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { History, Flag, ArrowRight, Network, StickyNote, Play, Pause, Radio } from "lucide-react";
import { api } from "../api/client";
import type { AttributionTimeline, TimelinePoint, TimelineSnapshot, TraceResult } from "../api/types";
import { TimelineChart } from "../components/TimelineChart";
import { TracePanel } from "../components/TracePanel";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { Card } from "../components/Card";
import { LoadingState, ErrorState } from "../components/State";
import { vaspColor } from "../utils/colors";
import { shortAddr, formatDate, formatValue, timeAgo } from "../utils/format";

const FACTOR_LABELS: Record<string, string> = {
  knownAddressInteraction: "Known-address interaction",
  graphProximity: "Graph proximity",
  fundFlow: "Fund flow",
  clusterSimilarity: "Cluster similarity",
  behaviorSimilarity: "Behaviour similarity",
};

export function TimelinePage() {
  const { address = "" } = useParams();
  const navigate = useNavigate();

  const [timeline, setTimeline] = useState<AttributionTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const [cursor, setCursor] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<TimelineSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [traceHops, setTraceHops] = useState(3);
  const [tab, setTab] = useState<"snapshot" | "trace" | "notes">("snapshot");

  const seq = useRef(0);
  const debounce = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.timeline(address);
      setTimeline(r.timeline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the attribution timeline");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    setCursor(null);
    setSnapshot(null);
    load();
  }, [load]);

  const points = timeline?.points ?? [];
  const activeIndex = cursor ?? Math.max(0, points.length - 1);
  const activePoint: TimelinePoint | undefined = points[activeIndex];

  // Point-in-time recomputation, debounced so dragging the scrubber stays smooth.
  useEffect(() => {
    if (!activePoint) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    const ts = activePoint.ts;
    const mySeq = ++seq.current;
    debounce.current = window.setTimeout(async () => {
      setSnapshotLoading(true);
      try {
        const r = await api.timelineAt(address, ts);
        if (seq.current === mySeq) setSnapshot(r.snapshot);
      } catch {
        if (seq.current === mySeq) setSnapshot(null);
      } finally {
        if (seq.current === mySeq) setSnapshotLoading(false);
      }
    }, 160);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [activePoint, address]);

  useEffect(() => {
    let cancelled = false;
    api
      .trace(address, traceHops)
      .then((r) => {
        if (!cancelled) setTrace(r.trace);
      })
      .catch(() => {
        if (!cancelled) setTrace(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, traceHops]);

  // Playback: walk the history forward like a film reel.
  useEffect(() => {
    if (!playing || !points.length) return;
    const id = window.setInterval(() => {
      setCursor((c) => {
        const next = (c ?? 0) + 1;
        if (next >= points.length) {
          setPlaying(false);
          return points.length - 1;
        }
        return next;
      });
    }, 420);
    return () => window.clearInterval(id);
  }, [playing, points.length]);

  const firstContactIdx = useMemo(() => {
    if (!timeline?.firstContact) return -1;
    return points.findIndex((p) => new Date(p.ts).getTime() >= new Date(timeline.firstContact!.ts).getTime());
  }, [timeline, points]);

  if (loading) return <LoadingState message="Replaying attribution history..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!timeline) return null;

  if (!points.length) {
    return (
      <div>
        <Header address={address} timeline={timeline} />
        <Card className="mt-4 text-center text-sm text-slate-500">No transactions to build a timeline for this address.</Card>
      </div>
    );
  }

  return (
    <div>
      <Header address={address} timeline={timeline} />

      {timeline.firstContact ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Flag size={15} /> First VASP contact
          </div>
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">{timeline.firstContact.vaspName}</span> ·{" "}
            {formatDate(timeline.firstContact.ts)}
          </div>
          <div className="text-xs text-slate-500">
            {formatValue(timeline.firstContact.value, timeline.firstContact.tokenSymbol)} {timeline.firstContact.direction.toLowerCase()} ·{" "}
            <span className="font-mono">{shortAddr(timeline.firstContact.txHash, 10, 6)}</span>
          </div>
          {firstContactIdx >= 0 ? (
            <button
              onClick={() => setCursor(firstContactIdx)}
              className="ml-auto flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
            >
              Jump to this moment <ArrowRight size={11} />
            </button>
          ) : null}
        </div>
      ) : null}

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Attribution confidence over time</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (cursor === null) setCursor(0);
                setPlaying((p) => !p);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan"
            >
              {playing ? <Pause size={11} /> : <Play size={11} />} {playing ? "Pause" : "Replay"}
            </button>
            <span className="font-mono text-[11px] text-slate-500">
              {activeIndex + 1} / {points.length}
            </span>
          </div>
        </div>

        <TimelineChart
          timeline={timeline}
          activeTs={activePoint?.ts ?? null}
          onPick={(p) => {
            setPlaying(false);
            const idx = points.indexOf(p);
            if (idx >= 0) setCursor(idx);
          }}
        />

        <div className="mt-3 flex items-center gap-3">
          <span className="shrink-0 text-[10px] text-slate-600">{points[0] ? new Date(points[0].ts).toLocaleDateString() : ""}</span>
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={activeIndex}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-accent-cyan"
            aria-label="Timeline position"
          />
          <span className="shrink-0 text-[10px] text-slate-600">
            {points[points.length - 1] ? new Date(points[points.length - 1].ts).toLocaleDateString() : ""}
          </span>
        </div>

        {activePoint ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg bg-base-900/60 px-3 py-2 text-xs">
            <span className="text-slate-400">
              As of <span className="text-slate-200">{formatDate(activePoint.ts)}</span>
            </span>
            <span className="text-slate-500">
              confidence{" "}
              <span className="font-mono font-semibold text-accent-cyan">{activePoint.confidence}</span>
            </span>
            <span className="text-slate-500">
              <span className="font-mono font-semibold text-slate-200">{activePoint.txCount}</span> tx
            </span>
            <span className="text-slate-500">
              <span className="font-mono font-semibold text-slate-200">{activePoint.vaspInteractions}</span> VASP contacts
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-medium" style={{ color: vaspColor(activePoint.likelyVasp) }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: vaspColor(activePoint.likelyVasp) }} />
              {activePoint.likelyVasp || "Unattributed"}
            </span>
          </div>
        ) : null}
      </Card>

      <div className="mt-4">
        <div className="mb-3 flex gap-1 border-b border-slate-800">
          {([
            ["snapshot", "Point-in-time view", Radio],
            ["trace", "Multi-hop trace", Network],
            ["notes", "Annotations", StickyNote],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === key ? "border-accent-cyan text-accent-cyan" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {tab === "snapshot" ? (
          <Card>
            {snapshotLoading && !snapshot ? (
              <div className="py-8 text-center text-xs text-slate-600">Recomputing attribution for this moment...</div>
            ) : !snapshot ? (
              <div className="py-8 text-center text-xs text-slate-600">No snapshot available for this timestamp.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <span className="text-slate-400">
                    Wallet at that time:{" "}
                    <span className="font-mono text-slate-200">{snapshot.txCount}</span> tx
                  </span>
                  <span className="text-slate-400">
                    Attributed to{" "}
                    <span className="font-semibold" style={{ color: vaspColor(snapshot.attribution.likelyVasp) }}>
                      {snapshot.attribution.likelyVasp || "no known VASP"}
                    </span>
                  </span>
                  <span className="text-slate-400">
                    confidence{" "}
                    <span className="font-mono text-lg font-bold text-accent-cyan">{snapshot.attribution.confidence}</span>
                  </span>
                  <Link
                    to={`/graph/${address}`}
                    className="ml-auto flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan"
                  >
                    Open full graph <ArrowRight size={11} />
                  </Link>
                </div>

                {snapshot.attribution.factors ? (
                  <div>
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-600">Factor breakdown at this moment</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {Object.entries(snapshot.attribution.factors).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-44 shrink-0 truncate text-[11px] text-slate-500">{FACTOR_LABELS[k] || k}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-accent-cyan/70" style={{ width: `${Math.max(2, Math.min(100, (v as number) * 2.2))}%` }} />
                          </div>
                          <span className="w-8 shrink-0 text-right font-mono text-[10px] text-slate-400">{(v as number).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {snapshot.attribution.candidates.length ? (
                  <div>
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-600">Candidates at this moment</div>
                    <div className="flex flex-wrap gap-1.5">
                      {snapshot.attribution.candidates.slice(0, 6).map((c) => (
                        <span
                          key={c.vaspId}
                          className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                          style={{ borderColor: `${vaspColor(c.name)}44`, background: `${vaspColor(c.name)}12` }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: vaspColor(c.name) }} />
                          <span className="text-slate-300">{c.name}</span>
                          <span className="font-mono text-slate-400">{c.score}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="text-[10px] text-slate-600">
                  {snapshot.graph.nodes.length} nodes / {snapshot.graph.edges.length} edges existed at this point in time. Scroll the chart to
                  see how the network and the evidence evolve together.
                </div>
              </div>
            )}
          </Card>
        ) : null}

        {tab === "trace" ? (
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold text-white">Pivot from here</div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                Depth
                {[2, 3, 4].map((h) => (
                  <button
                    key={h}
                    onClick={() => setTraceHops(h)}
                    className={`rounded border px-2 py-0.5 ${traceHops === h ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan" : "border-slate-800 text-slate-500 hover:text-slate-300"}`}
                  >
                    {h} hops
                  </button>
                ))}
              </div>
            </div>
            {trace ? (
              <TracePanel trace={trace} onPivot={(a) => navigate(`/graph/${a}`)} />
            ) : (
              <div className="py-8 text-center text-xs text-slate-600">Loading trace...</div>
            )}
          </Card>
        ) : null}

        {tab === "notes" ? (
          <Card>
            <AnnotationPanel address={address} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Header({ address, timeline }: { address: string; timeline: AttributionTimeline }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <History size={20} className="text-accent-cyan" /> Attribution Timeline
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-mono text-accent-cyan">{shortAddr(address, 10, 8)}</span>
          {timeline.demo ? (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-400">Demo data</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>
          Peak confidence{" "}
          <span className="font-mono text-base font-bold text-emerald-400">{timeline.peakConfidence}</span>
        </span>
        <span>
          Net change{" "}
          <span className={`font-mono font-semibold ${timeline.confidenceDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {timeline.confidenceDelta >= 0 ? "+" : ""}
            {timeline.confidenceDelta}
          </span>
        </span>
        <span>
          Active span <span className="font-mono text-slate-300">{timeline.activeSpanDays}d</span>
        </span>
        {timeline.lastTxAt ? <span>last activity {timeAgo(timeline.lastTxAt)}</span> : null}
      </div>
    </div>
  );
}
