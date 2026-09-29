import { randomUUID } from "crypto";
import type { Investigation, InvestigationReport, ReportSection } from "../types";
import { shortAddr } from "./graph";

const DISCLAIMER =
  "Attribution is probabilistic and intended to support investigation. It should not be treated as definitive proof of ownership or control.";

export function buildReport(investigation: Investigation): InvestigationReport {
  const sections: ReportSection[] = [];
  const a = investigation.attribution;

  sections.push({
    key: "wallet",
    title: "1. Wallet Information",
    lines: [
      `Address: ${investigation.address}`,
      `Network: ${investigation.network}`,
      `Balance (ETH): ${investigation.wallet.balance}`,
      `Transaction count: ${investigation.wallet.txCount}`,
      `ERC-20 transfer count: ${investigation.wallet.tokenTransferCount}`,
      `First seen: ${investigation.wallet.firstSeen ?? "n/a"}`,
      `Last activity: ${investigation.wallet.lastActivity ?? "n/a"}`,
      `Unique counterparties: ${investigation.wallet.uniqueCounterparties}`,
      `Data source: ${investigation.demo ? "DEMO (synthetically generated sample data - NOT real on-chain evidence)" : "Ethereum mainnet blockchain APIs"}`,
    ],
  });

  sections.push({
    key: "transactions",
    title: "2. Transaction Summary",
    lines: [
      `Total transactions analysed: ${investigation.transactions.length}`,
      `ETH volume (total abs): ${investigation.summary.totalVolumeEth}`,
      `Inbound volume (ETH): ${investigation.summary.inboundVolume}`,
      `Outbound volume (ETH): ${investigation.summary.outboundVolume}`,
      `Connected entities: ${investigation.summary.connectedEntities}`,
      `Graph depth: ${investigation.summary.graphDepth}`,
      `Known VASP interactions: ${investigation.summary.knownVaspInteractions}`,
    ],
  });

  if (a.likelyVasp) {
    sections.push({
      key: "attribution",
      title: "3. VASP Attribution",
      lines: [
        `Likely VASP: ${a.likelyVasp}`,
        `Attribution confidence: ${a.confidence}/100`,
        `Method: ${a.method}`,
        ...a.candidates.slice(0, 3).map((c) => `Candidate: ${c.name} - score ${c.score} (min hops: ${c.minHops ?? "n/a"}, direct interactions: ${c.directInteractionCount})`),
      ],
    });
    sections.push({
      key: "factors",
      title: "4. Attribution Factors",
      lines: a.candidates[0]
        ? [
            `Known address interaction (${a.weights.knownAddressInteraction}% weight): ${a.candidates[0].factors.knownAddressInteraction}`,
            `Graph distance / proximity (${a.weights.graphProximity}% weight): ${a.candidates[0].factors.graphProximity}`,
            `Fund flow relationship (${a.weights.fundFlow}% weight): ${a.candidates[0].factors.fundFlow}`,
            `Wallet cluster similarity (${a.weights.clusterSimilarity}% weight): ${a.candidates[0].factors.clusterSimilarity}`,
            `Behaviour similarity (${a.weights.behaviorSimilarity}% weight): ${a.candidates[0].factors.behaviorSimilarity}`,
          ]
        : ["No dominant attribution factors."],
    });
  } else {
    sections.push({
      key: "attribution",
      title: "3. VASP Attribution",
      lines: ["No VASP attribution above the confidence threshold was determined.", "The wallet's activity does not produce a sufficiently strong single-candidate signal."],
    });
  }

  sections.push({
    key: "graph",
    title: "5. Graph Relationships",
    lines: [
      `Nodes: ${investigation.graph.nodes.length}`,
      `Edges: ${investigation.graph.edges.length}`,
      `Graph depth: ${investigation.graph.depth}`,
      `Truncated: ${investigation.graph.truncated ? "yes" : "no"}`,
      ...investigation.graph.nodes
        .filter((n) => n.type === "vasp")
        .slice(0, 5)
        .map((n) => `VASP node connected: ${n.entity} (${shortAddr(n.id)}, demo sample: ${n.demoSampleAddress ? "yes" : "no"})`),
    ],
  });

  sections.push({
    key: "fundflow",
    title: "6. Fund-Flow Paths",
    lines:
      investigation.fundFlow.length === 0
        ? ["No fund-flow paths identified."]
        : investigation.fundFlow.map((p, i) => `${i + 1}. ${p.labels.join(" -> ")} (${p.token} ${p.totalAmount}, ${p.hopCount} hop${p.hopCount > 1 ? "s" : ""})`),
  });

  sections.push({
    key: "evidence",
    title: "7. Evidence",
    lines:
      investigation.evidence.length === 0
        ? ["No evidence generated."]
        : investigation.evidence.map((e) => `[${e.strength}] ${e.title}: ${e.description}`),
  });

  sections.push({
    key: "risk",
    title: "8. Risk Indicators",
    lines:
      investigation.summary.suspiciousPatterns.length === 0
        ? ["No suspicious patterns flagged."]
        : investigation.summary.suspiciousPatterns.map((p) => `[${p.severity}] ${p.label}: ${p.detail}`),
  });

  sections.push({
    key: "methodology",
    title: "9. Methodology",
    lines: [
      "1. Address validation (Ethereum EIP-55 / regex).",
      "2. On-chain data collection via Alchemy / Etherscan APIs (or deterministic demo data in DEMO_MODE).",
      "3. Transaction normalisation into a common internal format.",
      "4. Transaction relationship graph construction (BFS up to configured depth).",
      "5. Comparison of interacting addresses against the VASP known-address database.",
      "6. Deterministic attribution scoring across five weighted factors.",
      "7. Evidence assembly from computed structures only (no fabricated data).",
      "8. Optional LLM summarisation constrained to supplied structured evidence.",
    ],
  });

  sections.push({
    key: "limitations",
    title: "10. Limitations",
    lines: [
      "VASP known-address databases are incomplete and may contain demo/sample entries that are not verified real-world labels.",
      "Graph truncation and API history limits can miss distant relationships.",
      "Shared control, privacy tooling (mixers/layer-2) and contract interactions can produce false attribution signals.",
      "Attribution is probabilistic and intended to support investigation. It should not be treated as definitive proof of ownership or control.",
    ],
  });

  sections.push({
    key: "meta",
    title: "11. Report Metadata",
    lines: [
      `Investigation ID: ${investigation.id}`,
      `Report generated: ${new Date().toISOString()}`,
      `Analysed at: ${investigation.analyzedAt}`,
      `Investigator / session: ${investigation.investigator}`,
      `Status: ${investigation.status}`,
    ],
  });

  return {
    id: randomUUID(),
    investigationId: investigation.id,
    address: investigation.address,
    title: `ChainTrace Investigation Report - ${shortAddr(investigation.address)}`,
    createdAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    sections,
  };
}