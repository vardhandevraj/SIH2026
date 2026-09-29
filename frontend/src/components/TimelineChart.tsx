import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flag } from "lucide-react";
import type { AttributionTimeline, TimelinePoint } from "../api/types";
import { vaspColor } from "../utils/colors";

const day = (ts: string) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Points where the leading VASP changes - the single most interesting thing on this chart. */
function findHandoffs(points: TimelinePoint[]): TimelinePoint[] {
  const out: TimelinePoint[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].likelyVasp && points[i].likelyVasp !== points[i - 1].likelyVasp) out.push(points[i]);
  }
  return out;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: TimelinePoint }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-base-900/95 px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400">{new Date(p.ts).toLocaleString()}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: vaspColor(p.likelyVasp) }} />
        <span className="font-semibold text-white">{p.likelyVasp || "Unattributed"}</span>
        <span className="ml-auto font-mono text-accent-cyan">{p.confidence}</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {p.txCount} tx in bucket · {p.vaspInteractions} VASP contacts · {p.cumulativeTxCount} cumulative
      </div>
    </div>
  );
}

/**
 * Flagship view: how attribution confidence evolved over the wallet's history.
 * The lower band shows which VASP led at each point, making handoffs obvious.
 */
export function TimelineChart({
  timeline,
  activeTs,
  onPick,
}: {
  timeline: AttributionTimeline;
  activeTs: string | null;
  onPick: (point: TimelinePoint) => void;
}) {
  const handoffs = useMemo(() => findHandoffs(timeline.points), [timeline.points]);

  // One stacked series per VASP so the bottom band reads as a "who was in charge" ribbon.
  const { bandData, bandKeys } = useMemo(() => {
    const names = Array.from(new Set(timeline.points.map((p) => p.likelyVasp).filter(Boolean))) as string[];
    const rows = timeline.points.map((p) => {
      const row: Record<string, number | string> = { ts: p.ts, confidence: p.confidence, likelyVasp: p.likelyVasp || "Unattributed" };
      for (const n of names) row[n] = p.likelyVasp === n ? 1 : 0;
      return row;
    });
    return { bandData: rows, bandKeys: names };
  }, [timeline.points]);

  const firstContactX = timeline.firstContact?.ts ?? null;

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeline.points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} onClick={(e) => onPick((e?.activePayload?.[0]?.payload ?? e) as TimelinePoint)}>
            <defs>
              <linearGradient id="confFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              tickFormatter={day}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#1e293b" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={38} />
            <Tooltip content={<Tip />} cursor={{ stroke: "#334155", strokeDasharray: "4 4" }} />
            {handoffs.map((h) => (
              <ReferenceLine key={h.ts} x={h.ts} stroke="#818cf8" strokeDasharray="3 3" label={{ value: "⇄", fill: "#818cf8", fontSize: 11, position: "insideTopRight" }} />
            ))}
            {firstContactX ? (
              <ReferenceLine x={firstContactX} stroke="#34d399" strokeWidth={1.5} label={{ value: "1st VASP", fill: "#34d399", fontSize: 10, position: "top" }} />
            ) : null}
            {activeTs ? <ReferenceLine x={activeTs} stroke="#ffffff" strokeWidth={1.5} /> : null}
            <Area
              type="monotone"
              dataKey="confidence"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#confFill)"
              isAnimationActive={false}
              activeDot={{ r: 4, fill: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600">
        <span>Leading VASP</span>
        {bandKeys.map((k) => (
          <span key={k} className="flex items-center gap-1 normal-case">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: vaspColor(k) }} />
            <span className="text-slate-500">{k}</span>
          </span>
        ))}
      </div>

      {bandKeys.length > 0 ? (
        <div className="mt-1 h-7 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bandData} margin={{ top: 0, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="ts" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { likelyVasp: string } | undefined;
                  if (!active || !p) return null;
                  return <div className="rounded border border-slate-700 bg-base-900/95 px-2 py-1 text-[11px] text-white">{p.likelyVasp}</div>;
                }}
              />
              {bandKeys.map((k) => (
                <Bar key={k} dataKey={k} stackId="lead" isAnimationActive={false}>
                  {bandData.map((row, i) => (
                    <Cell key={i} fill={vaspColor(k)} fillOpacity={row[k] ? 0.9 : 0.06} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {handoffs.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent-indigo/25 bg-accent-indigo/10 px-3 py-2 text-xs text-accent-cyan">
          <Flag size={13} />
          <span className="text-slate-300">
            {handoffs.length} attribution handoff{handoffs.length === 1 ? "" : "s"} detected - the leading VASP changed mid-history.
          </span>
          {handoffs.map((h) => (
            <button
              key={h.ts}
              onClick={() => onPick(h)}
              className="rounded bg-white/5 px-2 py-0.5 text-[11px] hover:bg-white/10"
              title="Jump to handoff"
            >
              {day(h.ts)} → {h.likelyVasp}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
