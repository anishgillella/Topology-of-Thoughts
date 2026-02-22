"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useGraphStore } from "@/lib/store";

export default function TopologyPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const nodes = useGraphStore((s) => s.nodes);
  const tdaResult = useGraphStore((s) => s.tdaResult);
  const setTDAResult = useGraphStore((s) => s.setTDAResult);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  if (!tdaResult) return null;

  return (
    <div className="absolute top-4 right-4 z-10 bg-zinc-900/90 backdrop-blur-lg border border-zinc-700/50 rounded-2xl text-white shadow-xl shadow-black/20 overflow-hidden w-64">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
      >
        <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
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
                      fill={colors[p.dimension] || "#8b5cf6"}
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
  );
}
