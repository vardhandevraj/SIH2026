export interface RawTransfer {
  hash: string;
  from: string;
  to: string;
  valueWei: string;
  tokenAddress: string | null;
  symbol: string;
  decimals: number;
  blockNumber: number;
  timestampIso: string;
  kind: "ETH" | "ERC20";
  gasUsed?: string;
  gasPriceWei?: string;
  feeWei?: string;
}

export interface RawWallet {
  address: string;
  balanceWei: string;
  txHashes: Set<string>;
  transfers: RawTransfer[];
  warnings: string[];
  demo: boolean;
}