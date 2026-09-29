import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { DatabaseSync } from "node:sqlite";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let db: DatabaseSync | null = null;

export function initDb(): DatabaseSync {
  if (db) return db;
  const location = env.databasePath === ":memory:" ? ":memory:" : resolve(env.databasePath);
  if (location !== ":memory:") mkdirSync(dirname(location), { recursive: true });
  db = new DatabaseSync(location);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS vasps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      blockchain TEXT NOT NULL DEFAULT 'ethereum',
      known_addresses TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'manual',
      confidence REAL NOT NULL DEFAULT 50,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investigations (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT 'ethereum',
      demo INTEGER NOT NULL DEFAULT 0,
      analyzed_at TEXT NOT NULL,
      investigator TEXT NOT NULL DEFAULT 'session',
      likely_vasp TEXT,
      confidence REAL NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      report_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_investigations_address_time ON investigations(address, analyzed_at DESC);

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      address TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      disclaimer TEXT NOT NULL,
      sections TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_reports_investigation ON reports(investigation_id);

    CREATE TABLE IF NOT EXISTS watchlist (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      label TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      note TEXT,
      created_at TEXT NOT NULL,
      last_checked_at TEXT,
      last_checked_tx_count INTEGER,
      last_checked_confidence REAL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      kind TEXT NOT NULL,
      threshold REAL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_triggered_at TEXT,
      UNIQUE(address, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_alert_rules_address ON alert_rules(address);

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_entries (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      address TEXT NOT NULL,
      label TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_case_entries_case ON case_entries(case_id);

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      note TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      color TEXT NOT NULL DEFAULT 'amber',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_address ON annotations(address);
  `);
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((r) => r.name);
  logger.info("SQLite database ready", { location: location === ":memory:" ? ":memory:" : location, tables });
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error("Database not initialised. Call initDb() at startup.");
  return db;
}

export function dbStats() {
  const d = getDb();
  const one = (sql: string) => (d.prepare(sql).get() as { n: number }).n;
  return {
    vasps: one("SELECT COUNT(*) AS n FROM vasps"),
    investigations: one("SELECT COUNT(*) AS n FROM investigations"),
    reports: one("SELECT COUNT(*) AS n FROM reports"),
    watchlist: one("SELECT COUNT(*) AS n FROM watchlist"),
    cases: one("SELECT COUNT(*) AS n FROM cases"),
    annotations: one("SELECT COUNT(*) AS n FROM annotations"),
    alerts: one("SELECT COUNT(*) AS n FROM alert_rules"),
  };
}
