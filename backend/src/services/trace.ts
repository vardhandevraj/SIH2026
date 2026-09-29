import type { NormalizedTx, VaspEntity, TraceResult, TraceNode, TraceEdge, GraphNode } from "../types";
import { buildAdjacency, neighbors, bfsDistances } from "./graph";

function classify(address: string, source: string, vaspMap: Map<string, VaspEntity>, dist: Map<string, number>): GraphNode["type"] {
  if (address === source) return "investigated";
  const vasp = vaspMap.get(address);
  if (vasp) return "vasp";
  const d = dist.get(address);
  if (d === undefined) return "unknown";
  if (d === 1) return "counterparty";
  return "intermediary";
}

function shortLabel(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Expands outward from a source address through already-collected transaction
 * data, up to `hops` hops, and flags which VASP nodes are reachable.
 *
 * This deliberately reuses the data already fetched for the investigated wallet
 * so the trace is instant and free. Nodes reached here can then be pivoted into
 * their own full investigation from the UI.
 */
export function buildTrace(txs: NormalizedTx[], sourceAddress: string, vasps: VaspEntity[], hops = 3, maxNodes = 250): TraceResult {
  const source = sourceAddress.toLowerCase();
  const boundedHops = Math.max(1, Math.min(5, hops));
  const adj = buildAdjacency(txs);

  const vaspMap = new Map<string, VaspEntity>();
  for (const v of vasps) for (const a of v.knownAddresses) vaspMap.set(a.address.toLowerCase(), v);

  const dist = bfsDistances(adj, source, boundedHops);

  const nodeInfo = new Map<string, { count: number; volume: number }>();
  for (const t of txs) {
    for (const n of [t.from.toLowerCase(), t.to.toLowerCase()]) {
      const info = nodeInfo.get(n) || { count: 0, volume: 0 };
      info.count += 1;
      info.volume += Math.abs(t.value);
      nodeInfo.set(n, info);
    }
  }

  let reached = Array.from(dist.entries()).filter(([addr, d]) => d <= boundedHops);
  let truncated = false;
  if (reached.length > maxNodes) {
    truncated = true;
    reached = reached
      .sort((x, y) => {
        const vi = vaspMap.has(x[0]) ? 1 : 0;
        const vj = vaspMap.has(y[0]) ? 1 : 0;
        if (vi !== vj) return vj - vi;
        return x[1] - y[1];
      })
      .slice(0, maxNodes);
  }
  const keep = new Set(reached.map(([addr]) => addr));
  keep.add(source);

  const nodes: TraceNode[] = [];
  for (const [addr, hop] of reached) {
    const info = nodeInfo.get(addr) || { count: 0, volume: 0 };
    const vasp = vaspMap.get(addr);
    nodes.push({
      address: addr,
      label: addr === source ? "SOURCE" : vasp ? vasp.name.toUpperCase() : shortLabel(addr),
      type: classify(addr, source, vaspMap, dist),
      entity: vasp?.name,
      hop,
      txCount: info.count,
      totalVolume: Math.round(info.volume * 10000) / 10000,
      depthFromSource: hop,
    });
  }

  const edges: TraceEdge[] = [];
  const seen = new Set<string>();
  for (const e of adj.edges) {
    if (!keep.has(e.source) || !keep.has(e.target)) continue;
    const key = `${e.source}|${e.target}|${e.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      source: e.source,
      target: e.target,
      count: e.count,
      totalAmount: Math.round(e.totalAmount * 10000) / 10000,
      token: e.token,
      firstTs: e.firstTs,
      lastTs: e.lastTs,
      onPath: false,
    });
  }

  // Shortest source -> VASP paths, so the UI can highlight the actual chain of custody.
  const paths: string[][] = [];
  const reachableVasps: TraceResult["reachableVasps"] = [];
  const bestPerEntity = new Map<string, { hop: number; address: string; name: string; entityType: string; demoSample: boolean }>();
  const vaspNodes = nodes.filter((n) => n.type === "vasp").sort((a, b) => a.hop - b.hop);

  for (const vn of vaspNodes) {
    const entity = vaspMap.get(vn.address);
    const entityKey = entity?.id ?? vn.address;
    const existing = bestPerEntity.get(entityKey);
    if (!existing || vn.hop < existing.hop) {
      bestPerEntity.set(entityKey, {
        hop: vn.hop,
        address: vn.address,
        name: entity?.name || vn.label,
        entityType: entity?.entityType || "unknown",
        demoSample: entity?.knownAddresses.some((a) => a.demoSample) ?? false,
      });
    }
    const path = shortestPath(adj, source, vn.address);
    if (path && paths.length < 12) paths.push(path);
  }

  for (const best of bestPerEntity.values()) {
    reachableVasps.push({ address: best.address, name: best.name, hop: best.hop, entityType: best.entityType, demoSample: best.demoSample });
  }
  reachableVasps.sort((a, b) => a.hop - b.hop);

  const onPath = new Set<string>();
  for (const p of paths) for (const a of p) onPath.add(a);
  for (const e of edges) {
    e.onPath = onPath.has(e.source) && onPath.has(e.target);
  }

  return { source, hops: boundedHops, nodes, edges, paths, reachableVasps, truncated };
}

function shortestPath(adj: ReturnType<typeof buildAdjacency>, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbors(adj, cur)) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, cur);
      if (n === to) {
        const path = [to];
        let step = to;
        while (prev.has(step)) {
          step = prev.get(step)!;
          path.unshift(step);
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}
