import { randomUUID } from "crypto";
import { getDb } from "./sql";
import type {
  WatchlistEntry,
  AlertRule,
  AlertKind,
  AlertEvent,
  CaseFile,
  CaseEntry,
  AddressAnnotation,
} from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

function safeParseArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/* ------------------------------ Watchlist ------------------------------ */

export async function listWatchlist(): Promise<WatchlistEntry[]> {
  const rows = getDb()
    .prepare("SELECT * FROM watchlist ORDER BY created_at DESC")
    .all() as {
    id: string;
    address: string;
    label: string | null;
    tags: string;
    note: string | null;
    created_at: string;
    last_checked_at: string | null;
    last_checked_tx_count: number | null;
    last_checked_confidence: number | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    address: r.address,
    label: r.label,
    tags: safeParseArray<string>(r.tags),
    note: r.note,
    createdAt: r.created_at,
    lastCheckedAt: r.last_checked_at,
    lastCheckedTxCount: r.last_checked_tx_count,
    lastCheckedConfidence: r.last_checked_confidence,
  }));
}

export async function addWatchlistEntry(input: {
  address: string;
  label?: string | null;
  tags?: string[];
  note?: string | null;
}): Promise<WatchlistEntry> {
  const address = input.address.toLowerCase();
  const existing = getDb().prepare("SELECT address FROM watchlist WHERE address = ?").get(address);
  if (existing) throw new Error("Address is already on the watchlist.");

  const entry: WatchlistEntry = {
    id: randomUUID(),
    address,
    label: input.label ?? null,
    tags: input.tags ?? [],
    note: input.note ?? null,
    createdAt: nowIso(),
    lastCheckedAt: null,
    lastCheckedTxCount: null,
    lastCheckedConfidence: null,
  };
  getDb()
    .prepare(
      "INSERT INTO watchlist (id, address, label, tags, note, created_at, last_checked_at, last_checked_tx_count, last_checked_confidence) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)"
    )
    .run(entry.id, entry.address, entry.label, JSON.stringify(entry.tags), entry.note, entry.createdAt);
  return entry;
}

export async function updateWatchlistEntry(
  id: string,
  patch: { label?: string | null; tags?: string[]; note?: string | null }
): Promise<WatchlistEntry | null> {
  const row = getDb().prepare("SELECT * FROM watchlist WHERE id = ?").get(id) as
    | { id: string; address: string; label: string | null; tags: string; note: string | null; created_at: string; last_checked_at: string | null; last_checked_tx_count: number | null; last_checked_confidence: number | null }
    | undefined;
  if (!row) return null;

  const label = patch.label === undefined ? row.label : patch.label;
  const tags = patch.tags === undefined ? row.tags : JSON.stringify(patch.tags);
  const note = patch.note === undefined ? row.note : patch.note;

  getDb()
    .prepare("UPDATE watchlist SET label = ?, tags = ?, note = ? WHERE id = ?")
    .run(label, tags, note, id);

  return {
    id: row.id,
    address: row.address,
    label,
    tags: safeParseArray<string>(tags),
    note,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
    lastCheckedTxCount: row.last_checked_tx_count,
    lastCheckedConfidence: row.last_checked_confidence,
  };
}

export async function removeWatchlistEntry(id: string): Promise<boolean> {
  const res = getDb().prepare("DELETE FROM watchlist WHERE id = ?").run(id);
  if (res.changes > 0) {
    getDb().prepare("DELETE FROM alert_rules WHERE address = (SELECT address FROM watchlist WHERE id = ?)").run(id);
  }
  return res.changes > 0;
}

export async function recordWatchlistCheck(address: string, txCount: number, confidence: number): Promise<void> {
  getDb()
    .prepare("UPDATE watchlist SET last_checked_at = ?, last_checked_tx_count = ?, last_checked_confidence = ? WHERE address = ?")
    .run(nowIso(), txCount, confidence, address.toLowerCase());
}

/* -------------------------------- Alerts -------------------------------- */

export async function listAlertRules(): Promise<AlertRule[]> {
  const rows = getDb().prepare("SELECT * FROM alert_rules ORDER BY created_at DESC").all() as {
    id: string;
    address: string;
    kind: string;
    threshold: number | null;
    enabled: number;
    created_at: string;
    last_triggered_at: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    address: r.address,
    kind: r.kind as AlertKind,
    threshold: r.threshold,
    enabled: r.enabled === 1,
    createdAt: r.created_at,
    lastTriggeredAt: r.last_triggered_at,
  }));
}

export async function upsertAlertRule(input: { address: string; kind: AlertKind; threshold?: number | null; enabled?: boolean }): Promise<AlertRule> {
  const address = input.address.toLowerCase();
  const existing = getDb().prepare("SELECT * FROM alert_rules WHERE address = ? AND kind = ?").get(address, input.kind) as
    | { id: string; created_at: string }
    | undefined;

  if (existing) {
    getDb()
      .prepare("UPDATE alert_rules SET threshold = ?, enabled = ? WHERE id = ?")
      .run(input.threshold ?? null, input.enabled === false ? 0 : 1, existing.id);
    const rules = await listAlertRules();
    return rules.find((r) => r.id === existing.id)!;
  }

  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO alert_rules (id, address, kind, threshold, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, address, input.kind, input.threshold ?? null, input.enabled === false ? 0 : 1, nowIso());

  const rules = await listAlertRules();
  return rules.find((r) => r.id === id)!;
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  return getDb().prepare("DELETE FROM alert_rules WHERE id = ?").run(id).changes > 0;
}

export async function markAlertTriggered(id: string): Promise<void> {
  getDb().prepare("UPDATE alert_rules SET last_triggered_at = ? WHERE id = ?").run(nowIso(), id);
}

/**
 * Alert events are derived, not stored: they are recomputed by comparing the
 * stored watchlist baseline against a fresh analysis of the same address.
 */
export function buildAlertEvents(
  rules: AlertRule[],
  watchlist: WatchlistEntry[],
  current: Map<string, { txCount: number; confidence: number; likelyVasp: string | null }>
): AlertEvent[] {
  const events: AlertEvent[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const entry = watchlist.find((w) => w.address === rule.address);
    const now = current.get(rule.address);
    if (!entry || !now) continue;

    if (rule.kind === "new-transactions" && entry.lastCheckedTxCount !== null && now.txCount > entry.lastCheckedTxCount) {
      const delta = now.txCount - entry.lastCheckedTxCount;
      events.push({
        id: `${rule.id}-tx-${nowIso()}`,
        ruleId: rule.id,
        address: rule.address,
        kind: rule.kind,
        message: `${delta} new transaction${delta === 1 ? "" : "s"} since last check.`,
        createdAt: nowIso(),
        severity: "info",
      });
    }

    if (rule.kind === "confidence-change" && entry.lastCheckedConfidence !== null) {
      const delta = now.confidence - entry.lastCheckedConfidence;
      const threshold = rule.threshold ?? 5;
      if (Math.abs(delta) >= threshold) {
        events.push({
          id: `${rule.id}-conf-${nowIso()}`,
          ruleId: rule.id,
          address: rule.address,
          kind: rule.kind,
          message: `Attribution confidence ${delta > 0 ? "rose" : "fell"} by ${Math.abs(delta).toFixed(0)} points (${entry.lastCheckedConfidence} -> ${now.confidence}).`,
          createdAt: nowIso(),
          severity: delta > 0 ? "warning" : "info",
        });
      }
    }

    if (rule.kind === "new-vasp-contact" && now.likelyVasp && now.confidence >= (rule.threshold ?? 40)) {
      events.push({
        id: `${rule.id}-vasp-${nowIso()}`,
        ruleId: rule.id,
        address: rule.address,
        kind: rule.kind,
        message: `Now attributes to ${now.likelyVasp} at ${now.confidence}% confidence.`,
        createdAt: nowIso(),
        severity: "critical",
      });
    }
  }
  return events;
}

/* -------------------------------- Cases --------------------------------- */

export async function listCases(): Promise<CaseFile[]> {
  const caseRows = getDb().prepare("SELECT * FROM cases ORDER BY updated_at DESC").all() as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }[];
  const entryRows = getDb().prepare("SELECT * FROM case_entries ORDER BY created_at DESC").all() as {
    id: string;
    case_id: string;
    address: string;
    label: string | null;
    note: string | null;
    created_at: string;
  }[];

  return caseRows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: (c.status as CaseFile["status"]) || "open",
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    entries: entryRows
      .filter((e) => e.case_id === c.id)
      .map((e) => ({
        id: e.id,
        caseId: e.case_id,
        address: e.address,
        label: e.label,
        note: e.note,
        createdAt: e.created_at,
      })),
  }));
}

export async function getCase(id: string): Promise<CaseFile | null> {
  const all = await listCases();
  return all.find((c) => c.id === id) ?? null;
}

export async function createCase(input: { name: string; description?: string | null }): Promise<CaseFile> {
  const id = randomUUID();
  const ts = nowIso();
  getDb()
    .prepare("INSERT INTO cases (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, 'open', ?, ?)")
    .run(id, input.name, input.description ?? null, ts, ts);
  return (await getCase(id))!;
}

export async function updateCase(
  id: string,
  patch: { name?: string; description?: string | null; status?: CaseFile["status"] }
): Promise<CaseFile | null> {
  const existing = await getCase(id);
  if (!existing) return null;
  getDb()
    .prepare("UPDATE cases SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?")
    .run(patch.name ?? existing.name, patch.description === undefined ? existing.description : patch.description, patch.status ?? existing.status, nowIso(), id);
  return getCase(id);
}

export async function deleteCase(id: string): Promise<boolean> {
  getDb().prepare("DELETE FROM case_entries WHERE case_id = ?").run(id);
  return getDb().prepare("DELETE FROM cases WHERE id = ?").run(id).changes > 0;
}

export async function addCaseEntry(input: { caseId: string; address: string; label?: string | null; note?: string | null }): Promise<CaseEntry> {
  const entry: CaseEntry = {
    id: randomUUID(),
    caseId: input.caseId,
    address: input.address.toLowerCase(),
    label: input.label ?? null,
    note: input.note ?? null,
    createdAt: nowIso(),
  };
  getDb()
    .prepare("INSERT INTO case_entries (id, case_id, address, label, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(entry.id, entry.caseId, entry.address, entry.label, entry.note, entry.createdAt);
  getDb().prepare("UPDATE cases SET updated_at = ? WHERE id = ?").run(entry.createdAt, entry.caseId);
  return entry;
}

export async function removeCaseEntry(id: string): Promise<boolean> {
  return getDb().prepare("DELETE FROM case_entries WHERE id = ?").run(id).changes > 0;
}

/* ----------------------------- Annotations ----------------------------- */

export async function listAnnotations(address?: string): Promise<AddressAnnotation[]> {
  const rows = address
    ? (getDb().prepare("SELECT * FROM annotations WHERE address = ? ORDER BY updated_at DESC").all(address.toLowerCase()) as Record<string, string | null>[])
    : (getDb().prepare("SELECT * FROM annotations ORDER BY updated_at DESC").all() as Record<string, string | null>[]);
  return rows.map((r) => ({
    id: String(r.id),
    address: String(r.address),
    note: String(r.note),
    tags: safeParseArray<string>(r.tags),
    color: (r.color as AddressAnnotation["color"]) || "amber",
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function createAnnotation(input: {
  address: string;
  note: string;
  tags?: string[];
  color?: AddressAnnotation["color"];
}): Promise<AddressAnnotation> {
  const id = randomUUID();
  const ts = nowIso();
  getDb()
    .prepare("INSERT INTO annotations (id, address, note, tags, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.address.toLowerCase(), input.note, JSON.stringify(input.tags ?? []), input.color ?? "amber", ts, ts);
  const all = await listAnnotations();
  return all.find((a) => a.id === id)!;
}

export async function updateAnnotation(
  id: string,
  patch: { note?: string; tags?: string[]; color?: AddressAnnotation["color"] }
): Promise<AddressAnnotation | null> {
  const existing = (await listAnnotations()).find((a) => a.id === id);
  if (!existing) return null;
  getDb()
    .prepare("UPDATE annotations SET note = ?, tags = ?, color = ?, updated_at = ? WHERE id = ?")
    .run(patch.note ?? existing.note, patch.tags ? JSON.stringify(patch.tags) : JSON.stringify(existing.tags), patch.color ?? existing.color, nowIso(), id);
  return (await listAnnotations()).find((a) => a.id === id) ?? null;
}

export async function deleteAnnotation(id: string): Promise<boolean> {
  return getDb().prepare("DELETE FROM annotations WHERE id = ?").run(id).changes > 0;
}
