import { env } from "../../config/env";
import { Errors, AppError } from "../../utils/errors";
import { fetchJson, isoFromSeconds, humanAmount, bigintOf, weiToEth } from "./http";
import type { RawTransfer, RawWallet } from "./types";
import { normalizeAddress } from "../../utils/validation";

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
}

interface EtherscanTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  blockNumber: string;
  timeStamp: string;
  contractAddress: string;
}

const BASE = "https://api.etherscan.io/api";

function apiUrl(params: Record<string, string>): string {
  const p = new URLSearchParams({ apikey: env.etherscanKey, ...params });
  return `${BASE}?${p.toString()}`;
}

function resolveResult(body: unknown, address: string): Record<string, unknown> {
  const b = body as { status?: string; message?: string; result?: unknown };
  if (b.result !== undefined && b.result !== null) {
    const r = String(b.status ?? "1");
    if (r !== "0" && r !== "1") throw Errors.rateLimited("Etherscan");
  }
  if (typeof b.result === "string" && /max rate limit|rate limit/i.test(String(b.message ?? ""))) {
    throw Errors.rateLimited("Etherscan");
  }
  if (!b.result && /no transactions/i.test(String(b.message ?? ""))) {
    throw Errors.noTransactions(address);
  }
  if (Array.isArray(b.result)) return b.result as unknown as Record<string, unknown>;
  if (typeof b.result === "object" && b.result !== null) return { result: b.result };
  throw Errors.apiUnavailable("Etherscan");
}

function rowToTransfer(d: Record<string, unknown>, kind: "ETH" | "ERC20"): RawTransfer {
  const h = String(d.hash || d.txhash || "");
  return {
    hash: h,
    from: normalizeAddress(String(d.from)),
    to: normalizeAddress(String(d.to || (d.contractAddress ?? ""))),
    valueWei: String(d.value ?? "0"),
    tokenAddress: d.contractAddress ? normalizeAddress(String(d.contractAddress)) : null,
    symbol: kind === "ETH" ? "ETH" : String(d.tokenSymbol ?? "UNKNOWN"),
    decimals: kind === "ETH" ? 18 : Number(d.tokenDecimal ?? 18),
    blockNumber: Number(d.blockNumber ?? 0),
    timestampIso: isoFromSeconds(String(d.timeStamp ?? "0")),
    kind,
    gasUsed: d.gasUsed ? String(d.gasUsed) : undefined,
    gasPriceWei: d.gasPrice ? String(d.gasPrice) : undefined,
  };
}

function normalizeRow(d: Record<string, unknown>): EtherscanTx {
  return {
    hash: String(d.hash),
    from: normalizeAddress(String(d.from)),
    to: normalizeAddress(String(d.to ?? "")),
    value: String(d.value ?? "0"),
    blockNumber: String(d.blockNumber ?? "0"),
    timeStamp: String(d.timeStamp ?? "0"),
    gasPrice: String(d.gasPrice ?? "0"),
    gasUsed: String(d.gasUsed ?? "0"),
  };
}

export class EtherscanClient {
  private configured: boolean;

  constructor() {
    this.configured = !!env.etherscanKey;
  }

  async fetchWallet(address: string): Promise<RawWallet> {
    if (!this.configured) throw Errors.apiUnavailable("Etherscan (no API key configured)");
    const warnings: string[] = [];

    let balanceWei = "0";
    try {
      const bal = (await fetchJson(apiUrl({ module: "account", action: "balance", address, tag: "latest" }))) as {
        result?: string;
      };
      balanceWei = bal.result ?? "0";
    } catch {
      warnings.push("Etherscan balance fetch failed.");
    }

    const transferMap = new Map<string, RawTransfer>();
    const seen = new Set<string>();

    const ethRows = (await fetchJson(
      apiUrl({ module: "account", action: "txlist", address, startblock: "0", endblock: "99999999", page: "1", offset: "1000", sort: "asc" })
    ).catch(() => [])) as unknown;
    if (Array.isArray(ethRows)) {
      for (const r of ethRows as Record<string, unknown>[]) {
        const row = normalizeRow((r.result as Record<string, unknown> | undefined) ?? r);
        const t = rowToTransfer(row as unknown as Record<string, unknown>, "ETH");
        t.feeWei = (bigintOf(row.gasUsed) * bigintOf(row.gasPrice)).toString();
        if (!seen.has(t.hash)) {
          seen.add(t.hash);
          transferMap.set(t.hash, t);
        }
      }
    }

    const tokenRows = (await fetchJson(
      apiUrl({ module: "account", action: "tokentx", address, startblock: "0", endblock: "99999999", page: "1", offset: "1000", sort: "asc" })
    ).catch(() => [])) as unknown;
    if (Array.isArray(tokenRows)) {
      for (const r of tokenRows as Record<string, unknown>[]) {
        const row = (r.result as Record<string, unknown> | undefined) ?? r;
        const t = rowToTransfer(row, "ERC20");
        if (!seen.has(t.hash)) {
          seen.add(t.hash);
          transferMap.set(t.hash, t);
        }
      }
    }

    if (transferMap.size === 0) throw Errors.noTransactions(address);

    return {
      address,
      balanceWei,
      txHashes: seen,
      transfers: Array.from(transferMap.values()).sort((a, b) => a.blockNumber - b.blockNumber),
      warnings,
      demo: false,
    };
  }
}

export function etherscanBalanceWei(body: unknown): string {
  const b = body as { result?: string };
  return b.result ?? "0";
}