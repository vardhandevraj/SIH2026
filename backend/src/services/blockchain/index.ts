import type { RawWallet } from "./types";
import { demoWallet } from "./demo";
import { EtherscanClient } from "./etherscan";
import { AlchemyClient } from "./alchemy";
import { env } from "../../config/env";

export interface FetchOptions {
  forceDemo?: boolean;
  requestedByUser?: boolean;
}

export async function fetchWalletData(address: string, options: FetchOptions = {}): Promise<RawWallet> {
  const useDemo = options.forceDemo || env.demoMode;

  if (useDemo) {
    return demoWallet(address);
  }

  const alchemy = new AlchemyClient();
  const etherscan = new EtherscanClient();

  const attempts: RawWallet["demo"] | null = null;

  if (env.alchemyKey) {
    try {
      return await alchemy.fetchWallet(address);
    } catch {
      // fall through to etherscan
    }
  }
  if (env.etherscanKey) {
    try {
      return await etherscan.fetchWallet(address);
    } catch {
      // fall through to error
    }
  }
  if (env.demoMode && !options.forceDemo) {
    const demo = demoWallet(address);
    demo.warnings = ["Blockchain providers unavailable; returning DEMO data. Do not treat as verified evidence."].concat(demo.warnings);
    return demo;
  }
  void attempts;
  throw new Error(
    "Blockchain data could not be retrieved right now. Check your ALCHEMY_API_KEY / ETHERSCAN_API_KEY, or enable DEMO_MODE=true."
  );
}