import type { NormalizedTx, VaspEntity } from "../types";
import { buildAdjacency, neighbors } from "./graph";

export interface FeatureVector {
  inboundRatio: number;
  avgLogAmount: number;
  amountBins: number[];
  uniqueRatio: number;
  weeklyActivity: number;
  nightActivity: number;
}

export function buildBehaviorVector(txs: NormalizedTx[], address: string): FeatureVector {
  const addr = address.toLowerCase();
  const related = txs.filter((t) => t.from.toLowerCase() === addr || t.to.toLowerCase() === addr);
  if (related.length === 0) return zeroVector();

  let inbound = 0;
  let outbound = 0;
  const logAmounts: number[] = [];
  const hourCounts = new Array<number>(24).fill(0);
  const counterparties = new Set<string>();
  const days = new Set<string>();

  for (const t of related) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    const v = Math.abs(t.value);
    if (to === addr) inbound += v;
    if (from === addr) outbound += v;
    logAmounts.push(v > 0 ? Math.log10(v + 1e-9) : 0);
    if (from === addr) counterparties.add(to);
    if (to === addr) counterparties.add(from);
    const h = new Date(t.timestamp).getUTCHours();
    hourCounts[h] += 1;
    days.add(t.timestamp.slice(0, 10));
  }

  const total = Math.max(1, logAmounts.length);
  const binSize = Math.max(1, Math.ceil(logAmounts.length / 8));
  const amountBins: number[] = [];
  for (let i = 0; i < logAmounts.length; i += binSize) {
    const slice = logAmounts.slice(i, i + binSize);
    amountBins.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  while (amountBins.length < 8) amountBins.push(0);

  const nightCount = hourCounts.slice(0, 6).reduce((a, b) => a + b, 0) + hourCounts.slice(21, 24).reduce((a, b) => a + b, 0);

  return {
    inboundRatio: inbound / Math.max(1e-9, inbound + outbound),
    avgLogAmount: logAmounts.reduce((a, b) => a + b, 0) / total,
    amountBins,
    uniqueRatio: Math.min(1, counterparties.size / total),
    weeklyActivity: days.size > 0 ? (7 * related.length) / days.size : 0,
    nightActivity: nightCount / total,
  };
}

function zeroVector(): FeatureVector {
  return {
    inboundRatio: 0,
    avgLogAmount: 0,
    amountBins: new Array<number>(8).fill(0),
    uniqueRatio: 0,
    weeklyActivity: 0,
    nightActivity: 0,
  };
}

export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  const va = flatten(a);
  const vb = flatten(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    na += va[i] * va[i];
    nb += vb[i] * vb[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function flatten(v: FeatureVector): number[] {
  return [v.inboundRatio, v.avgLogAmount, ...v.amountBins, v.uniqueRatio, Math.min(v.weeklyActivity, 30) / 30, v.nightActivity];
}

export function vaspBehaviorVector(txs: NormalizedTx[], vasp: VaspEntity): FeatureVector {
  const vaspAddrs = new Set(vasp.knownAddresses.map((a) => a.address.toLowerCase()));
  const related = txs.filter((t) => vaspAddrs.has(t.from.toLowerCase()) || vaspAddrs.has(t.to.toLowerCase()));
  if (related.length === 0) return zeroVector();
  const first = vaspAddrs.values().next().value as string;
  return buildBehaviorVector(related, first);
}

export function clusterSimilarity(walletCounterparties: Set<string>, vasp: VaspEntity, txs: NormalizedTx[]): number {
  const vaspAddrs = new Set(vasp.knownAddresses.map((a) => a.address.toLowerCase()));
  const adj = buildAdjacency(txs);
  const vaspNeighbors = new Set<string>();
  for (const v of vaspAddrs) for (const n of neighbors(adj, v)) vaspNeighbors.add(n);

  let intersection = 0;
  for (const w of walletCounterparties) if (vaspNeighbors.has(w)) intersection++;
  if (intersection === 0) return 0;

  const union = new Set<string>([...walletCounterparties, ...vaspNeighbors]).size;
  const jaccard = intersection / Math.max(1, union);
  return Math.min(1, 0.5 + jaccard * 2);
}

export function walletCounterpartySet(txs: NormalizedTx[], walletAddress: string): Set<string> {
  const addr = walletAddress.toLowerCase();
  const set = new Set<string>();
  for (const t of txs) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    if (from === addr) set.add(to);
    if (to === addr) set.add(from);
  }
  return set;
}