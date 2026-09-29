import math
import sys
from flask import Flask, request, jsonify

try:
    import networkx as nx
    HAVE_NX = True
except Exception:
    HAVE_NX = False

try:
    import numpy as np
    HAVE_NP = True
except Exception:
    HAVE_NP = False

app = Flask(__name__)


def shortest_distances(graph, source, targets):
    try:
        lengths = nx.single_source_shortest_path_length(graph, source)
    except Exception:
        return {}
    out = {}
    for t in targets:
        d = lengths.get(t)
        if d is not None and d != 0:
            out[t] = d
    return out


def build_graph(payload):
    if not HAVE_NX:
        return None
    g = nx.DiGraph()
    for n in payload.get("nodes", []):
        g.add_node(n.get("id"), type=n.get("type", "unknown"))
    for e in payload.get("edges", []):
        g.add_edge(e.get("source"), e.get("target"))
    return g


def moderate_communities(g):
    if not HAVE_NX:
        return {}
    undirected = g.to_undirected()
    comp = nx.algorithms.community.greedy_modularity_communities(undirected)
    community_of = {}
    for idx, members in enumerate(comp):
        for m in members:
            community_of[m] = idx
    return community_of


def community_signal(g, wallet, vasps):
    community_of = moderate_communities(g)
    if not community_of:
        return {}
    wc = community_of.get(wallet)
    if wc is None:
        return {}
    out = {}
    for v in vasps:
        shared = any(community_of.get(addr) == wc for addr in v.get("addresses", []))
        n = sum(1 for addr in v.get("addresses", []) if community_of.get(addr) == wc)
        out[v.get("id")] = 1.0 if shared else 0.0
    return out


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "networkx": HAVE_NX, "numpy": HAVE_NP})


@app.route("/analyze", methods=["POST"])
def analyze():
    payload = request.get_json(force=True)
    wallet = payload.get("investigated", "")
    vasps = payload.get("vasps", [])

    if not HAVE_NX:
        return jsonify(
            {
                "available": False,
                "error": "networkx not installed",
            }
        ), 200

    g = build_graph(payload)

    vasp_targets = []
    for v in vasps:
        for addr in v.get("addresses", []):
            vasp_targets.append(addr)

    try:
        if HAVE_NP:
            pr = nx.pagerank(g, alpha=0.85)
        else:
            pr = dict(nx.degree(g))
    except Exception:
        pr = {}

    top_by_pagerank = sorted(pr, key=lambda n: pr[n], reverse=True)[:10]

    distances = shortest_distances(g, wallet, vasp_targets)
    med_dist = {}
    for v in vasps:
        ds = [distances.get(addr) for addr in v.get("addresses", []) if distances.get(addr) is not None]
        if ds:
            med_dist[v.get("id")] = max(ds) if False else min(ds)

    clusters = community_signal(g, wallet, vasps)

    return jsonify(
        {
            "available": True,
            "networkx": HAVE_NX,
            "medianDistancePerVasp": med_dist,
            "pagerankTop": top_by_pagerank,
            "communitySignal": clusters,
            "nodeCount": g.number_of_nodes(),
            "edgeCount": g.number_of_edges(),
        }
    )


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5090
    app.run(host="127.0.0.1", port=port, debug=False)