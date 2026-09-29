import { NavLink } from "react-router-dom";
import { Fingerprint, LayoutDashboard, Network, History, Building2, Settings, Radar, Star, FolderOpen, Upload, GitCompare } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/cases", label: "Cases", icon: FolderOpen },
  { to: "/bulk", label: "Bulk Analysis", icon: Upload },
  { to: "/diff", label: "Diff Runs", icon: GitCompare },
  { to: "/vasps", label: "VASPs", icon: Building2 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-base-900/80">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl btn-gradient glow">
          <Radar size={18} className="text-white" />
        </div>
        <div>
          <div className="text-base font-bold tracking-wide text-white">ChainTrace</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Wallet Attribution</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-accent-indigo/15 text-accent-cyan" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto rounded-lg border border-slate-800 bg-base-800/60 p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
            <Fingerprint size={12} />
            <span>Network</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
            <Network size={14} className="text-accent-cyan" />
            Ethereum
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Mainnet</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}