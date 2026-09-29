import type { ReactNode, CSSProperties } from "react";

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`glass rounded-xl p-5 ${className}`} style={style}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">{children}</h2>
      {right}
    </div>
  );
}