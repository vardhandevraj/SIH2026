import type { ReactNode } from "react";

export function StatCard({ icon, label, value, sub }: { icon?: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold text-white" style={{ fontFamily: "JetBrains Mono, monospace" }}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}