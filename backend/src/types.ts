export type Direction = "INCOMING" | "OUTGOING" | "SELF";

export interface NormalizedTx {
  hash: string;
  from: string;
  to: string;
  value: number;
  token: string;
  tokenSymbol: string;
  timestamp: string;
  direction: Direction;
  blockNumber: number;
  gasUsed?: number;
  gasPriceGwei?: number;
  feeEth?: number;
  kind: "ETH" | "ERC20";
}

export interface WalletOverview {
  address: string;
  network: string;
  balance: string;
  txCount: number;
  tokenTransferCount: number;
  firstSeen: string | null;
  lastActivity: string | null;
  uniqueCounterparties: number;
  demo: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "investigated" | "vasp" | "intermediary" | "counterparty" | "unknown";
  entity?: string;
  addressLabel?: string;
  txCount: number;
  totalVolume: number;
  relevance: number;
  demoSampleAddress?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  hash: string;
  amount: number;
  token: string;
  timestamp: string;
  direction: Direction;
  count: number;
  totalAmount: number;
}

export interface TransactionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
  truncated: boolean;
}

export interface AttributionFactors {
  knownAddressInteraction: number;
  graphProximity: number;
  fundFlow: number;
  clusterSimilarity: number;
  behaviorSimilarity: number;
}

export interface VaspCandidate {
  vaspId: string;
  name: string;
  entityType: string;
  score: number;
  rawScore: number;
  factors: AttributionFactors;
  minHops: number | null;
  directInteractionCount: number;
  demoSample: boolean;
}

export interface AttributionResult {
  likelyVasp: string | null;
  likelyVaspId: string | null;
  confidence: number;
  factors: AttributionFactors | null;
  candidates: VaspCandidate[];
  weights: AttributionWeights;
  method: string;
}

export interface AttributionWeights {
  knownAddressInteraction: number;
  graphProximity: number;
  fundFlow: number;
  clusterSimilarity: number;
  behaviorSimilarity: number;
}

export type EvidenceStrength = "HIGH" | "MEDIUM" | "LOW";

export interface EvidenceItem {
  id: string;
  type: string;
  title: string;
  description: string;
  strength: EvidenceStrength;
  source: string;
  relatedTransactions: string[];
}

export interface FundFlowPath {
  id: string;
  hops: string[];
  labels: string[];
  totalAmount: number;
  token: string;
  txHashes: string[];
  hopCount: number;
}

export interface SuspiciousPattern {
  id: string;
  label: string;
  detail: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface InvestigationSummary {
  totalVolumeEth: number;
  connectedEntities: number;
  graphDepth: number;
  knownVaspInteractions: number;
  suspiciousPatterns: SuspiciousPattern[];
  inboundVolume: number;
  outboundVolume: number;
}

export interface Investigation {
  id: string;
  address: string;
  network: string;
  demo: boolean;
  analyzedAt: string;
  investigator: string;
  status: "complete" | "partial";
  warnings: string[];
  wallet: WalletOverview;
  transactions: NormalizedTx[];
  graph: TransactionGraph;
  attribution: AttributionResult;
  evidence: EvidenceItem[];
  fundFlow: FundFlowPath[];
  summary: InvestigationSummary;
  explanation: string;
  explanationSource: "groq" | "template";
  reportId: string | null;
}

export interface ReportSection {
  key: string;
  title: string;
  lines: string[];
}

export interface InvestigationReport {
  id: string;
  investigationId: string;
  address: string;
  title: string;
  createdAt: string;
  disclaimer: string;
  sections: ReportSection[];
}

export interface VaspAddressEntry {
  address: string;
  label?: string;
  network: string;
  demoSample: boolean;
  addedAt: string;
}

export interface VaspEntity {
  id: string;
  name: string;
  entityType: string;
  blockchain: string;
  knownAddresses: VaspAddressEntry[];
  tags: string[];
  source: string;
  confidence: number;
  lastUpdated: string;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  service: string;
  demoMode: boolean;
  demoWallet: string;
  services: {
    database: "sqlite";
    alchemy: "configured" | "not-configured";
    etherscan: "configured" | "not-configured";
    groq: "configured" | "not-configured";
    pythonAnalysis: "available" | "unavailable";
  };
  attributionWeights: AttributionWeights;
  uptimeSeconds: number;
}

/* ---------- Attribution timeline (flagship) ---------- */

export interface TimelinePoint {
  ts: string;
  txCount: number;
  cumulativeTxCount: number;
  vaspInteractions: number;
  confidence: number;
  likelyVasp: string | null;
  likelyVaspId: string | null;
  dominantFactor: string | null;
}

export interface FirstContact {
  ts: string;
  vaspId: string;
  vaspName: string;
  txHash: string;
  direction: Direction;
  value: number;
  tokenSymbol: string;
}

export interface AttributionTimeline {
  address: string;
  network: string;
  demo: boolean;
  firstTxAt: string | null;
  lastTxAt: string | null;
  bucketCount: number;
  points: TimelinePoint[];
  firstContact: FirstContact | null;
  peakConfidence: number;
  confidenceDelta: number;
  activeSpanDays: number;
}

export interface TimelineSnapshot {
  address: string;
  asOf: string;
  txCount: number;
  graph: TransactionGraph;
  attribution: AttributionResult;
}

/* ---------- Multi-hop trace ---------- */

export interface TraceNode {
  address: string;
  label: string;
  type: GraphNode["type"];
  entity?: string;
  hop: number;
  txCount: number;
  totalVolume: number;
  depthFromSource: number;
}

export interface TraceEdge {
  source: string;
  target: string;
  count: number;
  totalAmount: number;
  token: string;
  firstTs: string;
  lastTs: string;
  onPath: boolean;
}

export interface TraceResult {
  source: string;
  hops: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  paths: string[][];
  reachableVasps: { address: string; name: string; hop: number; entityType: string; demoSample: boolean }[];
  truncated: boolean;
}

/* ---------- Watchlist, alerts, cases, annotations ---------- */

export interface WatchlistEntry {
  id: string;
  address: string;
  label: string | null;
  tags: string[];
  note: string | null;
  createdAt: string;
  lastCheckedAt: string | null;
  lastCheckedTxCount: number | null;
  lastCheckedConfidence: number | null;
}

export type AlertKind = "new-transactions" | "confidence-change" | "new-vasp-contact";

export interface AlertRule {
  id: string;
  address: string;
  kind: AlertKind;
  threshold: number | null;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  address: string;
  kind: AlertKind;
  message: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
}

export interface CaseEntry {
  id: string;
  caseId: string;
  address: string;
  label: string | null;
  note: string | null;
  createdAt: string;
}

export interface CaseFile {
  id: string;
  name: string;
  description: string | null;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  entries: CaseEntry[];
}

export interface AddressAnnotation {
  id: string;
  address: string;
  note: string;
  tags: string[];
  color: "amber" | "rose" | "emerald" | "cyan" | "violet";
  createdAt: string;
  updatedAt: string;
}

/* ---------- Bulk + diff ---------- */

export interface BulkItemResult {
  address: string;
  ok: boolean;
  investigationId?: string;
  likelyVasp: string | null;
  confidence: number;
  txCount: number;
  error?: string;
}

export interface BulkAnalyzeResult {
  requested: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}

export interface InvestigationDiff {
  a: { id: string; analyzedAt: string; likelyVasp: string | null; confidence: number; txCount: number };
  b: { id: string; analyzedAt: string; likelyVasp: string | null; confidence: number; txCount: number };
  sameAddress: boolean;
  confidenceDelta: number;
  vaspChanged: boolean;
  txCountDelta: number;
  factorChanges: { key: keyof AttributionFactors; label: string; a: number; b: number; delta: number }[];
  candidateChanges: { name: string; aScore: number; bScore: number; delta: number }[];
}
