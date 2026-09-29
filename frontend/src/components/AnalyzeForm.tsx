import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, PlayCircle, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useDemoMode } from "../context/DemoContext";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const DEMO_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

export function AnalyzeForm({ compact = false }: { compact?: boolean }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { demoMode } = useDemoMode();

  const run = async (addr: string, forceDemo: boolean) => {
    if (!ADDRESS_RE.test(addr)) {
      setError("Invalid Ethereum address. Expected 0x followed by 40 hex characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.analyze(addr, forceDemo);
      navigate(`/wallet/${res.investigation.address}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again or enable Demo Mode.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = address.trim();
    if (!input) {
      setError("Enter an Ethereum wallet address.");
      return;
    }
    run(input, demoMode).catch(() => undefined);
  };

  return (
    <div className={compact ? "" : "w-full max-w-2xl"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
            spellCheck={false}
            className="w-full rounded-xl border border-slate-700 bg-base-800/80 py-3 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-accent-indigo focus:ring-2 focus:ring-accent-indigo/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-gradient glow flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Analyzing..." : "Analyze Wallet"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setError(null);
            run(DEMO_ADDRESS, true).catch(() => undefined);
          }}
          className="flex items-center gap-2 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan hover:bg-accent-cyan/20"
        >
          <PlayCircle size={14} /> Run Demo Investigation
        </button>
        <button
          onClick={() => setAddress(DEMO_ADDRESS)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
        >
          Use example address
        </button>
      </div>
      {error ? <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div> : null}
    </div>
  );
}