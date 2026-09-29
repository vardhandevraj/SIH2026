import { analyzeWallet } from "./services/pipeline";
import { seedVasps } from "./db/seed";

async function main() {
  await seedVasps();
  const inv = await analyzeWallet({ address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", forceDemo: true });
  console.log("WALLET:", inv.wallet.address, "demo:", inv.demo);
  console.log("TXS:", inv.transactions.length);
  console.log("NODES:", inv.graph.nodes.length, "EDGES:", inv.graph.edges.length, "DEPTH:", inv.graph.depth);
  console.log("LIKELY VASP:", inv.attribution.likelyVasp, "CONFIDENCE:", inv.attribution.confidence);
  console.log("CANDIDATES:", inv.attribution.candidates.map((c) => `${c.name}:${c.score}`).join(", "));
  console.log("EVIDENCE:", inv.evidence.map((e) => `${e.strength} ${e.title}`).join(" | "));
  console.log("FUNDFLOW PATHS:", inv.fundFlow.length);
  console.log("SUSPICIOUS:", inv.summary.suspiciousPatterns.map((s) => s.label).join(", "));
  console.log("EXPLANATION (first 200):", inv.explanation.slice(0, 200));
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});