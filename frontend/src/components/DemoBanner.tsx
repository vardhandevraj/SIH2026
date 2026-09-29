import { AlertTriangle } from "lucide-react";
import { useDemoMode } from "../context/DemoContext";

export function DemoBanner() {
  const { demoMode } = useDemoMode();
  if (!demoMode) return null;
  return (
    <div className="no-print border-b border-amber-500/20 bg-amber-500/10 px-6 py-2">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 text-xs text-amber-300">
        <AlertTriangle size={13} />
        <span className="font-semibold uppercase tracking-widest">DEMO DATA</span>
        <span className="text-amber-200/70">
          Synthetic sample data is being shown. Do not treat as verified on-chain evidence. Disable Demo Mode in Settings to use live Alchemy/Etherscan data.
        </span>
      </div>
    </div>
  );
}