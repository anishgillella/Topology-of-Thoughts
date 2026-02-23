"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useGraphStore } from "@/lib/store";

export default function TopologyPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [tdaOpen, setTdaOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const transcript = useGraphStore((s) => s.transcript);
  const tdaResult = useGraphStore((s) => s.tdaResult);
  const setTDAResult = useGraphStore((s) => s.setTDAResult);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Compute graph stats
  const stats = useMemo(() => {
    const nodeCount = nodes.length;
    const connectionCount = edges.length;

    // Union-find for connected components
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
      return parent.get(x)!;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const n of nodes) find(n.id);
    for (const e of edges) union(e.source, e.target);

    const roots = new Set<string>();
    for (const n of nodes) roots.add(find(n.id));
    const connectedStructures = roots.size;

    // Isolated nodes: appear in zero edges
    const edgeNodeIds = new Set<string>();
    for (const e of edges) {
      edgeNodeIds.add(e.source);
      edgeNodeIds.add(e.target);
    }
    const isolatedNodes = nodes.filter((n) => !edgeNodeIds.has(n.id)).length;

    return { nodeCount, connectionCount, connectedStructures, isolatedNodes };
  }, [nodes, edges]);

  const runTDA = useCallback(async () => {
    const currentNodes = useGraphStore.getState().nodes;
    const nodesWithEmbeddings = currentNodes.filter((n) => n.embedding);

    if (nodesWithEmbeddings.length < 2) {
      setTDAResult(null);
      return;
    }

    try {
      const response = await fetch("/api/tda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeddings: nodesWithEmbeddings.map((n) => n.embedding),
          node_ids: nodesWithEmbeddings.map((n) => n.id),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTDAResult(data);
      }
    } catch {
      // TDA is best-effort
    }
  }, [setTDAResult]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runTDA, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, runTDA]);

  if (nodes.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-10 bg-zinc-900/90 backdrop-blur-lg border border-zinc-700/50 rounded-2xl text-white shadow-xl shadow-black/20 overflow-hidden w-64">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
      >
        <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
          Topology
        </h3>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-zinc-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Graph stats 2x2 grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "Nodes", value: stats.nodeCount, color: "text-blue-400" },
              { label: "Connections", value: stats.connectionCount, color: "text-sky-400" },
              { label: "Structures", value: stats.connectedStructures, color: "text-indigo-400" },
              { label: "Isolated", value: stats.isolatedNodes, color: "text-zinc-400" },
            ].map((item) => (
              <div key={item.label} className="text-center py-2 bg-zinc-800/40 rounded-xl">
                <div className={`text-lg font-bold ${item.color}`}>
                  {item.value}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Collapsible Advanced Topology (TDA) */}
          {tdaResult && (
            <div className="border-t border-zinc-800/50 pt-2">
              <button
                onClick={() => setTdaOpen(!tdaOpen)}
                className="w-full flex items-center justify-between py-1.5 text-[10px] text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
              >
                <span>Advanced Topology</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${tdaOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {tdaOpen && (
                <div className="mt-1">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Components", value: tdaResult.betti_0, color: "text-blue-400" },
                      { label: "Loops", value: tdaResult.betti_1, color: "text-emerald-400" },
                      { label: "Voids", value: tdaResult.betti_2, color: "text-amber-400" },
                    ].map((item) => (
                      <div key={item.label} className="text-center py-2 bg-zinc-800/40 rounded-xl">
                        <div className={`text-lg font-bold ${item.color}`}>
                          {item.value}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {tdaResult.persistence_diagram.length > 0 && (
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">
                        Persistence Diagram
                      </div>
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-20 bg-zinc-800/40 rounded-xl"
                      >
                        <line
                          x1="0" y1="100" x2="100" y2="0"
                          stroke="#27272a" strokeWidth="0.5"
                        />
                        {tdaResult.persistence_diagram.map((p, i) => {
                          const maxVal = 2.0;
                          const x = (p.birth / maxVal) * 90 + 5;
                          const y = 95 - (p.death / maxVal) * 90;
                          const colors = ["#60a5fa", "#34d399", "#fbbf24"];
                          return (
                            <circle
                              key={i}
                              cx={x} cy={y} r="2.5"
                              fill={colors[p.dimension] || "#818cf8"}
                              opacity="0.8"
                            />
                          );
                        })}
                      </svg>
                    </div>
                  )}

                  {tdaResult.cycles.length > 0 && (
                    <div className="mt-2 text-[10px] text-zinc-500">
                      {tdaResult.cycles.length} topological feature
                      {tdaResult.cycles.length > 1 ? "s" : ""} detected
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Session Transcript */}
          {transcript && (
            <div className="border-t border-zinc-800/50 pt-2 mt-2">
              <button
                onClick={() => setTranscriptOpen(!transcriptOpen)}
                className="w-full flex items-center justify-between py-1.5 text-[10px] text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
              >
                <span>Session Transcript</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${transcriptOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {transcriptOpen && (
                <div className="mt-1 max-h-48 overflow-y-auto">
                  <p className="text-xs text-zinc-400 whitespace-pre-wrap break-words">
                    {transcript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
