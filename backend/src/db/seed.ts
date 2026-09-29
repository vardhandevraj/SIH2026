import { logger } from "../utils/logger";
import { createVasp, listVasps } from "./store";

function a(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = (h1 ^ seed.charCodeAt(i)) >>> 0;
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + seed.charCodeAt(i) * (i + 7)) >>> 0;
    h2 = Math.imul(h2, 2246822519) >>> 0;
  }
  let hex = "";
  let x = (h1 ^ h2) >>> 0;
  for (let i = 0; i < 10; i++) {
    x = (Math.imul(x ^ (x >>> 15), 2246822519) + i * 0x9e3779b9) >>> 0;
    hex += x.toString(16).padStart(8, "0");
  }
  return "0x" + hex.slice(0, 40);
}

export const demoAddress = a;

export const DEMO_VASPS: {
  name: string;
  entityType: string;
  tags: string[];
  count: number;
  seedPrefix: string;
}[] = [
  { name: "Binance (Demo)", entityType: "Exchange - CEX", tags: ["centralized-exchange", "demo"], count: 4, seedPrefix: "binance" },
  { name: "Coinbase (Demo)", entityType: "Exchange - CEX", tags: ["centralized-exchange", "demo"], count: 3, seedPrefix: "coinbase" },
  { name: "Kraken (Demo)", entityType: "Exchange - CEX", tags: ["centralized-exchange", "demo"], count: 3, seedPrefix: "kraken" },
  { name: "Uniswap Router (Demo)", entityType: "DEX", tags: ["defi", "swap", "demo"], count: 2, seedPrefix: "uniswap" },
  { name: "Tether Treasury (Demo)", entityType: "Token Issuer", tags: ["stablecoin", "issuer", "demo"], count: 2, seedPrefix: "tether" },
  { name: "Bitfinex (Demo)", entityType: "Exchange - CEX", tags: ["centralized-exchange", "demo"], count: 2, seedPrefix: "bitfinex" },
];

export async function seedVasps(): Promise<number> {
  const existing = await listVasps();
  if (existing.length > 0) return 0;
  let created = 0;
  for (const v of DEMO_VASPS) {
    const knownAddresses = Array.from({ length: v.count }, (_, i) => ({
      address: a(`${v.seedPrefix}-demo-${i + 1}`),
      label: `DEMO / SAMPLE ADDRESS ${i + 1}`,
      demoSample: true,
    }));
    await createVasp({
      name: v.name,
      entityType: v.entityType,
      blockchain: "ethereum",
      knownAddresses,
      tags: [...v.tags, "DEMO / SAMPLE ADDRESS"],
      source: "demo-seed (not verified real-world labels)",
      confidence: v.seedPrefix === "binance" ? 85 : 75,
    });
    created++;
  }
  logger.info("Seeded demo VASP entities", { created });
  return created;
}
