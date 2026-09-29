import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, ExternalLink } from "lucide-react";
import { api } from "../api/client";
import type { Investigation, InvestigationReport } from "../api/types";
import { LoadingState, ErrorState } from "../components/State";
import { ReportView } from "../components/ReportView";
import { shortAddr, formatDate } from "../utils/format";

export function InvestigationDetail() {
  const { id = "" } = useParams();
  const [inv, setInv] = useState<Investigation | null>(null);
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .investigation(id)
      .then((r) => {
        setInv(r.investigation);
        setReports(r.reports);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateReport(id);
      setReports((prev) => [res.report, ...prev.filter((r) => r.id !== res.report.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate report");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState message="Loading investigation..." />;
  if (error && !inv) return <ErrorState message={error} onRetry={load} />;
  if (!inv) return <ErrorState message="Investigation not found." onRetry={load} />;

  const report = reports[0];

  return (
    <div>
      <Link to={`/wallet/${inv.address}`} className="mb-4 flex items-center gap-1 text-xs text-accent-cyan hover:underline">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>

      {error ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-rose-200 hover:underline">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Investigation Report</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-accent-cyan">{shortAddr(inv.address, 10, 8)}</span>
            <span>·</span>
            <span>Analyzed {formatDate(inv.analyzedAt)}</span>
            <span>·</span>
            <span>Likely VASP: <b className="text-white">{inv.attribution.likelyVasp ?? "None"}</b></span>
            {inv.demo ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">DEMO DATA</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!report ? (
            <button
              onClick={generate}
              disabled={generating}
              className="btn-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Generate Report
            </button>
          ) : (
            <a
              href={`https://etherscan.io/address/${inv.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              <ExternalLink size={14} /> Etherscan
            </a>
          )}
        </div>
      </div>

      {report ? (
        <ReportView report={report} />
      ) : (
        <div className="glass rounded-xl p-8 text-center text-sm text-slate-400">
          No report generated yet for this investigation. Click "Generate Report" to build a structured investigation report.
        </div>
      )}
    </div>
  );
}