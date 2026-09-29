import { Router, Request, Response, NextFunction } from "express";
import { analyzeWallet } from "../services/pipeline";
import { computeAttributionTimeline, computeSnapshotAt } from "../services/timeline";
import { buildTrace } from "../services/trace";
import { listVasps, getInvestigation, getLatestInvestigation, listInvestigations } from "../db/store";
import {
  listWatchlist,
  addWatchlistEntry,
  updateWatchlistEntry,
  removeWatchlistEntry,
  recordWatchlistCheck,
  listAlertRules,
  upsertAlertRule,
  deleteAlertRule,
  markAlertTriggered,
  buildAlertEvents,
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  addCaseEntry,
  removeCaseEntry,
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from "../db/features";
import { requireAddress, isValidAddress, num } from "../utils/validation";
import { AppError, Errors } from "../utils/errors";
import { asyncHandler } from "../utils/handlers";
import type { AlertKind, AddressAnnotation, BulkAnalyzeResult, InvestigationDiff, AttributionFactors } from "../types";

export const featureRouter = Router();

const ALERT_KINDS: AlertKind[] = ["new-transactions", "confidence-change", "new-vasp-contact"];
const MAX_BULK = 25;

async function loadOrAnalyze(address: string, forceDemo?: boolean) {
  const existing = await getLatestInvestigation(address);
  if (existing && !forceDemo) return existing;
  return analyzeWallet({ address, forceDemo });
}

/* ===================== Attribution timeline (flagship) ===================== */

featureRouter.get(
  "/timeline/:address",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    const buckets = num(req.query.buckets, 32);
    const inv = await loadOrAnalyze(address);
    const vasps = await listVasps();
    const timeline = computeAttributionTimeline(inv.transactions, address, vasps, buckets);
    timeline.demo = inv.demo;
    res.status(200).json({ ok: true, timeline });
  })
);

featureRouter.get(
  "/timeline/:address/at",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    const asOf = typeof req.query.ts === "string" ? req.query.ts : null;
    if (!asOf || Number.isNaN(new Date(asOf).getTime())) {
      throw new AppError("A valid `ts` query parameter is required.", 400, "MISSING_FIELD");
    }
    const inv = await loadOrAnalyze(address);
    const vasps = await listVasps();
    const snapshot = computeSnapshotAt(inv.transactions, address, vasps, asOf);
    if (!snapshot) {
      throw new AppError("No transactions existed for this address at that point in time.", 404, "NO_TRANSACTIONS_AT_TIME");
    }
    res.status(200).json({ ok: true, snapshot });
  })
);

/* ============================ Multi-hop trace ============================= */

featureRouter.get(
  "/trace/:address",
  asyncHandler(async (req, res) => {
    const address = requireAddress(req.params.address);
    const hops = num(req.query.hops, 3);
    const inv = await loadOrAnalyze(address);
    const vasps = await listVasps();
    const trace = buildTrace(inv.transactions, address, vasps, hops);
    res.status(200).json({ ok: true, trace });
  })
);

/* =============================== Watchlist ================================ */

featureRouter.get(
  "/watchlist",
  asyncHandler(async (_req, res) => {
    res.status(200).json({ ok: true, entries: await listWatchlist() });
  })
);

featureRouter.post(
  "/watchlist",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const address = requireAddress(body.address);
    try {
      const entry = await addWatchlistEntry({
        address,
        label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
        tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      });
      res.status(201).json({ ok: true, entry });
    } catch (e) {
      if (e instanceof Error && e.message.includes("already on the watchlist")) {
        throw new AppError(e.message, 409, "DUPLICATE");
      }
      throw e;
    }
  })
);

featureRouter.patch(
  "/watchlist/:id",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const updated = await updateWatchlistEntry(req.params.id, {
      label: typeof body.label === "string" ? body.label : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : undefined,
    });
    if (!updated) throw Errors.notFound("Watchlist entry");
    res.status(200).json({ ok: true, entry: updated });
  })
);

featureRouter.delete(
  "/watchlist/:id",
  asyncHandler(async (req, res) => {
    const removed = await removeWatchlistEntry(req.params.id);
    if (!removed) throw Errors.notFound("Watchlist entry");
    res.status(200).json({ ok: true });
  })
);

/* ================================= Alerts ================================= */

featureRouter.get(
  "/alerts",
  asyncHandler(async (_req, res) => {
    res.status(200).json({ ok: true, rules: await listAlertRules() });
  })
);

featureRouter.post(
  "/alerts",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const address = requireAddress(body.address);
    const kind = body.kind as AlertKind;
    if (!ALERT_KINDS.includes(kind)) {
      throw new AppError(`kind must be one of: ${ALERT_KINDS.join(", ")}.`, 400, "INVALID_FIELD");
    }
    const rule = await upsertAlertRule({
      address,
      kind,
      threshold: typeof body.threshold === "number" ? body.threshold : null,
      enabled: body.enabled !== false,
    });
    res.status(201).json({ ok: true, rule });
  })
);

featureRouter.delete(
  "/alerts/:id",
  asyncHandler(async (req, res) => {
    const removed = await deleteAlertRule(req.params.id);
    if (!removed) throw Errors.notFound("Alert rule");
    res.status(200).json({ ok: true });
  })
);

/**
 * Re-analyses every watched address and reports what changed since the stored
 * baseline. This is what turns the watchlist from a bookmark list into a monitor.
 */
featureRouter.post(
  "/alerts/check",
  asyncHandler(async (_req, res) => {
    const entries = await listWatchlist();
    const rules = await listAlertRules();
    if (!entries.length) {
      res.status(200).json({ ok: true, events: [], checked: 0, updated: 0 });
      return;
    }

    const current = new Map<string, { txCount: number; confidence: number; likelyVasp: string | null }>();
    let checked = 0;
    for (const entry of entries) {
      try {
        const inv = await loadOrAnalyze(entry.address, true);
        current.set(entry.address, {
          txCount: inv.wallet.txCount,
          confidence: inv.attribution.confidence,
          likelyVasp: inv.attribution.likelyVasp,
        });
        await recordWatchlistCheck(entry.address, inv.wallet.txCount, inv.attribution.confidence);
        checked++;
      } catch {
        // A single failing address must not abort the whole sweep.
      }
    }

    const events = buildAlertEvents(rules, entries, current);
    for (const event of events) await markAlertTriggered(event.ruleId);

    res.status(200).json({ ok: true, events, checked, updated: entries.length });
  })
);

/* ================================= Cases ================================== */

featureRouter.get(
  "/cases",
  asyncHandler(async (_req, res) => {
    res.status(200).json({ ok: true, cases: await listCases() });
  })
);

featureRouter.post(
  "/cases",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
    if (!name) throw new AppError("name is required.", 400, "MISSING_FIELD");
    const created = await createCase({ name, description: typeof body.description === "string" ? body.description : null });
    res.status(201).json({ ok: true, case: created });
  })
);

featureRouter.patch(
  "/cases/:id",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const updated = await updateCase(req.params.id, {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      status: body.status === "closed" ? "closed" : body.status === "open" ? "open" : undefined,
    });
    if (!updated) throw Errors.notFound("Case");
    res.status(200).json({ ok: true, case: updated });
  })
);

featureRouter.delete(
  "/cases/:id",
  asyncHandler(async (req, res) => {
    const removed = await deleteCase(req.params.id);
    if (!removed) throw Errors.notFound("Case");
    res.status(200).json({ ok: true });
  })
);

featureRouter.post(
  "/cases/:id/entries",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const address = requireAddress(body.address);
    const exists = await getCase(req.params.id);
    if (!exists) throw Errors.notFound("Case");
    const entry = await addCaseEntry({
      caseId: req.params.id,
      address,
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    });
    res.status(201).json({ ok: true, entry });
  })
);

featureRouter.delete(
  "/case-entries/:id",
  asyncHandler(async (req, res) => {
    const removed = await removeCaseEntry(req.params.id);
    if (!removed) throw Errors.notFound("Case entry");
    res.status(200).json({ ok: true });
  })
);

/* =============================== Annotations =============================== */

featureRouter.get(
  "/annotations",
  asyncHandler(async (req, res) => {
    const address = typeof req.query.address === "string" && isValidAddress(req.query.address) ? req.query.address : undefined;
    res.status(200).json({ ok: true, annotations: await listAnnotations(address) });
  })
);

featureRouter.post(
  "/annotations",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const address = requireAddress(body.address);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (!note) throw new AppError("note is required.", 400, "MISSING_FIELD");
    const colors: AddressAnnotation["color"][] = ["amber", "rose", "emerald", "cyan", "violet"];
    const annotation = await createAnnotation({
      address,
      note,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
      color: colors.includes(body.color as AddressAnnotation["color"]) ? (body.color as AddressAnnotation["color"]) : "amber",
    });
    res.status(201).json({ ok: true, annotation });
  })
);

featureRouter.patch(
  "/annotations/:id",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const updated = await updateAnnotation(req.params.id, {
      note: typeof body.note === "string" ? body.note : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : undefined,
    });
    if (!updated) throw Errors.notFound("Annotation");
    res.status(200).json({ ok: true, annotation: updated });
  })
);

featureRouter.delete(
  "/annotations/:id",
  asyncHandler(async (req, res) => {
    const removed = await deleteAnnotation(req.params.id);
    if (!removed) throw Errors.notFound("Annotation");
    res.status(200).json({ ok: true });
  })
);

/* ============================== Bulk analysis ============================= */

featureRouter.post(
  "/analyze/bulk",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const raw = Array.isArray(body.addresses) ? body.addresses : [];
    const addresses = raw
      .filter((a): a is string => typeof a === "string")
      .map((a) => a.trim())
      .filter((a) => isValidAddress(a))
      .map((a) => a.toLowerCase());

    if (!addresses.length) throw new AppError("Provide at least one valid Ethereum address in `addresses`.", 400, "MISSING_FIELD");
    if (addresses.length > MAX_BULK) throw new AppError(`Bulk analysis is limited to ${MAX_BULK} addresses per request.`, 400, "LIMIT_EXCEEDED");

    const forceDemo = body.forceDemo !== false;
    const investigator = typeof body.investigator === "string" ? body.investigator : "bulk";

    const results: BulkAnalyzeResult["results"] = [];
    for (const address of addresses) {
      try {
        const inv = await analyzeWallet({ address, forceDemo, investigator });
        results.push({
          address,
          ok: true,
          investigationId: inv.id,
          likelyVasp: inv.attribution.likelyVasp,
          confidence: inv.attribution.confidence,
          txCount: inv.wallet.txCount,
        });
      } catch (e) {
        results.push({
          address,
          ok: false,
          likelyVasp: null,
          confidence: 0,
          txCount: 0,
          error: e instanceof Error ? e.message : "Analysis failed",
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    res.status(200).json({ ok: true, result: { requested: addresses.length, succeeded, failed: addresses.length - succeeded, results } });
  })
);

/* ============================ Diff two analyses =========================== */

const FACTOR_META: { key: keyof AttributionFactors; label: string }[] = [
  { key: "knownAddressInteraction", label: "Known address interaction" },
  { key: "graphProximity", label: "Graph proximity" },
  { key: "fundFlow", label: "Fund flow" },
  { key: "clusterSimilarity", label: "Cluster similarity" },
  { key: "behaviorSimilarity", label: "Behaviour similarity" },
];

featureRouter.get(
  "/diff",
  asyncHandler(async (req, res) => {
    const idA = typeof req.query.a === "string" ? req.query.a : null;
    const idB = typeof req.query.b === "string" ? req.query.b : null;
    if (!idA || !idB) throw new AppError("Both `a` and `b` investigation ids are required.", 400, "MISSING_FIELD");

    const [invA, invB] = await Promise.all([getInvestigation(idA), getInvestigation(idB)]);
    if (!invA) throw Errors.notFound("Investigation A");
    if (!invB) throw Errors.notFound("Investigation B");

    const brief = (inv: typeof invA) => ({
      id: inv!.id,
      analyzedAt: inv!.analyzedAt,
      likelyVasp: inv!.attribution.likelyVasp,
      confidence: inv!.attribution.confidence,
      txCount: inv!.wallet.txCount,
    });

    const scoresByName = (inv: typeof invA) => new Map(inv!.attribution.candidates.map((c) => [c.name, c.score]));
    const mapA = scoresByName(invA);
    const mapB = scoresByName(invB);
    const names = new Set<string>([...mapA.keys(), ...mapB.keys()]);

    const diff: InvestigationDiff = {
      a: brief(invA),
      b: brief(invB),
      sameAddress: invA.address === invB.address,
      confidenceDelta: invB.attribution.confidence - invA.attribution.confidence,
      vaspChanged: invA.attribution.likelyVasp !== invB.attribution.likelyVasp,
      txCountDelta: invB.wallet.txCount - invA.wallet.txCount,
      factorChanges: FACTOR_META.map(({ key, label }) => ({
        key,
        label,
        a: invA.attribution.factors ? invA.attribution.factors[key] : 0,
        b: invB.attribution.factors ? invB.attribution.factors[key] : 0,
        delta: (invB.attribution.factors ? invB.attribution.factors[key] : 0) - (invA.attribution.factors ? invA.attribution.factors[key] : 0),
      })),
      candidateChanges: Array.from(names)
        .map((name) => {
          const aScore = mapA.get(name) ?? 0;
          const bScore = mapB.get(name) ?? 0;
          return { name, aScore, bScore, delta: bScore - aScore };
        })
        .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
        .slice(0, 8),
    };

    res.status(200).json({ ok: true, diff });
  })
);

/* ========================== Address autocomplete ========================== */

featureRouter.get(
  "/search/addresses",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (!q) {
      res.status(200).json({ ok: true, results: [] });
      return;
    }
    const [investigations, watchlist, annotations, caseRows] = await Promise.all([
      listInvestigations(),
      listWatchlist(),
      listAnnotations(),
      listCases(),
    ]);

    const seen = new Set<string>();
    const results: { address: string; label: string; source: string }[] = [];
    const push = (address: string, label: string, source: string) => {
      const a = address.toLowerCase();
      if (seen.has(a) || !a.includes(q)) return;
      seen.add(a);
      results.push({ address: a, label, source });
    };

    for (const w of watchlist) push(w.address, w.label || "Watchlist", "watchlist");
    for (const c of caseRows) for (const e of c.entries) push(e.address, e.label || c.name, "case");
    for (const a of annotations) push(a.address, a.note.slice(0, 60), "annotation");
    for (const i of investigations) push(i.address, i.likelyVasp || "Investigation", "investigation");

    res.status(200).json({ ok: true, results: results.slice(0, 25) });
  })
);
