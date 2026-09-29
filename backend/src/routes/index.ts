import { Router } from "express";
import { analyzeWallet } from "../services/pipeline";
import { featureRouter } from "./features";
import {
  listInvestigations,
  getInvestigation,
  getLatestInvestigation,
  saveReport,
  listVasps,
  getVasp,
  createVasp,
  updateVasp,
  deleteVasp,
  getReport,
  getReportsForInvestigation,
} from "../db/store";
import { buildReport } from "../services/report";
import { requireAddress, isValidAddress } from "../utils/validation";
import { AppError, Errors } from "../utils/errors";
import { asyncHandler } from "../utils/handlers";

export { asyncHandler };

export const router = Router();

router.post(
  "/wallet/analyze",
  asyncHandler(async (req, res) => {
    const address = requireAddress((req.body as { address?: unknown })?.address);
    const forceDemo = Boolean((req.body as { forceDemo?: unknown })?.forceDemo);
    const investigator = typeof (req.body as { investigator?: unknown })?.investigator === "string" ? String((req.body as { investigator?: string }).investigator) : "session";
    const inv = await analyzeWallet({ address, forceDemo, investigator });
    res.status(200).json({ ok: true, investigation: inv });
  })
);

router.get(
  "/wallet/:address",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    let inv = await getLatestInvestigation(address);
    if (!inv) inv = await analyzeWallet({ address });
    res.status(200).json({ ok: true, wallet: inv.wallet, investigation: inv });
  })
);

router.get(
  "/wallet/:address/transactions",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    let inv = await getLatestInvestigation(address);
    if (!inv) inv = await analyzeWallet({ address });
    res.status(200).json({ ok: true, transactions: inv.transactions });
  })
);

router.get(
  "/wallet/:address/graph",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    let inv = await getLatestInvestigation(address);
    if (!inv) inv = await analyzeWallet({ address });
    res.status(200).json({ ok: true, graph: inv.graph });
  })
);

router.get(
  "/wallet/:address/attribution",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    let inv = await getLatestInvestigation(address);
    if (!inv) inv = await analyzeWallet({ address });
    res.status(200).json({ ok: true, attribution: inv.attribution });
  })
);

router.get(
  "/wallet/:address/evidence",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    let inv = await getLatestInvestigation(address);
    if (!inv) inv = await analyzeWallet({ address });
    res.status(200).json({ ok: true, evidence: inv.evidence });
  })
);

router.post(
  "/report/generate",
  asyncHandler(async (req, res) => {
    const body = req.body as { investigationId?: unknown };
    const id = typeof body?.investigationId === "string" && body.investigationId ? body.investigationId : null;
    if (!id) throw new AppError("investigationId is required.", 400, "MISSING_FIELD");
    const investigation = await getInvestigation(id);
    if (!investigation) throw Errors.notFound("Investigation");
    const report = buildReport(investigation);
    await saveReport(report);
    const saved = await getReport(report.id);
    if (saved) {
      investigation.reportId = saved.id;
    }
    res.status(201).json({ ok: true, report });
  })
);

router.get(
  "/report/:id",
  asyncHandler(async (req, res) => {
    const report = await getReport(req.params.id);
    if (!report) throw Errors.notFound("Report");
    res.status(200).json({ ok: true, report });
  })
);

router.get("/investigations", asyncHandler(async (_req, res) => {
  const items = await listInvestigations();
  res.status(200).json({ ok: true, investigations: items });
}));

router.get("/investigations/:id", asyncHandler(async (req, res) => {
  const investigation = await getInvestigation(req.params.id);
  if (!investigation) throw Errors.notFound("Investigation");
  const reports = await getReportsForInvestigation(investigation.id);
  res.status(200).json({ ok: true, investigation, reports });
}));

router.get("/vasps", asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const vasps = await listVasps(search);
  res.status(200).json({ ok: true, vasps });
}));

router.get("/vasps/:id", asyncHandler(async (req, res) => {
  const vasp = await getVasp(req.params.id);
  if (!vasp) throw Errors.notFound("VASP entity");
  res.status(200).json({ ok: true, vasp });
}));

router.post("/vasps", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const entityType = typeof body.entityType === "string" && body.entityType.trim() ? body.entityType.trim() : null;
  if (!name || !entityType) throw new AppError("name and entityType are required.", 400, "MISSING_FIELD");
  const knownAddresses = Array.isArray(body.knownAddresses) ? body.knownAddresses : [body];
  const parsed = knownAddresses.flatMap((entry): { address: string; label?: string; demoSample: boolean }[] => {
    const e = entry as Record<string, unknown>;
    const addr = typeof e.address === "string" ? e.address : null;
    if (!addr || !isValidAddress(addr)) return [];
    return [{ address: addr, ...(typeof e.label === "string" ? { label: e.label } : {}), demoSample: e.demoSample !== false }];
  });
  if (parsed.length === 0) throw new AppError("At least one valid Ethereum address is required.", 400, "INVALID_ADDRESS");
  const vasp = await createVasp({
    name,
    entityType,
    blockchain: typeof body.blockchain === "string" ? body.blockchain : "ethereum",
    knownAddresses: parsed,
    tags: Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
    source: typeof body.source === "string" ? body.source : "manual",
    confidence: typeof body.confidence === "number" ? body.confidence : 50,
  });
  res.status(201).json({ ok: true, vasp });
}));

router.put("/vasps/:id", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.entityType === "string" && body.entityType.trim()) patch.entityType = body.entityType.trim();
  if (typeof body.confidence === "number") patch.confidence = body.confidence;
  if (Array.isArray(body.tags)) patch.tags = (body.tags as unknown[]).filter((t): t is string => typeof t === "string");
  if (Array.isArray(body.knownAddresses)) {
    const parsed = (body.knownAddresses as Record<string, unknown>[]).flatMap((e): { address: string; label?: string; demoSample: boolean }[] => {
      const addr = typeof e.address === "string" ? e.address : null;
      if (!addr || !isValidAddress(addr)) return [];
      return [{ address: addr, ...(typeof e.label === "string" ? { label: e.label } : {}), demoSample: e.demoSample !== false }];
    });
    if (parsed.length === 0) throw new AppError("At least one valid address is required when updating knownAddresses.", 400, "INVALID_ADDRESS");
    patch.knownAddresses = parsed;
  }
  const updated = await updateVasp(req.params.id, patch as never);
  if (!updated) throw Errors.notFound("VASP entity");
  res.status(200).json({ ok: true, vasp: updated });
}));

router.delete("/vasps/:id", asyncHandler(async (req, res) => {
  const deleted = await deleteVasp(req.params.id);
  if (!deleted) throw Errors.notFound("VASP entity");
  res.status(200).json({ ok: true });
}));

// Timeline, trace, watchlist, alerts, cases, annotations, bulk and diff.
router.use(featureRouter);
