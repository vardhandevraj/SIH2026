import { env } from "../../config/env";
import { Errors } from "../../utils/errors";
import { fetchJson, humanAmount, bigintOf } from "./http";
import type { RawTransfer, RawWallet } from "./types";
import { normalizeAddress } from "../../utils/validation";

interface AlchemyTransfer {
  blockNum?: string;
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  asset?: string;
  category?: string;
  rawContract?: { value?: string; address?: string; decimal?: string };
  metadata?: { blockTimestamp?: string };
  gasUsed?: string;
  gasPrice?: string;
}

interface AssetChanges {
  transfers: AlchemyTransfer[];
  pageKey?: string;
}

async function post(path: string, payload: unknown): Promise<unknown> {
  const url = `https://eth-mainnet.g.alchemy.com/v2/${env.alchemyKey}${path}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export class AlchemyClient {
  private configured: boolean;

  constructor() {
    this.configured = !!env.alchemyKey;
  }

  async fetchWallet(address: string): Promise<RawWallet> {
    if (!this.configured) throw Errors.apiUnavailable("Alchemy (no API key configured)");
    const addr = normalizeAddress(address);
    const warnings: string[] = [];

    let balanceWei = "0";
    try {
      const bal = (await post("", {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [addr, "latest"],
      })) as { result?: string };
      balanceWei = bal.result ?? "0";
    } catch {
      warnings.push("Alchemy balance fetch failed.");
    }

    const transferMap = new Map<string, RawTransfer>();
    const seen = new Set<string>();

    for (const fromTo of [
      { fromAddress: addr, toAddress: "" },
      { fromAddress: "", toAddress: addr },
    ] as const) {
      let pageKey: string | undefined;
      for (let page = 0; page < 5; page++) {
        const res = (await post("", {
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              fromAddress: fromTo.fromAddress || undefined,
              toAddress: fromTo.toAddress || undefined,
              category: ["external", "erc20"],
              maxCount: "0x3e8",
              order: "ASC",
              withMetadata: true,
              excludeZeroValue: false,
              pageKey,
            },
          ],
        })) as { result?: AssetChanges };
        const changes = res.result as AssetChanges | undefined;
        if (!changes || !Array.isArray(changes.transfers)) {
          if (page === 0) throw Errors.apiUnavailable("Alchemy");
          break;
        }
        for (const t of changes.transfers) {
          const hash = t.hash || "";
          if (!hash) continue;
          const to = t.to ? normalizeAddress(t.to) : "";
          const from = t.from ? normalizeAddress(t.from) : "";
          const isErc20 = t.category === "erc20";
          const rawValue = t.rawContract?.value ?? t.value ?? "0";
          const decimals = t.rawContract?.decimal ? Number(t.rawContract.decimal) : 18;
          const transfer: RawTransfer = {
            hash,
            from,
            to,
            valueWei: rawValue,
            tokenAddress: t.rawContract?.address ? normalizeAddress(t.rawContract.address) : null,
            symbol: isErc20 ? t.asset || "UNKNOWN" : "ETH",
            decimals,
            blockNumber: t.blockNum ? Number.parseInt(t.blockNum, 16) : 0,
            timestampIso: t.metadata?.blockTimestamp || new Date(0).toISOString(),
            kind: isErc20 ? "ERC20" : "ETH",
            gasUsed: t.gasUsed,
            gasPriceWei: t.gasPrice,
          };
          if (!seen.has(hash)) {
            seen.add(hash);
            transferMap.set(hash, transfer);
          }
        }
        pageKey = changes.pageKey;
        if (!pageKey) break;
      }
    }

    if (transferMap.size === 0) throw Errors.noTransactions(address);

    return {
      address: addr,
      balanceWei,
      txHashes: seen,
      transfers: Array.from(transferMap.values()).sort((a, b) => a.blockNumber - b.blockNumber),
      warnings,
      demo: false,
    };
  }
}

export { humanAmount, bigintOf };