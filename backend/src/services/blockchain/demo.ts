import { DEMO_WALLET } from "../../config/env";
import { demoAddress } from "../../db/seed";
import type { RawTransfer, RawWallet } from "./types";

function hexOf(seed: string, length: number): string {
  let h1 = 0x7f4a7c15;
  let h2 = 0x39b71a37;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 2246822507) >>> 0;
    h2 = (h2 + c * (i + 3)) >>> 0;
    h2 = Math.imul(h2, 3266489917) >>> 0;
  }
  let hex = "";
  let x = (h1 ^ h2) >>> 0;
  for (let i = 0; i < Math.ceil(length / 8) + 1; i++) {
    x = (Math.imul(x ^ (x >>> 16), 2246822519) + i * 2654435761) >>> 0;
    hex += x.toString(16).padStart(8, "0");
  }
  return "0x" + hex.slice(0, length);
}

export function demoHash(seed: string): string {
  return hexOf("tx-" + seed, 64);
}

let rngState = 0x9e3779b9 >>> 0;
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(rngState);
function between(min: number, max: number): number {
  return min + rnd() * (max - min);
}
function intBetween(min: number, max: number): number {
  return Math.floor(between(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export const INTERMEDIARIES = {
  interA: demoAddress("demo-intermediary-a"),
  interB: demoAddress("demo-intermediary-b"),
  interC: demoAddress("demo-intermediary-c"),
  interD: demoAddress("demo-intermediary-d"),
  interE: demoAddress("demo-intermediary-e"),
  peerX: demoAddress("demo-peer-x"),
  peerY: demoAddress("demo-peer-y"),
  peerZ: demoAddress("demo-peer-z"),
  income: demoAddress("demo-salary-source"),
  noise1: demoAddress("demo-noise-1"),
  noise2: demoAddress("demo-noise-2"),
  noise3: demoAddress("demo-noise-3"),
};

export const DEMO_TOKEN_ADDRESSES = {
  USDT: demoAddress("token-usdt"),
  WETH: demoAddress("token-weth"),
  UNI: demoAddress("token-uni"),
};

interface Scenario {
  from: string;
  to: string;
  token: "ETH" | "USDT" | "WETH" | "UNI";
  amount: number;
  daysAgo: number;
}

function decimalsFor(token: "ETH" | "USDT" | "WETH" | "UNI"): number {
  return token === "USDT" ? 6 : 18;
}

function symbolFor(token: "ETH" | "USDT" | "WETH" | "UNI"): string {
  return token;
}

function tokenAddr(token: "ETH" | "USDT" | "WETH" | "UNI"): string | null {
  if (token === "ETH") return null;
  return DEMO_TOKEN_ADDRESSES[token];
}

export function demoWallet(address = DEMO_WALLET): RawWallet {
  const wallet = address.toLowerCase();
  const bin1 = demoAddress("binance-demo-1");
  const bin2 = demoAddress("binance-demo-2");
  const bin3 = demoAddress("binance-demo-3");
  const cb1 = demoAddress("coinbase-demo-1");
  const krak1 = demoAddress("kraken-demo-1");
  const uni = demoAddress("uniswap-demo-1");
  const uni2 = demoAddress("uniswap-demo-2");
  const usdt = demoAddress("tether-demo-1");
  const bf1 = demoAddress("bitfinex-demo-1");

  const i = INTERMEDIARIES;

  const scenarios: Scenario[] = [
    { from: i.income, to: wallet, token: "ETH", amount: 8.4, daysAgo: 98 },
    { from: i.income, to: wallet, token: "ETH", amount: 6.2, daysAgo: 70 },
    { from: i.income, to: wallet, token: "ETH", amount: 7.1, daysAgo: 42 },
    { from: i.income, to: wallet, token: "ETH", amount: 5.9, daysAgo: 14 },

    { from: usdt, to: wallet, token: "USDT", amount: 120000, daysAgo: 96 },

    { from: wallet, to: bin1, token: "ETH", amount: 2.4, daysAgo: 93 },
    { from: wallet, to: bin1, token: "USDT", amount: 15000, daysAgo: 91 },
    { from: wallet, to: bin2, token: "USDT", amount: 8000, daysAgo: 67 },
    { from: bin1, to: wallet, token: "ETH", amount: 1.1, daysAgo: 64 },
    { from: wallet, to: bin1, token: "ETH", amount: 3.2, daysAgo: 39 },
    { from: wallet, to: bin2, token: "USDT", amount: 12000, daysAgo: 21 },

    { from: wallet, to: i.interA, token: "ETH", amount: 1.4, daysAgo: 88 },
    { from: i.interA, to: bin1, token: "ETH", amount: 1.4, daysAgo: 88 },
    { from: wallet, to: i.interA, token: "USDT", amount: 4000, daysAgo: 55 },
    { from: i.interA, to: bin1, token: "USDT", amount: 4000, daysAgo: 55 },

    { from: wallet, to: i.interB, token: "ETH", amount: 0.9, daysAgo: 60 },
    { from: i.interB, to: i.interC, token: "ETH", amount: 0.9, daysAgo: 60 },
    { from: i.interC, to: bin1, token: "ETH", amount: 0.9, daysAgo: 60 },
    { from: i.interB, to: bin3, token: "USDT", amount: 2500, daysAgo: 48 },
    { from: wallet, to: i.interB, token: "USDT", amount: 2500, daysAgo: 48 },

    { from: wallet, to: i.interD, token: "ETH", amount: 0.35, daysAgo: 52 },
    { from: i.interD, to: i.interB, token: "ETH", amount: 0.35, daysAgo: 52 },
    { from: i.interB, to: bin1, token: "ETH", amount: 1.2, daysAgo: 30 },

    { from: wallet, to: i.interE, token: "USDT", amount: 3500, daysAgo: 26 },
    { from: i.interE, to: bin1, token: "USDT", amount: 3500, daysAgo: 26 },

    { from: wallet, to: cb1, token: "ETH", amount: 0.8, daysAgo: 78 },
    { from: cb1, to: wallet, token: "ETH", amount: 0.3, daysAgo: 33 },

    { from: wallet, to: uni, token: "ETH", amount: 0.5, daysAgo: 74 },
    { from: uni2, to: wallet, token: "WETH", amount: 0.49, daysAgo: 74 },
    { from: wallet, to: uni, token: "USDT", amount: 5000, daysAgo: 44 },

    { from: usdt, to: wallet, token: "USDT", amount: 9000, daysAgo: 35 },
    { from: wallet, to: bf1, token: "USDT", amount: 1200, daysAgo: 18 },

    { from: wallet, to: i.peerX, token: "USDT", amount: 2200, daysAgo: 80 },
    { from: i.peerX, to: bin2, token: "USDT", amount: 2200, daysAgo: 80 },
    { from: wallet, to: i.peerY, token: "ETH", amount: 0.42, daysAgo: 61 },
    { from: i.peerY, to: bin1, token: "ETH", amount: 0.42, daysAgo: 61 },
    { from: wallet, to: i.peerZ, token: "USDT", amount: 600, daysAgo: 12 },

    { from: i.noise1, to: wallet, token: "ETH", amount: 0.15, daysAgo: 57 },
    { from: wallet, to: i.noise2, token: "ETH", amount: 0.07, daysAgo: 20 },
    { from: i.noise3, to: wallet, token: "USDT", amount: 300, daysAgo: 9 },
  ];

  const peelChain: Scenario[] = [
    { from: wallet, to: i.interA, token: "ETH", amount: 0.11, daysAgo: 3 },
    { from: wallet, to: i.interB, token: "ETH", amount: 0.11, daysAgo: 3 },
    { from: wallet, to: i.interC, token: "ETH", amount: 0.11, daysAgo: 3 },
    { from: wallet, to: i.interD, token: "ETH", amount: 0.11, daysAgo: 3 },
  ];

  const now = Date.now();
  const transfers: RawTransfer[] = [];
  const hashes = new Set<string>();

  let seq = 0;
  const push = (sc: Scenario, customTs?: number) => {
    seq++;
    const tsMs = customTs ?? now - sc.daysAgo * 86400000 - intBetween(0, 46) * 3600000 - intBetween(0, 59) * 60000;
    const hash = demoHash(`${wallet}-${sc.from}-${sc.to}-${sc.token}-${sc.amount}-${seq}`);
    if (hashes.has(hash)) return;
    hashes.add(hash);
    const d = decimalsFor(sc.token);
    const s = symbolFor(sc.token);
    const kind = sc.token === "ETH" ? "ETH" : "ERC20";
    const block = Math.floor(19500000 + ((now - tsMs) / 86400000) * 7200);
    transfers.push({
      hash,
      from: sc.from.toLowerCase(),
      to: sc.to.toLowerCase(),
      valueWei: String(Math.round(sc.amount * Math.pow(10, d))),
      tokenAddress: tokenAddr(sc.token),
      symbol: s,
      decimals: d,
      blockNumber: block,
      timestampIso: new Date(tsMs).toISOString(),
      kind,
      gasUsed: kind === "ETH" ? String(intBetween(21000, 52000)) : String(intBetween(40000, 160000)),
      gasPriceWei: String(intBetween(8, 60) * 1e9),
      feeWei: "0",
    });
  };

  for (const sc of scenarios) push(sc);
  for (const sc of peelChain) push(sc);

  transfers.sort((a, b) => a.timestampIso.localeCompare(b.timestampIso));

  const balanceWei = String(BigInt(Math.round(between(1.2, 4.8) * 1e18)));

  return {
    address: wallet,
    balanceWei,
    txHashes: hashes,
    transfers,
    warnings: ["DEMO MODE: showing synthetically generated sample data, not real on-chain evidence."],
    demo: true,
  };
}