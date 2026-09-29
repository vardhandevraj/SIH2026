import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import type { Investigation } from "../api/types";
import { LoadingState, ErrorState } from "../components/State";
import { GraphExplorer } from "../components/GraphExplorer";
import { shortAddr } from "../utils/format";

export function GraphPage() {
  const { address = "" } = useParams();
  const [inv, setInv] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .wallet(address)
      .then((r) => setInv(r.investigation))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) return <LoadingState message="Building transaction graph..." />;
  if (error) return <ErrorState message={error} />;
  if (!inv) return <ErrorState message="No graph data." />;

  return (
    <div>
      <Link to={`/wallet/${inv.address}`} className="mb-4 flex items-center gap-1 text-xs text-accent-cyan hover:underline">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Transaction Relationship Graph</h1>
        <div className="mt-1 text-xs text-slate-400">
          <span className="font-mono text-accent-cyan">{shortAddr(inv.address, 10, 8)}</span> · {inv.graph.nodes.length} nodes ·{" "}
          {inv.graph.edges.length} edges · depth {inv.graph.depth}
        </div>
      </div>
      <div className="glass rounded-2xl p-4">
        <GraphExplorer graph={inv.graph} height={650} />
      </div>
    </div>
  );
}