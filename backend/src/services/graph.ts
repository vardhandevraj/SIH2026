import type { GraphNode, GraphEdge, NormalizedTx, TransactionGraph, VaspEntity } from "../types";
import { round4 } from "./normalize";

export interface AggregatedEdge {
  source: string;
  target: string;
  token: string;
  count: number;
  totalAmount: number;
  firstHash: string;
  firstTs: string;
  lastTs: string;
}

export interface Adjacency {
  edges: AggregatedEdge[];
  bySource: Map<string, AggregatedEdge[]>;
  byTarget: Map<string, AggregatedEdge[]>;
}

export function buildAdjacency(txs: NormalizedTx[]): Adjacency {
  const map = new Map<string, AggregatedEdge>();
  const keyOf = (a: string, b: string, token: string) => `${a}|${b}|${token}`;
  for (const t of txs) {
    const a = t.from.toLowerCase();
    const b = t.to.toLowerCase();
    if (a === b) continue;
    const k = keyOf(a, b, t.token);
    const existing = map.get(k);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += t.value;
      if (t.timestamp > existing.lastTs) existing.lastTs = t.timestamp;
    } else {
      map.set(k, {
        source: a,
        target: b,
        token: t.token,
        count: 1,
        totalAmount: t.value,
        firstHash: t.hash,
        firstTs: t.timestamp,
        lastTs: t.timestamp,
      });
    }
  }
  const edges = Array.from(map.values());
  const bySource = new Map<string, AggregatedEdge[]>();
  const byTarget = new Map<string, AggregatedEdge[]>();
  for (const e of edges) {
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source)!.push(e);
    if (!byTarget.has(e.target)) byTarget.set(e.target, []);
    byTarget.get(e.target)!.push(e);
  }
  return { edges, bySource, byTarget };
}

export function neighbors(adj: Adjacency, address: string): Set<string> {
  const out = new Set<string>();
  for (const e of adj.bySource.get(address) || []) out.add(e.target.toLowerCase());
  for (const e of adj.byTarget.get(address) || []) out.add(e.source.toLowerCase());
  return out;
}

export function degrees(adj: Adjacency, address: string): { in: number; out: number } {
  const outs = adj.bySource.get(address) || [];
  const ins = adj.byTarget.get(address) || [];
  let out = 0;
  for (const e of outs) out += e.count;
  let inn = 0;
  for (const e of ins) inn += e.count;
  return { in: inn, out };
}

export function bfsDistances(adj: Adjacency, start: string, maxDist = 10): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(start, 0);
  const queue: string[] = [start];
  const seen = new Set<string>([start]);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    if (d >= maxDist) continue;
    for (const n of neighbors(adj, cur)) {
      if (!seen.has(n)) {
        seen.add(n);
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

export function buildGraph(txs: NormalizedTx[], walletAddress: string, vasps: VaspEntity[], maxDepth = 2, maxNodes = 80): TransactionGraph {
  const wallet = walletAddress.toLowerCase();
  const adj = buildAdjacency(txs);
  const vaspAddrSet = new Set<string>();
  for (const v of vasps) for (const a of v.knownAddresses) vaspAddrSet.add(a.address.toLowerCase());

  const dist = bfsDistances(adj, wallet, maxDepth + 2);

  const txCountMap = new Map<string, number>();
  const volumeMap = new Map<string, number>();
  const nodeSet = new Set<string>([wallet]);
  const edgesOut: GraphEdge[] = [];

  const nodeInfo = new Map<string, { count: number; volume: number }>();

  for (const t of txs) {
    const a = t.from.toLowerCase();
    const b = t.to.toLowerCase();
    for (const n of [a, b]) {
      const info = nodeInfo.get(n) || { count: 0, volume: 0 };
      info.count += 1;
      info.volume += Math.abs(t.value);
      nodeInfo.set(n, info);
    }
  }

  for (const [addr, info] of nodeInfo.entries()) {
    if (addr === wallet) continue;
    const d = dist.get(addr);
    const isVasp = vaspAddrSet.has(addr);
    if (isVasp) nodeSet.add(addr);
    else if (d !== undefined && d <= maxDepth) nodeSet.add(addr);
  }

  const extraCandidates = Array.from(nodeInfo.entries())
    .filter(([addr]) => !nodeSet.has(addr))
    .sort((x, y) => y[1].volume - x[1].volume || y[1].count - x[1].count);
  let addedExtra = 0;
  for (const [addr] of extraCandidates) {
    if (nodeSet.size >= maxNodes) break;
    nodeSet.add(addr);
    addedExtra++;
  }

  const truncated = extraCandidates.length > addedExtra;

  const seenEdgePairs = new Set<string>();
  for (const e of adj.edges) {
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue;
    const pair = [e.source, e.target].sort().join("|") + "|" + e.token;
    if (seenEdgePairs.has(pair)) continue;
    seenEdgePairs.add(pair);
    edgesOut.push({
      id: `e-${e.source}-${e.target}-${e.token}`,
      source: e.source,
      target: e.target,
      hash: e.firstHash,
      amount: round4(e.totalAmount),
      token: e.token,
      timestamp: e.lastTs,
      direction: e.source === wallet ? "OUTGOING" : e.target === wallet ? "INCOMING" : "SELF",
      count: e.count,
      totalAmount: round4(e.totalAmount),
    });
  }

  let maxVolume = 1;
  for (const info of nodeInfo.values()) if (info.volume > maxVolume) maxVolume = info.volume;

  const nodes: GraphNode[] = [];
  for (const addr of nodeSet) {
    const info = nodeInfo.get(addr) || { count: 0, volume: 0 };
    const vaspEntity = addr === wallet ? null : findVaspForAddress(addr, vasps);
    let type: GraphNode["type"] = "unknown";
    if (addr === wallet) type = "investigated";
    else if (vaspEntity) type = "vasp";
    else {
      const d = dist.get(addr);
      if (d !== undefined && d > 1) type = "intermediary";
      else if (d === 1) type = "counterparty";
      else type = "unknown";
    }
nodes.push({
    id: addr,
    label: addr === wallet ? "UNKNOWN (INVESTIGATED)" : vaspEntity ? vaspEntity.name.toUpperCase() : shortAddr(addr),
    type,
    entity: vaspEntity?.name,
    addressLabel: vaspEntity ? vaspEntity.knownAddresses.find((a) => a.address === addr)?.label : undefined,
    txCount: info.count,
    totalVolume: round4(info.volume),
    relevance: round4(Math.min(1, info.count / 20) * 0.6 + Math.min(1, info.volume / maxVolume) * 0.4),
    demoSampleAddress: !!vaspEntity?.knownAddresses.find((a) => a.address === addr)?.demoSample,
  });
  }

  return {
    nodes,
    edges: edgesOut,
    depth: graphDepth(dist, adj, wallet, vaspAddrSet, maxDepth),
    truncated,
  };
}

function graphDepth(dist: Map<string, number>, adj: Adjacency, wallet: string, vaspAddrSet: Set<string>, maxDepth: number): number {
  let depth = 0;
  const reachableVasp = new Set<string>();
  for (const addr of vaspAddrSet) {
    const d = dist.get(addr);
    if (d !== undefined && d <= maxDepth + 2) reachableVasp.add(addr);
  }
  for (const [addr, d] of dist.entries()) {
    if (d === undefined) continue;
    if (vaspAddrSet.has(addr)) {
      if (d > depth && d <= maxDepth + 2) depth = d;
    } else if (d > depth && d <= maxDepth + 1) {
      depth = d;
    }
  }
  return Math.min(depth, maxDepth + 1);
}

export function findVaspForAddress(address: string, vasps: VaspEntity[]): VaspEntity | null {
  const addr = address.toLowerCase();
  for (const v of vasps) {
    if (v.knownAddresses.some((a) => a.address.toLowerCase() === addr)) return v;
  }
  return null;
}

export function vaspAddressSet(vasps: VaspEntity[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of vasps) for (const a of v.knownAddresses) map.set(a.address.toLowerCase(), v.id);
  return map;
}

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}