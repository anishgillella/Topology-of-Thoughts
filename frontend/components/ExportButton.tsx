"use client";

import { useGraphStore } from "@/lib/store";

export default function ExportButton() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const tdaResult = useGraphStore((s) => s.tdaResult);

  const exportJSON = () => {
    const data = {
      nodes: nodes.map(({ id, label, description, mentionCount }) => ({
        id,
        label,
        description,
        mentionCount,
      })),
      edges: edges.map(({ id, source, target, label, aiInferred }) => ({
        id,
        source,
        target,
        label,
        aiInferred,
      })),
      tda: tdaResult,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topology-of-thoughts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (nodes.length === 0) return null;

  return (
    <button
      onClick={exportJSON}
      className="flex items-center justify-center w-10 h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all"
      title="Export as JSON"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    </button>
  );
}
