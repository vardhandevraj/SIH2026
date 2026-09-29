import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Minus, ExternalLink } from "lucide-react";
import type { NormalizedTx } from "../api/types";
import { shortAddr, formatDate } from "../utils/format";

const PAGE_SIZE = 50;

export function TransactionTable({ transactions, walletAddress }: { transactions: NormalizedTx[]; walletAddress?: string }) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [transactions],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-base-900/95 backdrop-blur">
            <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="pb-2 pr-3">Hash</th>
              <th className="pb-2 pr-3">Direction</th>
              <th className="pb-2 pr-3">Counterparty</th>
              <th className="pb-2 pr-3">Token</th>
              <th className="pb-2 pr-3 text-right">Amount</th>
              <th className="pb-2 pr-3">Timestamp</th>
              <th className="pb-2 pr-3 text-right">Block</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                  No transactions to display.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const isOut = t.direction === "OUTGOING";
                const isIn = t.direction === "INCOMING";
                const counterparty = isOut ? t.to : t.from;
                const isSelf = !isOut && !isIn;
                return (
                  <tr key={t.hash} className="border-b border-slate-800/50 text-slate-300 transition-colors hover:bg-white/[0.03]">
                    <td className="py-2 pr-3">
                      <a
                        href={`https://etherscan.io/tx/${t.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-accent-cyan hover:underline"
                      >
                        {shortAddr(t.hash, 10, 6)} <ExternalLink size={10} className="opacity-60" />
                      </a>
                    </td>
                    <td className="py-2 pr-3">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] text-rose-300">
                          <ArrowUpRight size={12} /> OUT
                        </span>
                      ) : isIn ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
                          <ArrowDownLeft size={12} /> IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 text-[11px] text-slate-400">
                          <Minus size={12} /> SELF
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {isSelf || !counterparty ? (
                        <span className="text-slate-600">{isSelf ? "self" : "-"}</span>
                      ) : counterparty === walletAddress ? (
                        <span className="text-slate-600">{shortAddr(counterparty)}</span>
                      ) : (
                        <Link to={`/wallet/${counterparty}`} className="hover:underline" title={`Investigate ${counterparty}`}>
                          {shortAddr(counterparty)}
                        </Link>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{t.tokenSymbol}</td>
                    <td
                      className="py-2 pr-3 text-right font-mono text-xs"
                      style={{ color: isOut ? "#fda4af" : isIn ? "#6ee7b7" : "#94a3b8" }}
                    >
                      {t.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-500">{formatDate(t.timestamp)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-slate-500">{t.blockNumber.toLocaleString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {safePage * PAGE_SIZE + 1}-{Math.min(sorted.length, (safePage + 1) * PAGE_SIZE)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded-lg border border-slate-700 px-3 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-slate-400">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="rounded-lg border border-slate-700 px-3 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
