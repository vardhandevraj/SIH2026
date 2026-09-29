import { randomUUID } from "crypto";
import { env, DEMO_WALLET } from "../config/env";
import { fetchWalletData } from "./blockchain";
import { rawTransferToTx, buildWalletOverview } from "./normalize";
import { buildGraph, findVaspForAddress } from "./graph";
import { computeAttribution, fundFlowPaths, loadWeights, type PythonEnrichment } from "./attribution";
import { generateEvidence, computeSummary } from "./evidence";
import { explainAttribution } from "./aiExplainer";
import { callPythonAnalysis } from "./pythonClient";
import { listVasps, saveInvestigation } from "../db/store";
import type { FundFlowPath, Investigation, NormalizedTx } from "../types";
import { requireAddress } from "../utils/validation";
import { logger } from "../utils/logger";

export interface AnalyzeOptions {
  address: string;
  forceDemo?: boolean;
  investigator?: string;
}

export async function analyzeWallet(options: AnalyzeOptions): Promise<Investigation> {
  const address = requireAddress(options.address);
  const forceDemo = !!options.forceDemo || !env.alchemyKey && !env.etherscanKey;
  const investigator = options.investigator || "session";

  logger.info("Starting wallet analysis", { address, demo: forceDemo || env.demoMode });

  const rawWallet = await fetchWalletData(address, { forceDemo });
  const txs: NormalizedTx[] = rawWallet.transfers.map((t) => rawTransferToTx(t, address));
  const wallet = buildWalletOverview(rawWallet, txs);
  const vasps = await listVasps();

  const graph = buildGraph(txs, address, vasps, 2, 80);
  const weights = loadWeights();

  const python = await tryPythonEnrichment(address, graph, vasps);

  const attribution = computeAttribution({ txs, vasps, graph, weights, python });

  const candidate = attribution.candidates[0] && attribution.candidates[0].rawScore >= 12 ? attribution.candidates[0] : null;

  const candidateAddresses = new Set<string>();
  if (candidate) {
    const vasp = vasps.find((v) => String(v.id) === String(candidate.vaspId));
    if (vasp) for (const a of vasp.knownAddresses) candidateAddresses.add(a.address.toLowerCase());
  }

  const fundPaths = fundFlowPaths(txs, address, candidateAddresses, 3);
  const fundFlow: FundFlowPath[] = fundPaths.map((p, i) => ({ id: `ff-${i + 1}`, ...p }));

  const summary = computeSummary(txs, graph, address, candidate, fundFlow);

  const evidence = generateEvidence({
    txs,
    graph,
    candidate,
    fundFlow,
    walletAddress: address,
    vasps: vasps.map((v) => ({ name: v.name, id: v.id })),
    warnings: rawWallet.warnings,
  });

  const explanation = await explainAttribution({
    wallet: address,
    network: "Ethereum",
    candidate,
    confidence: attribution.confidence,
    evidence,
    fundFlow,
    graphDepth: graph.depth,
  });

  const investigation: Investigation = {
    id: randomUUID(),
    address,
    network: "Ethereum",
    demo: rawWallet.demo,
    analyzedAt: new Date().toISOString(),
    investigator,
    status: "complete",
    warnings: rawWallet.warnings,
    wallet,
    transactions: txs,
    graph,
    attribution,
    evidence,
    fundFlow,
    summary,
    explanation: explanation.text,
    explanationSource: explanation.source,
    reportId: null,
  };

  await saveInvestigation(investigation);
  logger.info("Analysis complete", { address, likelyVasp: attribution.likelyVasp, confidence: attribution.confidence });
  return investigation;
}

async function tryPythonEnrichment(
  address: string,
  graph: { nodes: { id: string; type: string }[]; edges: { source: string; target: string }[] },
  vasps: { id: string; knownAddresses: { address: string }[] }[]
): Promise<PythonEnrichment | null> {
  if (!env.pythonUrl) return null;
  try {
    const result = await callPythonAnalysis({
      investigated: address,
      nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type })),
      edges: graph.edges.map((e) => ({ source: e.source, target: e.target })),
      vasps: vasps.map((v) => ({ id: v.id, addresses: v.knownAddresses.map((a) => a.address.toLowerCase()) })),
    });
    return result;
  } catch {
    return null;
  }
}

export const demoWalletAddress = DEMO_WALLET;