/** Deterministic palette so a VASP keeps the same colour across charts, graphs and timelines. */
const PALETTE = [
  "#22d3ee",
  "#818cf8",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#38bdf8",
  "#fb923c",
  "#4ade80",
  "#e879f9",
  "#2dd4bf",
];

export function vaspColor(key: string | null | undefined): string {
  if (!key) return "#64748b";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const ANNOTATION_COLORS: Record<string, { dot: string; ring: string; text: string; bg: string }> = {
  amber: { dot: "#fbbf24", ring: "ring-amber-500/40", text: "text-amber-300", bg: "bg-amber-500/10" },
  rose: { dot: "#fb7185", ring: "ring-rose-500/40", text: "text-rose-300", bg: "bg-rose-500/10" },
  emerald: { dot: "#34d399", ring: "ring-emerald-500/40", text: "text-emerald-300", bg: "bg-emerald-500/10" },
  cyan: { dot: "#22d3ee", ring: "ring-cyan-500/40", text: "text-cyan-300", bg: "bg-cyan-500/10" },
  violet: { dot: "#a78bfa", ring: "ring-violet-500/40", text: "text-violet-300", bg: "bg-violet-500/10" },
};

export function confidenceColor(confidence: number): string {
  if (confidence >= 75) return "text-emerald-400";
  if (confidence >= 50) return "text-amber-400";
  return "text-slate-400";
}
