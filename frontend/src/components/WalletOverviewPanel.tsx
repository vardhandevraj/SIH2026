import { ArrowDownLeft, ArrowUpRight, Calendar, Clock, Database, Users } from "lucide-react";
import type { WalletOverview } from "../api/types";
import { StatCard } from "./StatCard";
import { formatDate, formatEthBalance } from "../utils/format";

export function WalletOverviewPanel({ wallet }: { wallet: WalletOverview }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-sm text-accent-cyan">{wallet.address}</div>
          <div className="text-xs text-slate-500">
            {wallet.network} {wallet.demo ? "· DEMO DATA" : "· Live data"}
          </div>
        </div>
        <span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-400">Active</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={<Database size={13} />} label="Balance" value={formatEthBalance(wallet.balance)} />
        <StatCard label="Transactions" value={wallet.txCount} sub={`${wallet.tokenTransferCount} token transfers`} />
        <StatCard icon={<Users size={13} />} label="Unique counterparties" value={wallet.uniqueCounterparties} />
        <StatCard icon={<Calendar size={13} />} label="First seen" value={wallet.firstSeen ? formatDate(wallet.firstSeen).split(",")[0] : "-"} />
        <StatCard icon={<Clock size={13} />} label="Last activity" value={formatDate(wallet.lastActivity)} />
      </div>
    </div>
  );
}

export function DirectionLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-400">
      <span className="flex items-center gap-1">
        <ArrowUpRight size={13} className="text-rose-300" /> Outgoing
      </span>
      <span className="flex items-center gap-1">
        <ArrowDownLeft size={13} className="text-emerald-300" /> Incoming
      </span>
    </div>
  );
}