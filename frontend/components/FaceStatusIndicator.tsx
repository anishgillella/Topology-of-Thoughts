"use client";

import { useVisionStore } from "@/lib/visionStore";

const EXPRESSION_LABELS: Record<string, string> = {
  neutral: "NEUTRAL",
  smiling: "SMILING",
  frowning: "FROWNING",
  surprised: "SURPRISED",
  focused: "FOCUSED",
  skeptical: "SKEPTICAL",
};

const EXPRESSION_COLORS: Record<string, string> = {
  neutral: "#a1a1aa",
  smiling: "#4ade80",
  frowning: "#f87171",
  surprised: "#fbbf24",
  focused: "#60a5fa",
  skeptical: "#c084fc",
};

export default function FaceStatusIndicator() {
  const faceState = useVisionStore((s) => s.faceState);
  const faceHudVisible = useVisionStore((s) => s.faceHudVisible);
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);

  if (!cameraEnabled || !faceHudVisible || !faceState) return null;

  const expr = faceState.expression;
  const color = EXPRESSION_COLORS[expr] ?? "#a1a1aa";

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[15]
        bg-zinc-900/90 backdrop-blur-lg border border-zinc-700/50 rounded-2xl
        px-4 py-2 flex items-center gap-3 transition-all duration-300"
    >
      {/* Expression label */}
      <span
        className="text-xs font-mono font-bold tracking-wider transition-colors duration-300"
        style={{ color }}
      >
        {EXPRESSION_LABELS[expr]}
      </span>

      {/* Attention bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-zinc-500 font-mono">ATT</span>
        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${faceState.attentionLevel * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      {/* Engagement radial */}
      <div className="relative w-5 h-5">
        <svg viewBox="0 0 20 20" className="w-full h-full -rotate-90">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="#27272a"
            strokeWidth="2"
          />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeDasharray={`${faceState.engagement * 50.3} 50.3`}
            className="transition-all duration-300"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[7px] font-mono text-zinc-400">
          {Math.round(faceState.engagement * 100)}
        </span>
      </div>
    </div>
  );
}
