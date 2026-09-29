import { ethers } from "ethers";
import { AppError, Errors } from "./errors";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isValidAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!ADDRESS_RE.test(value)) return false;
  try {
    ethers.getAddress(value);
    return true;
  } catch {
    return ADDRESS_RE.test(value);
  }
}

export function requireAddress(value: unknown): string {
  if (!isValidAddress(value)) throw Errors.invalidAddress();
  return (value as string).toLowerCase();
}

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function isTxHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function assertBodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }
  return body as Record<string, unknown>;
}
