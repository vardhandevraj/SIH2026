import { Link } from "react-router-dom";
import { Radar, Network, ShieldCheck, FileText, Sparkles, ArrowRight } from "lucide-react";
import { AnalyzeForm } from "../components/AnalyzeForm";

const features = [
  { icon: Network, title: "Automated Wallet Intelligence", desc: "Fetch real on-chain activity, normalise transactions and build an address relationship graph with a live blockchain fabric." },
  { icon: ShieldCheck, title: "Transaction & VASP Attribution", desc: "Explainable, deterministic scoring across five weighted signals to identify the nearest probable Virtual Asset Service Provider." },
  { icon: FileText, title: "Risk & Investigation Dashboard", desc: "Evidence cards, fund-flow chains, risk indicators and a downloadable investigation report for forensic workflows." },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-base-950 text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.12),transparent_50%)]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl btn-gradient glow">
            <Radar size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-wide text-white">ChainTrace</span>
        </div>
        <Link to="/dashboard" className="flex items-center gap-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
          Open App <ArrowRight size={14} />
        </Link>
      </header>

      <main className="relative mx-auto max-w-6xl px-6">
        <section className="py-16 text-center sm:py-24">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-accent-indigo/30 bg-accent-indigo/10 px-4 py-1.5 text-xs text-accent-cyan">
            <Sparkles size={12} /> Probabilistic Attribution · Explainable Evidence · Blockchain Intelligence
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            Blockchain Intelligence for <span className="text-gradient">Wallet Attribution</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 sm:text-lg">
            Trace unknown cryptocurrency wallets, uncover transaction relationships and identify probable VASP connections using
            explainable blockchain intelligence.
          </p>
          <div className="mt-9 flex justify-center">
            <AnalyzeForm />
          </div>
        </section>

        <section className="grid gap-5 pb-20 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-indigo/15 text-accent-cyan">
                <Icon size={19} />
              </div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </section>

        <section className="glass mb-20 rounded-2xl p-6">
          <h3 className="mb-3 text-sm font-semibold text-accent-cyan">How attribution works (deterministic, no LLM guessing)</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {["Validate address", "Fetch on-chain data", "Normalise transactions", "Build relationship graph", "Match known VASP addresses", "Score 5 weighted signals", "Assemble evidence", "Generate report"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="rounded-lg border border-slate-700 bg-base-800/70 px-2.5 py-1.5">{s}</span>
                {i < arr.length - 1 ? <ArrowRight size={12} className="text-slate-600" /> : null}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}