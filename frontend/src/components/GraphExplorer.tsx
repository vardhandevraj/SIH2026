import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type NodeProps,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNode, GraphNodeType, TransactionGraph } from "../api/types";
import { shortAddr, formatValue } from "../utils/format";

export interface InvestigationNodeData extends Record<string, unknown> {
  address: string;
  label: string;
  type: GraphNodeType;
  entity?: string;
  addressLabel?: string;
  txCount: number;
  totalVolume: number;
  demoSample?: boolean;
}

type InvestigationNodeType = Node<InvestigationNodeData, "investigation">;

const typeStyles: Record<GraphNodeType, { bg: string; border: string; borderColor: string; text: string; size: number }> = {
  investigated: { bg: "rgba(99,102,241,0.22)", border: "border-accent-indigo", borderColor: "#6366f1", text: "text-white", size: 40 },
  vasp: { bg: "rgba(139,92,246,0.2)", border: "border-accent-violet", borderColor: "#8b5cf6", text: "text-accent-cyan", size: 34 },
  intermediary: { bg: "rgba(34,211,238,0.12)", border: "border-cyan-800", borderColor: "#164e63", text: "text-cyan-200", size: 28 },
  counterparty: { bg: "rgba(148,163,184,0.12)", border: "border-slate-600", borderColor: "#475569", text: "text-slate-300", size: 26 },
  unknown: { bg: "rgba(51,65,85,0.2)", border: "border-slate-700", borderColor: "#334155", text: "text-slate-400", size: 24 },
};

const fallbackStyle = typeStyles.unknown;

function InvestigationNode({ data }: NodeProps<InvestigationNodeType>) {
  const s = typeStyles[data.type] ?? fallbackStyle;
  const outer = data.type === "investigated" || data.type === "vasp";
  return (
    <div
      className={`group relative rounded-xl border px-3 py-2 text-center shadow-glass ${outer ? "glow" : ""} ${s.border}`}
      style={{ background: s.bg, borderColor: s.borderColor }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className={`mx-auto flex items-center justify-center rounded-full ${s.border} bg-base-900`} style={{ width: s.size, height: s.size }}>
        <span className={`text-sm font-bold ${s.text}`}>{(data.address || "0x").slice(2, 4).toUpperCase()}</span>
      </div>
      <div className={`mt-1 text-[11px] font-semibold leading-tight ${s.text}`}>{data.label}</div>
      {data.entity ? <div className="text-[9px] uppercase tracking-wider text-slate-400">{data.entity}</div> : null}
      {data.demoSample ? (
        <div className="mt-0.5 rounded bg-amber-500/10 px-1 py-px text-[8px] uppercase tracking-wider text-amber-400">Demo sample</div>
      ) : null}
      <div className="mt-0.5 text-[9px] text-slate-500">
        {data.txCount} tx · {formatValue(data.totalVolume)}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}

const nodeTypes = { investigation: InvestigationNode };

const minimapColor = (n: { data?: unknown }) => {
  const type = (n.data as InvestigationNodeData | undefined)?.type;
  if (type === "vasp") return "#8b5cf6";
  if (type === "investigated") return "#6366f1";
  if (type === "intermediary") return "#0e7490";
  return "#334155";
};

export function GraphExplorer({ graph, height = 560 }: { graph: TransactionGraph; height?: number }) {
  const [filters, setFilters] = useState<Record<GraphNodeType, boolean>>({
    investigated: true,
    vasp: true,
    intermediary: true,
    counterparty: true,
    unknown: false,
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const draggedPositions = useRef(new Map<string, { x: number; y: number }>());

  const layout = useMemo(() => {
    const investigated = graph.nodes.find((n) => n.type === "investigated")?.id || graph.nodes[0]?.id || "";

    const depthMap = new Map<string, number>([[investigated, 0]]);
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
    const queue: string[] = [investigated];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const d = depthMap.get(cur)!;
      for (const n of adj.get(cur) || []) {
        if (!depthMap.has(n)) {
          depthMap.set(n, d + 1);
          queue.push(n);
        }
      }
    }

    const filteredNodes = graph.nodes.filter((n) => filters[n.type]);
    const keptIds = new Set(filteredNodes.map((n) => n.id));

    const MAX_ROWS = 5;
    const layers = new Map<number, { node: GraphNode; index: number }[]>();
    for (const n of filteredNodes) {
      const d = depthMap.get(n.id) ?? 0;
      const layer = layers.get(d);
      if (layer) layer.push({ node: n, index: layer.length });
      else layers.set(d, [{ node: n, index: 0 }]);
    }

    const rfNodes: InvestigationNodeType[] = filteredNodes.map((n) => {
      const d = depthMap.get(n.id) ?? 0;
      const layer = layers.get(d) || [];
      const idx = layer.find((entry) => entry.node === n)?.index ?? 0;

      const subColumns = Math.max(1, Math.ceil(layer.length / MAX_ROWS));
      const col = Math.floor(idx / MAX_ROWS);
      const row = idx % MAX_ROWS;
      const rowsHere = Math.min(MAX_ROWS, layer.length - col * MAX_ROWS);

      const position = draggedPositions.current.get(n.id) ?? {
        x: d * 280 + 40 + col * 170,
        y: (row - (rowsHere - 1) / 2) * 130 + 60,
      };
      return {
        id: n.id,
        type: "investigation",
        position,
        draggable: true,
        data: {
          address: n.id,
          label: n.label,
          type: n.type,
          entity: n.entity,
          addressLabel: n.addressLabel,
          txCount: n.txCount,
          totalVolume: n.totalVolume,
          demoSample: n.demoSampleAddress,
        } satisfies InvestigationNodeData,
      };
    });

    const rfEdges: Edge[] = graph.edges
      .filter((e) => keptIds.has(e.source) && keptIds.has(e.target))
      .map((e, i) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: e.direction !== "SELF",
        label: `${e.token} ${e.totalAmount >= 10 ? e.totalAmount.toFixed(0) : e.totalAmount}`,
        labelStyle: { fill: "#64748b", fontSize: 9 },
        style: i % 7 === 0 ? { stroke: "rgba(34,211,238,0.55)", strokeWidth: 1.5 } : { stroke: "rgba(100,116,139,0.4)", strokeWidth: 1.2 },
      }));

    return { nodes: rfNodes, baseEdges: rfEdges };
  }, [graph, filters]);

  const { baseEdges } = layout;
  const [nodes, setNodes] = useState<InvestigationNodeType[]>(layout.nodes);
  useEffect(() => {
    setNodes(layout.nodes);
  }, [layout]);

  const onNodesChange = useCallback((changes: NodeChange<InvestigationNodeType>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const edges = useMemo(
    () => (selectedEdgeId ? baseEdges.map((e) => (e.id === selectedEdgeId ? { ...e, style: { stroke: "#22d3ee", strokeWidth: 2.5 } } : e)) : baseEdges),
    [baseEdges, selectedEdgeId],
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? graph.nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [graph, selectedNodeId],
  );

  const toggleFilter = useCallback((type: GraphNodeType) => {
    setFilters((f) => ({ ...f, [type]: !f[type] }));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const onNodeClick = useCallback((_: unknown, node: { id: string }) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: unknown, edge: { id: string }) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const onNodeDragStop = useCallback((_: unknown, node: { id: string; position: { x: number; y: number } }) => {
    draggedPositions.current.set(node.id, { ...node.position });
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["investigated", "Investigated"],
            ["vasp", "Known VASP"],
            ["intermediary", "Intermediary"],
            ["counterparty", "Counterparty"],
            ["unknown", "Unknown"],
          ] as [GraphNodeType, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => toggleFilter(t)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filters[t] ? "border-accent-indigo/50 bg-accent-indigo/15 text-accent-cyan" : "border-slate-700 bg-transparent text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
        {graph.truncated ? <span className="text-xs text-amber-400/80">Graph truncated for performance</span> : null}
      </div>
      <div className="relative" style={{ height }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2.5}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onlyRenderVisibleElements
        >
          <Background color="#1e293b" gap={22} />
          <Controls />
          <MiniMap pannable zoomable className="!bg-base-900" nodeColor={minimapColor} />
        </ReactFlow>
      </div>

      {selectedNode ? (
        <div className="glass-strong mt-3 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-sm text-accent-cyan">{shortAddr(selectedNode.id, 10, 8)}</div>
              <div className="text-xs text-slate-400">
                {selectedNode.label}
                {selectedNode.entity ? ` · ${selectedNode.entity}` : ""}
              </div>
            </div>
            <span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400">{selectedNode.type}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Transactions</div>
              <div className="font-mono text-sm text-white">{selectedNode.txCount}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Volume</div>
              <div className="font-mono text-sm text-white">{formatValue(selectedNode.totalVolume)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Relevance</div>
              <div className="font-mono text-sm text-white">{Math.round(selectedNode.relevance * 100)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Demo sample</div>
              <div className="font-mono text-sm text-white">{selectedNode.demoSampleAddress ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}