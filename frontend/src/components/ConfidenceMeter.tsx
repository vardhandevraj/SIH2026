export function ConfidenceMeter({ value, label = "Attribution Confidence", size = 180 }: { value: number; label?: string; size?: number }) {
  const radius = (size - 24) / 2;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 70 ? "#34d399" : clamped >= 40 ? "#22d3ee" : "#f59e0b";

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold text-white" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            {Math.round(clamped)}
            <span className="text-lg text-slate-400">%</span>
          </div>
          <div className="mt-1 max-w-[120px] text-center text-[10px] uppercase leading-tight tracking-wider text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}