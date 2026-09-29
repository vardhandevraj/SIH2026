import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Play, Loader2, FileText, Download, AlertTriangle } from "lucide-react";
import { api } from "../api/client";
import type { BulkItemResult } from "../api/types";
import { Card } from "../components/Card";
import { shortAddr } from "../utils/format";

const MAX_BULK = 25;

/** Accepts raw addresses, CSV columns, semicolons or whitespace - one address per line works too. */
function parseAddresses(raw: string): string[] {
  const found = raw.match(/0x[a-fA-F0-9]{40}/g) || [];
  return Array.from(new Set(found.map((a) => a.toLowerCase())));
}

export function BulkPage() {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<BulkItemResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addresses = useMemo(() => parseAddresses(raw), [raw]);
  const tooMany = addresses.length > MAX_BULK;

  const run = async () => {
    if (!addresses.length) return;
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const r = await api.bulkAnalyze({ addresses, forceDemo: true });
      setResults(r.result.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
  };

  const exportCsv = () => {
    if (!results) return;
    const header = "address,status,likelyVasp,confidence,txCount,investigationId,error";
    const body = results
      .map((r) =>
        [r.address, r.ok ? "ok" : "failed", r.likelyVasp || "", r.confidence, r.txCount, r.investigationId || "", r.error || ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const succeeded = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Upload size={20} className="text-accent-cyan" /> Bulk Wallet Analysis
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Paste addresses or drop a CSV. Up to {MAX_BULK} per batch; results are exportable.
          </p>
        </div>
        {results ? (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-accent-indigo/40 hover:text-accent-cyan"
          >
            <Download size={14} /> Export CSV
          </button>
        ) : null}
      </div>

      <Card className="mb-5">
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder={"0x742d35Cc6634C0532925a3b844Bc454e4438f44e\n0x1a2b3c...,Suspect A,120000\nPaste a whole CSV column and we will pick out the addresses automatically."}
          className="w-full resize-y rounded-lg border border-slate-700 bg-base-800 px-3 py-2 font-mono text-xs outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-accent-indigo"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <FileText size={12} /> Load CSV file
          </button>
          <span className={`text-xs ${tooMany ? "text-amber-400" : "text-slate-500"}`}>
            {addresses.length} valid address{addresses.length === 1 ? "" : "es"} detected
            {tooMany ? ` — only the first ${MAX_BULK} will be sent` : ""}
          </span>
          <button
            onClick={run}
            disabled={running || !addresses.length || tooMany}
            className="btn-gradient ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? "Analysing..." : "Run bulk analysis"}
          </button>
        </div>
      </Card>

      {error ? <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      {results ? (
        <Card className="overflow-x-auto">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="font-semibold text-white">Results</span>
            <span className="text-xs text-emerald-400">{succeeded} succeeded</span>
            {results.length - succeeded > 0 ? <span className="text-xs text-rose-400">{results.length - succeeded} failed</span> : null}
          </div>
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-medium">Address</th>
                <th className="pb-2 font-medium">Attribution</th>
                <th className="pb-2 font-medium">Confidence</th>
                <th className="pb-2 font-medium">Tx</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.address} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-2">
                    <Link to={`/wallet/${r.address}`} className="font-mono text-accent-cyan hover:underline">
                      {shortAddr(r.address, 10, 6)}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-300">{r.likelyVasp || "-"}</td>
                  <td className="py-2 font-mono text-slate-300">{r.confidence}</td>
                  <td className="py-2 font-mono text-slate-400">{r.txCount}</td>
                  <td className="py-2">
                    {r.ok ? (
                      <span className="text-emerald-400">ok</span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400" title={r.error}>
                        <AlertTriangle size={11} /> failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
