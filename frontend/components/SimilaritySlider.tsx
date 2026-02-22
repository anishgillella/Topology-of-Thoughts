"use client";

import { useGraphStore } from "@/lib/store";

export default function SimilaritySlider() {
  const threshold = useGraphStore((s) => s.similarityThreshold);
  const setSimilarityThreshold = useGraphStore((s) => s.setSimilarityThreshold);

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-zinc-500 whitespace-nowrap">
        Sim
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={threshold}
        onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
        className="w-16 h-1 accent-violet-500 cursor-pointer"
      />
      <span className="text-[11px] text-zinc-500 w-6 tabular-nums">
        {threshold.toFixed(2)}
      </span>
    </div>
  );
}
