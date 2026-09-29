import { Loader2 } from "lucide-react";

export function RouteFallback() {
  return (
    <div className="flex items-center justify-center gap-3 py-32 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin text-accent-cyan" />
      Loading...
    </div>
  );
}

export function LoadingState({ message = "Loading analysis..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-base-900/60 py-24">
      <Loader2 size={28} className="animate-spin text-accent-cyan" />
      <div className="text-sm text-slate-300">{message}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry, hint }: { message: string; onRetry?: () => void; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 py-20 text-center">
      <div className="max-w-md text-sm text-rose-200">{message}</div>
      {hint ? <div className="max-w-md text-xs text-slate-400">{hint}</div> : null}
      {onRetry ? (
        <button onClick={onRetry} className="mt-2 rounded-lg border border-accent-indigo/40 bg-accent-indigo/20 px-4 py-2 text-sm text-accent-cyan hover:bg-accent-indigo/30">
          Retry
        </button>
      ) : null}
    </div>
  );
}
