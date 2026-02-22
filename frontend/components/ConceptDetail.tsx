"use client";

import { useGraphStore } from "@/lib/store";

export default function ConceptDetail() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const removeNode = useGraphStore((s) => s.removeNode);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const connectedEdges = edges.filter(
    (e) => e.source === selectedNodeId || e.target === selectedNodeId
  );
  const connectedNodeIds = new Set(
    connectedEdges.flatMap((e) => [e.source, e.target]).filter((id) => id !== selectedNodeId)
  );
  const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id));

  const handleDelete = () => {
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
  };

  return (
    <div className="absolute top-4 left-16 z-10 bg-zinc-900/90 backdrop-blur-lg border border-zinc-700/50 rounded-2xl text-white w-72 shadow-xl shadow-black/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-violet-400 truncate">
            {node.label}
          </h3>
          {node.mentionCount && node.mentionCount > 1 && (
            <span className="inline-block mt-1 text-[10px] text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">
              {node.mentionCount} mentions
            </span>
          )}
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="flex items-center justify-center w-6 h-6 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors ml-2 flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {node.description && (
        <p className="text-xs text-zinc-400 leading-relaxed px-4 pb-3">
          {node.description}
        </p>
      )}

      {/* Connections */}
      {connectedNodes.length > 0 && (
        <div className="border-t border-zinc-800/50 px-4 py-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Connections ({connectedNodes.length})
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {connectedEdges.map((edge) => {
              const otherId =
                edge.source === selectedNodeId ? edge.target : edge.source;
              const otherNode = nodes.find((n) => n.id === otherId);
              return (
                <button
                  key={edge.id}
                  onClick={() => setSelectedNodeId(otherId)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-800/50 transition-colors flex items-center gap-2"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      edge.historical
                        ? "bg-teal-400"
                        : edge.aiInferred
                          ? "bg-amber-400"
                          : "bg-violet-400"
                    }`}
                  />
                  <span className="text-zinc-300 truncate">
                    {otherNode?.label || "Unknown"}
                  </span>
                  {edge.label && (
                    <span className="text-zinc-600 text-[10px] ml-auto flex-shrink-0">
                      {edge.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-zinc-800/50 px-4 py-3">
        {node.embedding && (
          <div className="text-[10px] text-zinc-600 mb-2">
            {node.embedding.length}d embedding
          </div>
        )}
        <button
          onClick={handleDelete}
          className="w-full px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-colors"
        >
          Remove concept
        </button>
      </div>
    </div>
  );
}
