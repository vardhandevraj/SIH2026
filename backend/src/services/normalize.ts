import type { NormalizedTx, Direction, WalletOverview } from "../types";
import type { RawWallet, RawTransfer } from "./blockchain/types";
import { weiHexToEth } from "./blockchain/http";

export function toEthHuman(weiHex: string): string {
  return weiHexToEth(weiHex);
}

export function rawTransferToTx(raw: RawTransfer, walletAddress: string): NormalizedTx {
  const addr = walletAddress.toLowerCase();
  const from = raw.from.toLowerCase();
  const to = raw.to.toLowerCase();
  let direction: Direction = "OUTGOING";
  if (from === to) direction = "SELF";
  else if (from === addr && to !== addr) direction = "OUTGOING";
  else if (to === addr && from !== addr) direction = "INCOMING";

  const value = raw.kind === "ETH" ? Number(toEthHuman(raw.valueWei)) : rawValueHuman(raw);

  const gasUsed = raw.gasUsed ? Number(raw.gasUsed) : undefined;
  const gasPriceGwei = raw.gasPriceWei ? Number(raw.gasPriceWei) / 1e9 : undefined;
  const feeEth = raw.kind === "ETH" && gasUsed && gasPriceGwei ? (gasUsed * gasPriceGwei) / 1e9 : undefined;

  return {
    hash: raw.hash,
    from,
    to,
    value: round4(value),
    token: raw.symbol || "ETH",
    tokenSymbol: raw.symbol || "ETH",
    timestamp: raw.timestampIso,
    direction,
    blockNumber: raw.blockNumber,
    gasUsed,
    gasPriceGwei,
    feeEth: feeEth !== undefined ? round4(feeEth) : undefined,
    kind: raw.kind,
  };
}

function rawValueHuman(raw: RawTransfer): number {
  const d = raw.decimals || 18;
  return Number(BigInt(raw.valueWei || "0")) / Math.pow(10, d);
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function buildWalletOverview(raw: RawWallet, txs: NormalizedTx[]): WalletOverview {
  const times = txs.map((t) => t.timestamp).sort();
  const unique = new Set<string>();
  for (const t of txs) {
    if (t.from !== raw.address.toLowerCase()) unique.add(t.from);
    if (t.to !== raw.address.toLowerCase()) unique.add(t.to);
  }
  return {
    address: raw.address.toLowerCase(),
    network: "Ethereum",
    balance: toEthHuman(raw.balanceWei),
    txCount: txs.length,
    tokenTransferCount: txs.filter((t) => t.kind === "ERC20").length,
    firstSeen: times[0] || null,
    lastActivity: times[times.length - 1] || null,
    uniqueCounterparties: unique.size,
    demo: raw.demo,
  };
}

export function computeVolumes(txs: NormalizedTx[], walletAddress: string): { inbound: number; outbound: number } {
  const addr = walletAddress.toLowerCase();
  let inbound = 0;
  let outbound = 0;
  for (const t of txs) {
    if (t.token !== "ETH") continue;
    if (t.to === addr) inbound += t.value;
    if (t.from === addr) outbound += t.value;
  }
  return { inbound: round4(inbound), outbound: round4(outbound) };
}