import { AppError, Errors } from "../../utils/errors";

export async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") throw Errors.timeout();
    throw new AppError(`Network request failed: ${err instanceof Error ? err.message : String(err)}`, 503, "NETWORK_FAILURE");
  }
  clearTimeout(timer);
  if (res.status === 429) throw Errors.rateLimited("the provider");
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw Errors.apiUnavailable("the provider");
  }
  if (!res.ok) {
    const detail = body && typeof body === "object" && "message" in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).message)
      : `HTTP ${res.status}`;
    if (res.status === 429) throw Errors.rateLimited("the provider");
    throw new AppError(`Provider error (${detail})`, res.status, "PROVIDER_ERROR");
  }
  return body;
}

export function isoFromSeconds(seconds: string | number): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

export function weiToEth(wei: string | bigint | number): string {
  const n = typeof wei === "bigint" ? wei : BigInt(String(wei));
  const eth = Number(n) / 1e18;
  return eth.toFixed(18);
}

export function weiHexToEth(weiHex: string): string {
  const cleaned = weiHex.startsWith("0x") ? weiHex : "0x" + weiHex;
  if (cleaned === "0x" || cleaned === "0x0") return "0";
  return (Number(BigInt(cleaned)) / 1e18).toString();
}

export function bigintOf(value: string | number | undefined | null): bigint {
  if (value === undefined || value === null || value === "") return 0n;
  const s = String(value).trim();
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

export function humanAmount(raw: string, decimals: number): number {
  const n = bigintOf(raw);
  return Number(n) / Math.pow(10, decimals);
}