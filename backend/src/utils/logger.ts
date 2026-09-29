type Level = "info" | "warn" | "error" | "debug";

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel: Level = (process.env.LOG_LEVEL as Level) || "info";

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(0x[a-fA-F0-9]{66,})/g, "0x[REDACTED]").replace(/(sk-[A-Za-z0-9_-]{10,})/g, "sk-[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key|secret|authorization/i.test(k)) out[k] = "[REDACTED]";
      else out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

export function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  if (meta) {
    const safe = sanitize(meta);
    const text = level === "error" ? JSON.stringify(safe) : JSON.stringify(safe);
    if (level === "error") console.error(line, text);
    else if (level === "warn") console.warn(line, text);
    else console.log(line, text);
  } else {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};
