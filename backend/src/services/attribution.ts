import type { NormalizedTx, VaspEntity, AttributionResult, AttributionWeights, VaspCandidate, TransactionGraph } from "../types";
import { buildAdjacency, bfsDistances, vaspAddressSet, type AggregatedEdge } from "./graph";
import { cosineSimilarity, buildBehaviorVector, vaspBehaviorVector, clusterSimilarity, walletCounterpartySet } from "./behavior";
import { clamp } from "../utils/validation";

export const DEFAULT_WEIGHTS: AttributionWeights = {
  knownAddressInteraction: 30,
  graphProximity: 25,
  fundFlow: 20,
  clusterSimilarity: 15,
  behaviorSimilarity: 10,
};

export function loadWeights(): AttributionWeights {
  const raw = process.env.ATTRIBUTION_WEIGHTS;
  if (!raw) return DEFAULT_WEIGHTS;
  try {
    const parsed = JSON.parse(raw) as Partial<AttributionWeights>;
    const out = { ...DEFAULT_WEIGHTS };
    for (const k of Object.keys(out) as (keyof AttributionWeights)[]) {
      const v = Number(parsed[k]);
      if (Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export type PythonEnrichment = {
  available: boolean;
  medianDistancePerVasp?: Record<string, number>;
  pagerankTop?: string[];
  communitySignal?: Record<string, number>;
};

export interface AttributionInput {
  txs: NormalizedTx[];
  vasps: VaspEntity[];
  graph: TransactionGraph;
  weights: AttributionWeights;
  python?: PythonEnrichment | null;
}

export function computeAttribution(input: AttributionInput): AttributionResult {
  const { txs, vasps, graph, weights } = input;
  const wallet = graph.nodes.find((n) => n.type === "investigated")?.id || txs[0]?.from || "";

  const adj = buildAdjacency(txs);
  const vaspMap = vaspAddressSet(vasps);
  const dist = bfsDistances(adj, wallet, 12);
  const walletCounterparty = walletCounterpartySet(txs, wallet);
  const walletVector = buildBehaviorVector(txs, wallet);
  const pythonDist = input.python?.medianDistancePerVasp || {};

  const candidates: VaspCandidate[] = [];

  for (const vasp of vasps) {
    const vaspAddrs = vasp.knownAddresses.map((a) => a.address.toLowerCase());
    const addressSet = new Set(vaspAddrs);

    const directTxs = txs.filter((t) => {
      const from = t.from.toLowerCase();
      const to = t.to.toLowerCase();
      return (from === wallet && addressSet.has(to)) || (to === wallet && addressSet.has(from));
    });

    const directInteractionCount = directTxs.length;
    const directVolume = directTxs.reduce((acc, t) => acc + Math.abs(t.value), 0);

    let minHops: number | null = null;
    for (const a of vaspAddrs) {
      const d = dist.get(a);
      if (d !== undefined && (minHops === null || d < minHops)) minHops = d;
    }
    const pythonHops = pythonDist[vasp.id];
    if (pythonHops !== undefined && (minHops === null || pythonHops < minHops)) minHops = Math.round(pythonHops);

    const knownFactor01 = clamp(Math.min(1, directInteractionCount / 10) * 0.7 + Math.min(1, directVolume / 8) * 0.3, 0, 1);
    const knownScore = knownFactor01 * weights.knownAddressInteraction;

    const hopFactor = minHops === null ? 0 : minHops <= 1 ? 1 : minHops === 2 ? 0.75 : minHops === 3 ? 0.5 : minHops === 4 ? 0.3 : 0.1;
    const proximityScore = hopFactor * weights.graphProximity;

    const paths = fundFlowPaths(txs, wallet, addressSet, 4);
    const pathFactor = clamp(Math.min(1, paths.length / 3) * 0.7 + Math.min(1, directVolume / 6) * 0.3, 0, 1);
    const fundFlowScore = pathFactor * weights.fundFlow;

    const cluster01 = clusterSimilarity(walletCounterparty, vasp, txs);
    const clusterScore = cluster01 * weights.clusterSimilarity;

    const vaspVector = vaspBehaviorVector(txs, vasp);
    const cos = cosineSimilarity(walletVector, vaspVector);
    const behavior01 = clamp(Math.max(0, (cos - 0.25) / 0.6), 0, 1);
    const behaviorScore = behavior01 * weights.behaviorSimilarity;

    const rawScore =
      knownScore + proximityScore + fundFlowScore + clusterScore + behaviorScore;

    candidates.push({
      vaspId: vasp.id,
      name: vasp.name,
      entityType: vasp.entityType,
      score: Math.round(rawScore),
      rawScore: Math.round(rawScore * 10) / 10,
      factors: {
        knownAddressInteraction: Math.round(knownScore * 10) / 10,
        graphProximity: Math.round(proximityScore * 10) / 10,
        fundFlow: Math.round(fundFlowScore * 10) / 10,
        clusterSimilarity: Math.round(clusterScore * 10) / 10,
        behaviorSimilarity: Math.round(behaviorScore * 10) / 10,
      },
      minHops: minHops === null ? null : Math.round(minHops),
      directInteractionCount,
      demoSample: vasp.knownAddresses.some((a) => a.demoSample),
    });
  }

  candidates.sort((a, b) => b.rawScore - a.rawScore);

  const top = candidates[0];
  const confidence = top && top.rawScore >= 12 ? top.rawScore : 0;
  const likely = top && top.rawScore >= 12 ? top : null;

  const method: string[] = ["deterministic-scoring"];
  if (input.python?.available) method.push("python-networkx-enriched");
  if (txs.some((t) => t.kind === "ERC20")) method.push("erc20-token-transfers");

  return {
    likelyVasp: likely?.name ?? null,
    likelyVaspId: likely?.vaspId ?? null,
    confidence: Math.round(confidence),
    factors: likely?.factors ?? null,
    candidates,
    weights,
    method: method.join("+"),
  };
}

export interface FundPath {
  hops: string[];
  labels: string[];
  totalAmount: number;
  token: string;
  txHashes: string[];
  hopCount: number;
}

export function fundFlowPaths(txs: NormalizedTx[], walletAddress: string, targetAddresses: Set<string>, maxPaths = 3): FundPath[] {
  const wallet = walletAddress.toLowerCase();
  const adj = buildAdjacency(txs);

  const edgeMap = new Map<string, AggregatedEdge | undefined>();
  for (const e of adj.edges) edgeMap.set(`${e.source}|${e.target}`, e);
  for (const e of adj.edges) if (!edgeMap.has(`${e.target}|${e.source}`)) edgeMap.set(`${e.target}|${e.source}`, e);

  interface QueueItem {
    node: string;
    hops: string[];
    hashes: string[];
    amount: number;
    token: string;
    visited: Set<string>;
  }

  const results: FundPath[] = [];
  const queue: QueueItem[] = [{ node: wallet, hops: [wallet], hashes: [], amount: 0, token: "ETH", visited: new Set([wallet]) }];

  while (queue.length > 0 && results.length < maxPaths) {
    const current = queue.shift()!;
    if (targetAddresses.has(current.node) && current.node !== wallet) {
      results.push({
        hops: current.hops,
        labels: current.hops.map((h) => (h === wallet ? "UNKNOWN WALLET" : h)),
        totalAmount: Math.round(current.amount * 10000) / 10000,
        token: current.token,
        txHashes: current.hashes,
        hopCount: current.hops.length - 1,
      });
      continue;
    }
    if (current.hops.length >= 4) continue;
    const seenNeighbors = new Set<string>();
    for (const e of adj.edges) {
      if (e.source !== current.node && e.target !== current.node) continue;
      const next = e.source === current.node ? e.target : e.source;
      if (next === current.node || seenNeighbors.has(next)) continue;
      seenNeighbors.add(next);
      if (current.visited.has(next)) continue;
      const newVisited = new Set(current.visited);
      newVisited.add(next);
      const eff = edgeMap.get(`${current.node}|${next}`) || e;
      const newAmount = current.amount === 0 ? eff.totalAmount : Math.min(current.amount, eff.totalAmount);
      queue.push({
        node: next,
        hops: [...current.hops, next],
        hashes: [...current.hashes, eff.firstHash],
        amount: newAmount,
        token: eff.token,
        visited: newVisited,
      });
    }
  }

  return results;
}