import type {
  EvidenceItem,
  EvidenceStrength,
  FundFlowPath,
  InvestigationSummary,
  NormalizedTx,
  SuspiciousPattern,
  TransactionGraph,
  VaspCandidate,
} from "../types";
import { shortAddr } from "./graph";

export interface EvidenceInput {
  txs: NormalizedTx[];
  graph: TransactionGraph;
  candidate: VaspCandidate | null;
  fundFlow: FundFlowPath[];
  walletAddress: string;
  vasps: { name: string; id: string }[];
  warnings: string[];
}

function strengthFor(value: number, high: number, medium: number): EvidenceStrength {
  if (value >= high) return "HIGH";
  if (value >= medium) return "MEDIUM";
  return "LOW";
}

export function generateEvidence(input: EvidenceInput): EvidenceItem[] {
  const { txs, graph, candidate, fundFlow, walletAddress, vasps } = input;
  const evidence: EvidenceItem[] = [];
  let seq = 0;
  const nextId = (type: string) => `ev-${type}-${++seq}`;

  const candidateVasp = candidate ? vasps.find((v) => v.id === candidate.vaspId) : null;

  if (candidate && candidate.directInteractionCount > 0) {
    const directTxs = txs.filter((t) => {
      const isVaspSide =
        graph.nodes.find((n) => n.id === t.from.toLowerCase())?.type === "vasp" ||
        graph.nodes.find((n) => n.id === t.to.toLowerCase())?.type === "vasp";
      return isVaspSide;
    });
    const strength = strengthFor(candidate.directInteractionCount, 5, 2);
    evidence.push({
      id: nextId("vasp-interaction"),
      type: "vasp-interaction",
      title: "Direct interaction with known VASP-associated addresses",
      description: `The wallet transacted directly with ${candidate.directInteractionCount} transaction(s) touching known clusters of ${candidate.name}. Strongest form of attribution signal.`,
      strength,
      source: "deterministic-analysis: on-chain transactions",
      relatedTransactions: uniqueHashes(directTxs).slice(0, 10),
    });
  }

  if (candidate && candidate.minHops !== null) {
    const strength = candidate.minHops <= 2 ? "HIGH" : candidate.minHops <= 4 ? "MEDIUM" : "LOW";
    evidence.push({
      id: nextId("graph-proximity"),
      type: "graph-proximity",
      title: `${candidate.minHops}-hop graph proximity to ${candidate.name}`,
      description:
        candidate.minHops <= 1
          ? `At least one known ${candidate.name} address is a direct transaction counterparty (1 hop).`
          : `The closest known ${candidate.name} address is ${candidate.minHops} transaction hops away from the investigated wallet. Shorter distance increases attribution likelihood.`,
      strength,
      source: "deterministic-analysis: transaction graph BFS distance",
      relatedTransactions: [],
    });
  }

  if (fundFlow.length > 0) {
    const direct = fundFlow.filter((p) => p.hopCount === 1);
    const strength = direct.length > 0 ? "HIGH" : "MEDIUM";
    evidence.push({
      id: nextId("fund-flow"),
      type: "fund-flow",
      title: "Multiple fund-flow paths connect the wallet to the candidate",
      description: `Detected ${fundFlow.length} distinct fund-flow path(s) reaching the candidate cluster (max ${fundFlow[0].hopCount} hop${fundFlow[0].hopCount > 1 ? "s" : ""}), aggregating identifiable transfer chains.`,
      strength,
      source: "deterministic-analysis: directed fund-flow path search",
      relatedTransactions: uniqueHashesFromPaths(fundFlow).slice(0, 10),
    });
  }

  if (candidate && candidate.factors.clusterSimilarity > 0) {
    const s = candidate.factors.clusterSimilarity;
    const strength = strengthFor(s, 8, 4);
    evidence.push({
      id: nextId("cluster"),
      type: "cluster-similarity",
      title: "Wallet belongs to a related address cluster",
      description: `The wallet shares counterparties with addresses in the ${candidate.name} cluster (cluster similarity score ${candidate.factors.clusterSimilarity.toFixed(1)}). Shared neighbours are commonly used by deposit/withdrawal patterns.`,
      strength,
      source: "deterministic-analysis: neighbourhood overlap (Jaccard on shared counterparties)",
      relatedTransactions: [],
    });
  }

  if (candidate && candidate.factors.behaviorSimilarity > 0) {
    const s = candidate.factors.behaviorSimilarity;
    const strength = strengthFor(s, 6, 3);
    evidence.push({
      id: nextId("behavior"),
      type: "behavior-similarity",
      title: "Transaction behaviour similarity",
      description: `Spending amounts, token mixes and activity timing show behavioural similarity to the candidate cluster (behaviour score ${candidate.factors.behaviorSimilarity.toFixed(1)}).`,
      strength,
      source: "deterministic-analysis: feature-vector cosine similarity",
      relatedTransactions: [],
    });
  }

  for (const v of vasps) {
    if (candidate && String(v.id) === String(candidate.vaspId)) continue;
    const interactions = txs.filter((t) => {
      const nodeFrom = graph.nodes.find((n) => n.id === t.from.toLowerCase());
      const nodeTo = graph.nodes.find((n) => n.id === t.to.toLowerCase());
      return (nodeFrom?.entity === v.name && t.from.toLowerCase() !== walletAddress.toLowerCase()) || (nodeTo?.entity === v.name && t.to.toLowerCase() !== walletAddress.toLowerCase()) || (nodeFrom?.entity === v.name && nodeTo?.entity === v.name);
    });
    if (interactions.length > 0) {
      evidence.push({
        id: nextId("other-vasp"),
        type: "other-vasp-interaction",
        title: `Context: interaction with ${v.name}`,
        description: `The wallet's activity also touches ${v.name} (${interactions.length} transaction(s)). Multi-VASP interaction is normal for market participants and lowers the certainty of any single attribution.`,
        strength: "LOW",
        source: "deterministic-analysis: on-chain transactions",
        relatedTransactions: uniqueHashes(interactions).slice(0, 5),
      });
    }
  }

  const firstSeen = txs[0]?.timestamp;
  if (firstSeen) {
    const ageDays = Math.max(1, Math.round((Date.now() - new Date(firstSeen).getTime()) / 86400000));
    evidence.push({
      id: nextId("wallet-age"),
      type: "wallet-history",
      title: `On-chain history spans ${ageDays} day${ageDays > 1 ? "s" : ""}`,
      description: `First observed transaction on ${new Date(firstSeen).toISOString().slice(0, 10)}. Longer, consistent history increases confidence in behavioural attribution.`,
      strength: ageDays > 60 ? "MEDIUM" : "LOW",
      source: "deterministic-analysis: first-seen timestamp",
      relatedTransactions: [txs[0].hash],
    });
  }

  if (graph.truncated) {
    evidence.push({
      id: nextId("truncation"),
      type: "data-limitation",
      title: "Graph truncated for performance",
      description:
        "The transaction graph was truncated to keep the analysis responsive. Some distant relationships may be underrepresented, which can reduce attribution confidence.",
      strength: "LOW",
      source: "pipeline-limits",
      relatedTransactions: [],
    });
  }

  for (const w of input.warnings) {
    evidence.push({
      id: nextId("warning"),
      type: "data-warning",
      title: "Data warning",
      description: w,
      strength: "LOW",
      source: "data-source",
      relatedTransactions: [],
    });
  }

  return evidence;
}

function uniqueHashes(txs: NormalizedTx[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of txs) {
    if (!seen.has(t.hash)) {
      seen.add(t.hash);
      out.push(t.hash);
    }
  }
  return out;
}

function uniqueHashesFromPaths(paths: FundFlowPath[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths)
    for (const h of p.txHashes) {
      if (!seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
  return out;
}

export function computeSummary(txs: NormalizedTx[], graph: TransactionGraph, walletAddress: string, candidate: VaspCandidate | null, paths: FundFlowPath[]): InvestigationSummary {
  const wallet = walletAddress.toLowerCase();
  let total = 0;
  let inbound = 0;
  let outbound = 0;
  const counterparties = new Set<string>();
  const now = Date.now();

  const peelGroups = new Map<string, NormalizedTx[]>();
  for (const t of txs) {
    if (t.from.toLowerCase() !== wallet) continue;
    const day = t.timestamp.slice(0, 10);
    const key = `${t.token}|${day}`;
    if (!peelGroups.has(key)) peelGroups.set(key, []);
    peelGroups.get(key)!.push(t);
  }

  const suspicious: SuspiciousPattern[] = [];

  for (const [, group] of peelGroups) {
    if (group.length >= 4) {
      const amounts = group.map((t) => Math.abs(t.value)).sort((a, b) => a - b);
      const spread = amounts[amounts.length - 1] / Math.max(1e-9, amounts[0]);
      if (spread < 2.5) {
        suspicious.push({
          id: "susp-peel",
          label: "Possible peel-chain style splitting",
          detail: `${group.length} outgoing ${group[0].token} transfers of similar size on ${group[0].timestamp.slice(0, 10)} to distinct addresses.`,
          severity: "MEDIUM",
        });
      }
    }
  }

  const timeSteps = [...new Set(txs.map((t) => t.timestamp.slice(0, 10)))].sort();
  const passThroughDays: string[] = [];
  for (let i = 0; i < timeSteps.length; i++) {
    const day = timeSteps[i];
    const dayOut = txs
      .filter((t) => t.timestamp.slice(0, 10) === day && t.from.toLowerCase() === wallet)
      .reduce((acc, t) => acc + Math.abs(t.value), 0);
    if (dayOut > 0 && i > 0) {
      const prevDay = timeSteps[i - 1];
      const prevIn = txs
        .filter((t) => t.timestamp.slice(0, 10) === prevDay && t.to.toLowerCase() === wallet)
        .reduce((acc, t) => acc + Math.abs(t.value), 0);
      if (prevIn > 0 && Math.abs(dayOut - prevIn) / Math.max(1e-9, prevIn) < 0.35) {
        passThroughDays.push(prevDay);
      }
    }
  }

  // One finding per occurrence, but never flood the summary panel.
  for (const prevDay of passThroughDays.slice(0, 3)) {
    suspicious.push({
      id: `susp-pass-through-${prevDay}`,
      label: "Rapid pass-through pattern",
      detail: `Funds received on ${prevDay} were moved out the next day at a similar scale, consistent with a non-custodial pass-through wallet.${
        passThroughDays.length > 3 ? ` (${passThroughDays.length} such days detected in total)` : ""
      }`,
      severity: "MEDIUM",
    });
  }

  for (const t of txs) {
    if (t.token === "ETH") {
      total += Math.abs(t.value);
      if (t.from === wallet) outbound += Math.abs(t.value);
      if (t.to === wallet) inbound += Math.abs(t.value);
    }
    if (t.from !== wallet) counterparties.add(t.from);
    if (t.to !== wallet) counterparties.add(t.to);
  }

  if (counterparties.size >= 12) {
    suspicious.push({
      id: "susp-fanout",
      label: "High counterparty fan-out",
      detail: `The wallet transacted with ${counterparties.size} distinct addresses, spreading value across many peers.`,
      severity: "LOW",
    });
  }

  const directVaspEdges = graph.edges.filter((e) => {
    const src = graph.nodes.find((n) => n.id === e.source);
    const dst = graph.nodes.find((n) => n.id === e.target);
    return src?.type === "vasp" || dst?.type === "vasp";
  });

  return {
    totalVolumeEth: Math.round(total * 100) / 100,
    connectedEntities: counterparties.size,
    graphDepth: graph.depth,
    knownVaspInteractions: directVaspEdges.length,
    suspiciousPatterns: suspicious.sort((a, b) => (a.severity === "HIGH" ? -1 : b.severity === "HIGH" ? 1 : a.severity === "MEDIUM" ? -1 : b.severity === "MEDIUM" ? 1 : 0)),
    inboundVolume: Math.round(inbound * 100) / 100,
    outboundVolume: Math.round(outbound * 100) / 100,
  };
}

export { shortAddr };