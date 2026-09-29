import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { PythonEnrichment } from "./attribution";

export interface PythonGraphInput {
  investigated: string;
  nodes: { id: string; type: string }[];
  edges: { source: string; target: string }[];
  vasps: { id: string; addresses: string[] }[];
}

export async function callPythonAnalysis(input: PythonGraphInput, timeoutMs = 6000): Promise<PythonEnrichment | null> {
  if (!env.pythonUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.pythonUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as PythonEnrichment;
    return body;
  } catch (err) {
    logger.debug("Python analysis service unavailable", { error: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}