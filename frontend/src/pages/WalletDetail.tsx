import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Share2, FileText, ExternalLink, Network, Loader2, CheckCircle2, Bot, History, Star, StickyNote } from "lucide-react";
import { api } from "../api/client";
import type { Investigation } from "../api/types";
import { LoadingState, ErrorState } from "../components/State";
import { Card, SectionTitle } from "../components/Card";
import { ConfidenceMeter } from "../components/ConfidenceMeter";
import { WalletOverviewPanel } from "../components/WalletOverviewPanel";
import { GraphExplorer } from "../components/GraphExplorer";
import { EvidenceCard } from "../components/EvidenceCard";
import { TransactionTable } from "../components/TransactionTable";
import { FundFlowView } from "../components/FundFlowView";
import { SummaryPanel } from "../components/SummaryPanel";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { formatDate, shortAddr } from "../utils/format";

export function WalletDetail() {
  const { address = "" } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .wallet(address)
      .then((r) => setInv(r.investigation))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    api
      .watchlist()
      .then((r) => {
        if (!cancelled) setWatched(r.entries.some((e) => e.address.toLowerCase() === address.toLowerCase()));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [address]);

  const toggleWatch = async () => {
    if (!inv) return;
    const next = !watched;
    setWatched(next);
    try {
      if (next) await api.addWatchlist({ address: inv.address, label: a.likelyVasp });
      else {
        const r = await api.watchlist();
        const entry = r.entries.find((e) => e.address.toLowerCase() === inv.address.toLowerCase());
        if (entry) await api.removeWatchlist(entry.id);
      }
    } catch {
      setWatched(!next);
    }
  };

  const generateReport = async () => {
    if (!inv || reporting) return;
    setReporting(true);
    setError(null);
    try {
      await api.generateReport(inv.id);
      navigate(`/investigation/${inv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate report");
    } finally {
      setReporting(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(inv?.address ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy to clipboard. Select the address manually.");
    }
  };

  const visibleTx = useMemo(() => {
    const txs = inv?.transactions;
    if (!txs || showAllTx) return txs ?? [];
    return [...txs].sort((x, y) => y.timestamp.localeCompare(x.timestamp)).slice(0, 50);
  }, [inv, showAllTx]);

  if (loading) return <LoadingState message={`Analyzing wallet ${shortAddr(address, 10, 8)}...`} />;
  if (error && !inv) return <ErrorState message={error} onRetry={load} hint="Check that the backend is running, or enable Demo Mode in Settings." />;
  if (!inv) return <ErrorState message="No investigation data returned." onRetry={load} />;

  const a = inv.attribution;
  const candidate = a.candidates[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Investigation Dashboard</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm text-accent-cyan">{inv.wallet.address}</span>
            <a
              href={`https://etherscan.io/address/${inv.wallet.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-accent-cyan"
            >
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Analyzed {formatDate(inv.analyzedAt)} · {a.method}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/timeline/${inv.address}`}
            className="flex items-center gap-2 rounded-lg border border-accent-indigo/40 bg-accent-indigo/15 px-3 py-2 text-xs font-medium text-accent-cyan hover:bg-accent-indigo/25"
          >
            <History size={14} /> Attribution Timeline
          </Link>
          <Link to={`/graph/${inv.address}`} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
            <Network size={14} /> Full Graph
          </Link>
          <button
            onClick={toggleWatch}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-white/5 ${
              watched ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-slate-700 text-slate-300"
            }`}
            title={watched ? "Stop monitoring this wallet" : "Monitor this wallet for changes"}
          >
            <Star size={14} fill={watched ? "currentColor" : "none"} /> {watched ? "Watching" : "Watch"}
          </button>
          <button onClick={copyAddress} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Share2 size={14} />} {copied ? "Copied" : "Copy Address"}
          </button>
          <button
            onClick={generateReport}
            disabled={reporting}
            className="btn-gradient flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
          >
            {reporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Generate Investigation Report
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Wallet Overview</SectionTitle>
          <WalletOverviewPanel wallet={inv.wallet} />
        </Card>

        <Card>
          <SectionTitle>Attribution Result</SectionTitle>
          {a.likelyVasp ? (
            <div className="flex flex-col items-center gap-4">
              <ConfidenceMeter value={a.confidence} />
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Likely VASP</div>
                <div className="mt-1 text-2xl font-bold text-white">{a.likelyVasp}</div>
                {candidate?.demoSample ? (
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-400">Demo / Sample Addresses</div>
                ) : null}
              </div>
              <div className="w-full space-y-1.5">
                {a.candidates.slice(0, 4).map((c) => (
                  <div key={c.vaspId} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
                    <span className="text-slate-300">{c.name}</span>
                    <span className="font-mono text-slate-400">{Math.round(c.score)}</span>
                  </div>
                ))}
              </div>
              <div className="w-full rounded-lg border border-slate-800 bg-base-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
                <div className="mb-1 font-semibold uppercase tracking-wider text-slate-400">Factor weights applied</div>
                {[
                  ["Known Address Interaction", a.weights.knownAddressInteraction, candidate?.factors.knownAddressInteraction],
                  ["Graph Distance / Proximity", a.weights.graphProximity, candidate?.factors.graphProximity],
                  ["Fund Flow Relationship", a.weights.fundFlow, candidate?.factors.fundFlow],
                  ["Wallet Cluster Similarity", a.weights.clusterSimilarity, candidate?.factors.clusterSimilarity],
                  ["Behaviour Similarity", a.weights.behaviorSimilarity, candidate?.factors.behaviorSimilarity],
                ].map(([label, w, f]) => (
                  <div key={label as string} className="mt-1 flex items-center justify-between">
                    <span>{label as string}</span>
                    <span className="font-mono text-slate-400">
                      {f ?? 0} / {w}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-amber-300">No VASP attribution above confidence threshold</div>
              <div className="mt-2 text-xs text-slate-500">The wallet's activity does not strongly match any known VASP cluster.</div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            right={
              <Link to={`/graph/${inv.address}`} className="text-xs text-accent-cyan hover:underline">
                Open interactive graph →
              </Link>
            }
          >
            Transaction Relationship Graph
          </SectionTitle>
          <GraphExplorer graph={inv.graph} height={480} />
        </Card>

        <Card>
          <SectionTitle>Risk / Investigation Summary</SectionTitle>
          <SummaryPanel summary={inv.summary} />
        </Card>
      </div>

      <Card>
        <SectionTitle>Fund Flow Paths</SectionTitle>
        <FundFlowView paths={inv.fundFlow} />
      </Card>

      <Card>
        <SectionTitle>Evidence</SectionTitle>
        {inv.evidence.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No evidence generated for this wallet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {inv.evidence.map((e) => (
              <EvidenceCard key={e.id} evidence={e} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>
          <span className="flex items-center gap-2">
            <Bot size={15} /> AI Explanation
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-400">
              {inv.explanationSource === "groq" ? "Groq LLM" : "Deterministic template"} · constrained to computed evidence only
            </span>
          </span>
        </SectionTitle>
        <div className="whitespace-pre-line rounded-xl border border-slate-800 bg-base-900/60 p-4 text-sm leading-relaxed text-slate-300">
          {inv.explanation}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          All figures above were computed deterministically from collected on-chain data. Attribution is probabilistic and supports
          investigation; it is not proof of ownership or control.
        </div>
      </Card>

      <Card>
        <SectionTitle
          right={
            <Link to={`/timeline/${inv.address}`} className="text-xs text-accent-cyan hover:underline">
              See full timeline →
            </Link>
          }
        >
          <span className="flex items-center gap-2">
            <StickyNote size={15} /> Investigator Annotations
          </span>
        </SectionTitle>
        <AnnotationPanel address={inv.address} compact />
      </Card>

      <Card>
        <SectionTitle
          right={
            <button onClick={() => setShowAllTx(!showAllTx)} className="text-xs text-accent-cyan hover:underline">
              {showAllTx ? "Show recent" : "Show all"} ({inv.transactions.length})
            </button>
          }
        >
          Transaction Activity
        </SectionTitle>
        <TransactionTable transactions={visibleTx} walletAddress={inv.address} />
      </Card>
    </div>
  );
}