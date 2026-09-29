import { randomUUID } from "crypto";
import { getDb } from "./sql";
import type { Investigation, InvestigationReport, VaspEntity, VaspAddressEntry } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

function vaspFromRow(row: {
  id: string;
  name: string;
  entity_type: string;
  blockchain: string;
  known_addresses: string;
  tags: string;
  source: string;
  confidence: number;
  last_updated: string;
}): VaspEntity {
  const knownAddresses = JSON.parse(row.known_addresses || "[]") as VaspAddressEntry[];
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type,
    blockchain: row.blockchain,
    knownAddresses: knownAddresses.map((a) => ({ ...a, address: a.address.toLowerCase() })),
    tags: JSON.parse(row.tags || "[]") as string[],
    source: row.source,
    confidence: row.confidence,
    lastUpdated: row.last_updated,
  };
}

function searchClause(q: string): string {
  const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const like = `%${escaped}%`;
  return "WHERE (name LIKE ? ESCAPE '\\' OR entity_type LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')";
}

export async function listVasps(search?: string): Promise<VaspEntity[]> {
  const db = getDb();
  const rows = search
    ? (db
        .prepare(`SELECT * FROM vasps ${searchClause(search)} ORDER BY name`)
        .all(`%${search}%`, `%${search}%`, `%${search}%`) as Parameters<typeof vaspFromRow>[0][])
    : (db.prepare("SELECT * FROM vasps ORDER BY name").all() as Parameters<typeof vaspFromRow>[0][]);
  return rows.map(vaspFromRow);
}

export async function getVasp(id: string): Promise<VaspEntity | null> {
  const row = getDb().prepare("SELECT * FROM vasps WHERE id = ?").get(id) as Parameters<typeof vaspFromRow>[0] | undefined;
  return row ? vaspFromRow(row) : null;
}

export async function createVasp(input: {
  name: string;
  entityType: string;
  blockchain?: string;
  knownAddresses: { address: string; label?: string; demoSample?: boolean }[];
  tags?: string[];
  source?: string;
  confidence?: number;
}): Promise<VaspEntity> {
  const id = randomUUID();
  const addresses: VaspAddressEntry[] = input.knownAddresses.map((a) => ({
    address: a.address.toLowerCase(),
    label: a.label,
    network: "ethereum",
    demoSample: a.demoSample !== false,
    addedAt: nowIso(),
  }));
  const entity: VaspEntity = {
    id,
    name: input.name,
    entityType: input.entityType,
    blockchain: input.blockchain || "ethereum",
    knownAddresses: addresses,
    tags: input.tags || [],
    source: input.source || "manual",
    confidence: input.confidence ?? 50,
    lastUpdated: nowIso(),
  };
  getDb()
    .prepare(
      "INSERT INTO vasps (id, name, entity_type, blockchain, known_addresses, tags, source, confidence, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(entity.id, entity.name, entity.entityType, entity.blockchain, JSON.stringify(entity.knownAddresses), JSON.stringify(entity.tags), entity.source, entity.confidence, entity.lastUpdated);
  return entity;
}

export async function updateVasp(
  id: string,
  patch: Partial<{ name: string; entityType: string; tags: string[]; source: string; confidence: number; knownAddresses: { address: string; label?: string; demoSample?: boolean }[] }>
): Promise<VaspEntity | null> {
  const existing = await getVasp(id);
  if (!existing) return null;
  const updated: VaspEntity = {
    ...existing,
    name: patch.name ?? existing.name,
    entityType: patch.entityType ?? existing.entityType,
    tags: patch.tags ?? existing.tags,
    source: patch.source ?? existing.source,
    confidence: patch.confidence ?? existing.confidence,
    knownAddresses:
      patch.knownAddresses?.map((a) => ({
        address: a.address.toLowerCase(),
        label: a.label,
        network: "ethereum",
        demoSample: a.demoSample !== false,
        addedAt: nowIso(),
      })) ?? existing.knownAddresses,
    lastUpdated: nowIso(),
  };
  getDb()
    .prepare(
      "UPDATE vasps SET name = ?, entity_type = ?, blockchain = ?, known_addresses = ?, tags = ?, source = ?, confidence = ?, last_updated = ? WHERE id = ?"
    )
    .run(
      updated.name,
      updated.entityType,
      updated.blockchain,
      JSON.stringify(updated.knownAddresses),
      JSON.stringify(updated.tags),
      updated.source,
      updated.confidence,
      updated.lastUpdated,
      id
    );
  return updated;
}

export async function deleteVasp(id: string): Promise<boolean> {
  const res = getDb().prepare("DELETE FROM vasps WHERE id = ?").run(id);
  return res.changes > 0;
}

export async function saveInvestigation(inv: Investigation): Promise<void> {
  getDb()
    .prepare(
      `INSERT INTO investigations (id, address, network, demo, analyzed_at, investigator, likely_vasp, confidence, payload, report_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         address = excluded.address,
         network = excluded.network,
         demo = excluded.demo,
         analyzed_at = excluded.analyzed_at,
         investigator = excluded.investigator,
         likely_vasp = excluded.likely_vasp,
         confidence = excluded.confidence,
         payload = excluded.payload,
         report_id = excluded.report_id`
    )
    .run(
      inv.id,
      inv.address.toLowerCase(),
      inv.network,
      inv.demo ? 1 : 0,
      inv.analyzedAt,
      inv.investigator,
      inv.attribution.likelyVasp ?? null,
      inv.attribution.confidence,
      JSON.stringify(inv),
      inv.reportId
    );
}

export async function listInvestigations(): Promise<
  { id: string; address: string; network: string; demo: boolean; analyzedAt: string; investigator: string; likelyVasp: string | null; confidence: number; reportId: string | null }[]
> {
  const rows = getDb()
    .prepare(
      "SELECT id, address, network, demo, analyzed_at, investigator, likely_vasp, confidence, report_id FROM investigations ORDER BY analyzed_at DESC LIMIT 200"
    )
    .all() as {
    id: string;
    address: string;
    network: string;
    demo: number;
    analyzed_at: string;
    investigator: string;
    likely_vasp: string | null;
    confidence: number;
    report_id: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    address: r.address,
    network: r.network,
    demo: r.demo === 1,
    analyzedAt: r.analyzed_at,
    investigator: r.investigator,
    likelyVasp: r.likely_vasp,
    confidence: r.confidence,
    reportId: r.report_id,
  }));
}

export async function getInvestigation(id: string): Promise<Investigation | null> {
  const row = getDb().prepare("SELECT payload FROM investigations WHERE id = ?").get(id) as { payload: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.payload) as Investigation;
}

export async function getLatestInvestigation(address: string): Promise<Investigation | null> {
  const row = getDb()
    .prepare("SELECT payload FROM investigations WHERE address = ? ORDER BY analyzed_at DESC LIMIT 1")
    .get(address.toLowerCase()) as { payload: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.payload) as Investigation;
}

export async function saveReport(report: InvestigationReport): Promise<void> {
  getDb()
    .prepare(
      `INSERT INTO reports (id, investigation_id, address, title, created_at, disclaimer, sections)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         investigation_id = excluded.investigation_id,
         address = excluded.address,
         title = excluded.title,
         created_at = excluded.created_at,
         disclaimer = excluded.disclaimer,
         sections = excluded.sections`
    )
    .run(report.id, report.investigationId, report.address.toLowerCase(), report.title, report.createdAt, report.disclaimer, JSON.stringify(report.sections));
}

export async function getReport(id: string): Promise<InvestigationReport | null> {
  const row = getDb()
    .prepare("SELECT id, investigation_id, address, title, created_at, disclaimer, sections FROM reports WHERE id = ?")
    .get(id) as
    | { id: string; investigation_id: string; address: string; title: string; created_at: string; disclaimer: string; sections: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    investigationId: row.investigation_id,
    address: row.address,
    title: row.title,
    createdAt: row.created_at,
    disclaimer: row.disclaimer,
    sections: JSON.parse(row.sections),
  };
}

export async function getReportsForInvestigation(investigationId: string): Promise<InvestigationReport[]> {
  const rows = getDb()
    .prepare("SELECT id, investigation_id, address, title, created_at, disclaimer, sections FROM reports WHERE investigation_id = ? ORDER BY created_at DESC")
    .all(investigationId) as {
    id: string;
    investigation_id: string;
    address: string;
    title: string;
    created_at: string;
    disclaimer: string;
    sections: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    investigationId: row.investigation_id,
    address: row.address,
    title: row.title,
    createdAt: row.created_at,
    disclaimer: row.disclaimer,
    sections: JSON.parse(row.sections),
  }));
}