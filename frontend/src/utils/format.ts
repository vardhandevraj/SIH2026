export function shortAddr(address: string, head = 6, tail = 4): string {
  if (!address) return "-";
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatValue(value: number | undefined | null, token = ""): string {
  if (value === undefined || value === null) return "-";
  const v = Math.abs(value);
  const s = v >= 1_000_000 ? v.toFixed(0) : v >= 1_000 ? v.toFixed(1) : v.toFixed(4);
  return `${s} ${token}`.trim();
}

export function formatEthBalance(balance: string | number | undefined): string {
  if (balance === undefined) return "-";
  const n = typeof balance === "string" ? Number(balance) : balance;
  if (!Number.isFinite(n)) return balance as string;
  return `${n.toFixed(4)} ETH`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}