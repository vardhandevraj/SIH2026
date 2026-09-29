import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env, DEMO_WALLET } from "./config/env";
import { initDb, dbStats } from "./db/sql";
import { seedVasps } from "./db/seed";
import { router } from "./routes";
import { AppError } from "./utils/errors";
import { logger } from "./utils/logger";
import { loadWeights } from "./services/attribution";

const startedAt = Date.now();

export function buildApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } });
      },
    })
  );

  app.use("/api", router);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      status: "ok",
      demoMode: env.demoMode,
      demoWallet: DEMO_WALLET,
      services: {
        database: "sqlite",
        alchemy: env.alchemyKey ? "configured" : "not-configured",
        etherscan: env.etherscanKey ? "configured" : "not-configured",
        groq: env.groqKey ? "configured" : "not-configured",
        pythonAnalysis: env.pythonUrl ? "configured" : "unavailable",
      },
      attributionWeights: loadWeights(),
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      store: dbStats(),
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      logger.warn("Request error", { code: err.code, status: err.status, message: err.message });
      res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    logger.error("Unhandled error", { message });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error. Please try again." } });
  });

  return app;
}

export async function start() {
  initDb();
  await seedVasps();

  const app = buildApp();
  app.listen(env.port, () => {
    logger.info(`ChainTrace backend listening on http://localhost:${env.port}`, {
      demoMode: env.demoMode,
      port: env.port,
    });
  });
}

if (require.main === module) {
  start().catch((err) => {
    logger.error("Fatal startup error", { error: err instanceof Error ? err.stack : String(err) });
    process.exit(1);
  });
}