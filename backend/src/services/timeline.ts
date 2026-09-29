import type {
  NormalizedTx,
  VaspEntity,
  TransactionGraph,
  AttributionResult,
  AttributionTimeline,
  TimelinePoint,
  TimelineSnapshot,
  FirstContact,
  AttributionFactors,
} from "../types";
import { buildGraph } from "./graph";
import { computeAttribution, loadWeights } from "./attribution";

const DAY_MS = 86_400_000;

const FACTOR_LABELS: Record<keyof AttributionFactors, string> = {
  knownAddressInteraction: "Known address interaction",
  graphProximity: "Graph proximity",
  fundFlow: "Fund flow",
  clusterSimilarity: "Cluster similarity",
  behaviorSimilarity: "Behaviour similarity",
};

function dominantFactor(factors: AttributionFactors | null): string | null {
  if (!factors) return null;
  let bestKey: keyof AttributionFactors | null = null;
  let bestValue = -1;
  for (const key of Object.keys(factors) as (keyof AttributionFactors)[]) {
    const v = factors[key];
    if (v > bestValue) {
      bestValue = v;
      bestKey = key;
    }
  }
  return bestKey && bestValue > 0 ? FACTOR_LABELS[bestKey] : null;
}

function bucketTimestamps(txs: NormalizedTx[], bucketCount: number): string[] {
  const sorted = [...txs].map((t) => t.timestamp).sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = new Date(last).getTime() - new Date(first).getTime();

  if (span <= 0 || bucketCount <= 1) return [last];

  // Evenly spaced cut points across the observed span. Each point represents
  // "everything the wallet had done up to and including this instant".
  const cuts: string[] = [];
  for (let i = 1; i <= bucketCount; i++) {
    cuts.push(new Date(new Date(first).getTime() + (span * i) / bucketCount).toISOString());
  }
  return cuts;
}

function findFirstContact(txs: NormalizedTx[], vasps: VaspEntity[]): FirstContact | null {
  const lookup = new Map<string, VaspEntity>();
  for (const v of vasps) {
    for (const a of v.knownAddresses) lookup.set(a.address.toLowerCase(), v);
  }
  const ordered = [...txs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const t of ordered) {
    const from = lookup.get(t.from.toLowerCase());
    const to = lookup.get(t.to.toLowerCase());
    if (from || to) {
      const entity = (from || to)!;
      return {
        ts: t.timestamp,
        vaspId: entity.id,
        vaspName: entity.name,
        txHash: t.hash,
        direction: from ? "OUTGOING" : "INCOMING",
        value: Math.abs(t.value),
        tokenSymbol: t.tokenSymbol,
      };
    }
  }
  return null;
}

/**
 * Replays the deterministic attribution engine across a wallet's full history.
 *
 * For every time bucket we rebuild the graph from only the transactions that had
 * occurred by that instant and re-score every VASP candidate. The resulting curve
 * answers the question a block explorer cannot: when did this wallet become
 * attributable to a VASP, and which signal drove the score up?
 */
export function computeAttributionTimeline(
  txs: NormalizedTx[],
  walletAddress: string,
  vasps: VaspEntity[],
  requestedBuckets = 32
): AttributionTimeline {
  const address = walletAddress.toLowerCase();
  const bucketCount = Math.max(4, Math.min(48, requestedBuckets));
  const weights = loadWeights();

  const ordered = [...txs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const firstTxAt = ordered.length ? ordered[0].timestamp : null;
  const lastTxAt = ordered.length ? ordered[ordered.length - 1].timestamp : null;

  if (!ordered.length) {
    return {
      address,
      network: "ethereum",
      demo: false,
      firstTxAt: null,
      lastTxAt: null,
      bucketCount: 0,
      points: [],
      firstContact: null,
      peakConfidence: 0,
      confidenceDelta: 0,
      activeSpanDays: 0,
    };
  }

  const cuts = bucketTimestamps(ordered, bucketCount);
  const points: TimelinePoint[] = [];
  let cursor = 0;

  for (const cut of cuts) {
    while (cursor < ordered.length && ordered[cursor].timestamp <= cut) cursor++;
    const upto = ordered.slice(0, cursor);
    if (!upto.length) continue;

    const graph: TransactionGraph = buildGraph(upto, address, vasps, 2, 80);
    const attribution: AttributionResult = computeAttribution({ txs: upto, vasps, graph, weights });

    const top = attribution.candidates[0];
    const vaspInteractions = top ? top.directInteractionCount : 0;

    points.push({
      ts: cut,
      txCount: upto.length,
      cumulativeTxCount: upto.length,
      vaspInteractions,
      confidence: attribution.confidence,
      likelyVasp: attribution.likelyVasp,
      likelyVaspId: attribution.likelyVaspId,
      dominantFactor: dominantFactor(attribution.factors),
    });
  }

  const peakConfidence = points.reduce((m, p) => Math.max(m, p.confidence), 0);
  const confidenceDelta = points.length ? points[points.length - 1].confidence - points[0].confidence : 0;
  const spanDays = firstTxAt && lastTxAt ? Math.max(1, Math.round((new Date(lastTxAt).getTime() - new Date(firstTxAt).getTime()) / DAY_MS)) : 0;

  return {
    address,
    network: "ethereum",
    demo: false,
    firstTxAt,
    lastTxAt,
    bucketCount: points.length,
    points,
    firstContact: findFirstContact(ordered, vasps),
    peakConfidence,
    confidenceDelta,
    activeSpanDays: spanDays,
  };
}

/**
 * Full re-attribution of a wallet as it stood at a point in time. Powers the
 * timeline scrubber: graph, candidates and score all reflect only the history
 * up to `asOf`.
 */
export function computeSnapshotAt(
  txs: NormalizedTx[],
  walletAddress: string,
  vasps: VaspEntity[],
  asOf: string
): TimelineSnapshot | null {
  const address = walletAddress.toLowerCase();
  const upto = txs.filter((t) => t.timestamp <= asOf).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (!upto.length) return null;

  const graph = buildGraph(upto, address, vasps, 2, 80);
  const attribution = computeAttribution({ txs: upto, vasps, graph, weights: loadWeights() });

  return { address, asOf, txCount: upto.length, graph, attribution };
}
