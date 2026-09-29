import type {
  HealthStatus,
  Investigation,
  InvestigationReport,
  InvestigationRow,
  NormalizedTx,
  TransactionGraph,
  AttributionResult,
  EvidenceItem,
  VaspEntity,
  AttributionTimeline,
  TimelineSnapshot,
  TraceResult,
  WatchlistEntry,
  AlertRule,
  AlertEvent,
  AlertKind,
  CaseFile,
  CaseEntry,
  AddressAnnotation,
  AnnotationColor,
  BulkAnalyzeResult,
  InvestigationDiff,
  AddressSearchResult,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000/api";

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = new Error(`Network error. Is the backend running at ${API_BASE}?`) as ApiError;
    e.code = "NETWORK";
    throw e;
  }
  clearTimeout(timer);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: { message?: string } })?.error?.message || `Request failed (${res.status})`) as ApiError;
    err.code = (body as { error?: { code?: string } })?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export const api = {
  health: () => request<HealthStatus>("/health"),

  analyze: (address: string, forceDemo: boolean, investigator?: string) =>
    request<{ ok: boolean; investigation: Investigation }>(`/wallet/analyze`, {
      method: "POST",
      body: JSON.stringify({ address, forceDemo, investigator }),
    }),

  wallet: (address: string) => request<{ ok: boolean; wallet: Investigation["wallet"]; investigation: Investigation }>(`/wallet/${address}`),
  transactions: (address: string) => request<{ ok: boolean; transactions: NormalizedTx[] }>(`/wallet/${address}/transactions`),
  graph: (address: string) => request<{ ok: boolean; graph: TransactionGraph }>(`/wallet/${address}/graph`),
  attribution: (address: string) => request<{ ok: boolean; attribution: AttributionResult }>(`/wallet/${address}/attribution`),
  evidence: (address: string) => request<{ ok: boolean; evidence: EvidenceItem[] }>(`/wallet/${address}/evidence`),

  generateReport: (investigationId: string) =>
    request<{ ok: boolean; report: InvestigationReport }>(`/report/generate`, {
      method: "POST",
      body: JSON.stringify({ investigationId }),
    }),
  report: (id: string) => request<{ ok: boolean; report: InvestigationReport }>(`/report/${id}`),

  investigations: () => request<{ ok: boolean; investigations: InvestigationRow[] }>(`/investigations`),
  investigation: (id: string) =>
    request<{ ok: boolean; investigation: Investigation; reports: InvestigationReport[] }>(`/investigations/${id}`),

  vasps: (search?: string) => request<{ ok: boolean; vasps: VaspEntity[] }>(`/vasps${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createVasp: (body: unknown) => request<{ ok: boolean; vasp: VaspEntity }>(`/vasps`, { method: "POST", body: JSON.stringify(body) }),
  updateVasp: (id: string, body: unknown) => request<{ ok: boolean; vasp: VaspEntity }>(`/vasps/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteVasp: (id: string) => request<{ ok: boolean }>(`/vasps/${id}`, { method: "DELETE" }),

  /* ---------------- Attribution timeline (flagship) ---------------- */

  timeline: (address: string, buckets = 32) =>
    request<{ ok: boolean; timeline: AttributionTimeline }>(`/timeline/${address}?buckets=${buckets}`),

  timelineAt: (address: string, ts: string) =>
    request<{ ok: boolean; snapshot: TimelineSnapshot }>(`/timeline/${address}/at?ts=${encodeURIComponent(ts)}`),

  /* ------------------------- Multi-hop trace ------------------------- */

  trace: (address: string, hops = 3) => request<{ ok: boolean; trace: TraceResult }>(`/trace/${address}?hops=${hops}`),

  /* --------------------- Watchlist + live alerts --------------------- */

  watchlist: () => request<{ ok: boolean; entries: WatchlistEntry[] }>(`/watchlist`),
  addWatchlist: (body: { address: string; label?: string | null; tags?: string[]; note?: string | null }) =>
    request<{ ok: boolean; entry: WatchlistEntry }>(`/watchlist`, { method: "POST", body: JSON.stringify(body) }),
  updateWatchlist: (id: string, body: { label?: string | null; note?: string | null; tags?: string[] }) =>
    request<{ ok: boolean; entry: WatchlistEntry }>(`/watchlist/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeWatchlist: (id: string) => request<{ ok: boolean }>(`/watchlist/${id}`, { method: "DELETE" }),

  alertRules: () => request<{ ok: boolean; rules: AlertRule[] }>(`/alerts`),
  createAlert: (body: { address: string; kind: AlertKind; threshold?: number | null; enabled?: boolean }) =>
    request<{ ok: boolean; rule: AlertRule }>(`/alerts`, { method: "POST", body: JSON.stringify(body) }),
  deleteAlert: (id: string) => request<{ ok: boolean }>(`/alerts/${id}`, { method: "DELETE" }),
  checkAlerts: () => request<{ ok: boolean; events: AlertEvent[]; checked: number; updated: number }>(`/alerts/check`, { method: "POST" }),

  /* ------------------------------ Cases ------------------------------ */

  cases: () => request<{ ok: boolean; cases: CaseFile[] }>(`/cases`),
  createCase: (body: { name: string; description?: string | null }) =>
    request<{ ok: boolean; case: CaseFile }>(`/cases`, { method: "POST", body: JSON.stringify(body) }),
  updateCase: (id: string, body: { name?: string; description?: string | null; status?: "open" | "closed" }) =>
    request<{ ok: boolean; case: CaseFile }>(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCase: (id: string) => request<{ ok: boolean }>(`/cases/${id}`, { method: "DELETE" }),
  addCaseEntry: (caseId: string, body: { address: string; label?: string | null; note?: string | null }) =>
    request<{ ok: boolean; entry: CaseEntry }>(`/cases/${caseId}/entries`, { method: "POST", body: JSON.stringify(body) }),
  removeCaseEntry: (id: string) => request<{ ok: boolean }>(`/case-entries/${id}`, { method: "DELETE" }),

  /* ---------------------------- Annotations --------------------------- */

  annotations: (address?: string) =>
    request<{ ok: boolean; annotations: AddressAnnotation[] }>(`/annotations${address ? `?address=${address}` : ""}`),
  createAnnotation: (body: { address: string; note: string; tags?: string[]; color?: AnnotationColor }) =>
    request<{ ok: boolean; annotation: AddressAnnotation }>(`/annotations`, { method: "POST", body: JSON.stringify(body) }),
  updateAnnotation: (id: string, body: { note?: string; tags?: string[] }) =>
    request<{ ok: boolean; annotation: AddressAnnotation }>(`/annotations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAnnotation: (id: string) => request<{ ok: boolean }>(`/annotations/${id}`, { method: "DELETE" }),

  /* ------------------------ Bulk analysis + diff ---------------------- */

  bulkAnalyze: (body: { addresses: string[]; forceDemo?: boolean; investigator?: string }) =>
    request<{ ok: boolean; result: BulkAnalyzeResult }>(`/analyze/bulk`, { method: "POST", body: JSON.stringify(body) }),

  diff: (a: string, b: string) => request<{ ok: boolean; diff: InvestigationDiff }>(`/diff?a=${a}&b=${b}`),

  searchAddresses: (q: string) =>
    request<{ ok: boolean; results: AddressSearchResult[] }>(`/search/addresses?q=${encodeURIComponent(q)}`),
};

export { API_BASE };