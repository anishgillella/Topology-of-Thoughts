"use client";

import { useVisionStore } from "@/lib/visionStore";

export default function SystemStatusBar() {
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);
  const visionFps = useVisionStore((s) => s.visionFps);
  const hands = useVisionStore((s) => s.hands);
  const faceState = useVisionStore((s) => s.faceState);
  const activeGesture = useVisionStore((s) => s.activeGesture);

  if (!cameraEnabled) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-[15] pointer-events-none
        bg-gradient-to-b from-zinc-950/80 to-transparent"
      style={{ paddingTop: 4, paddingBottom: 16 }}
    >
      <div className="flex items-center justify-center gap-4 font-mono text-[10px] text-zinc-500">
        <span>
          FPS{" "}
          <span className={visionFps > 20 ? "text-emerald-500" : "text-amber-500"}>
            {visionFps}
          </span>
        </span>
        <span className="w-px h-3 bg-zinc-700" />
        <span>
          CAM{" "}
          <span className="text-emerald-500">ON</span>
        </span>
        <span className="w-px h-3 bg-zinc-700" />
        <span>
          HANDS{" "}
          <span className="text-zinc-400">{hands.length}</span>
        </span>
        <span className="w-px h-3 bg-zinc-700" />
        <span>
          FACE{" "}
          <span className={faceState ? "text-emerald-500" : "text-zinc-600"}>
            {faceState ? "OK" : "--"}
          </span>
        </span>
        {activeGesture && activeGesture.type !== "none" && (
          <>
            <span className="w-px h-3 bg-zinc-700" />
            <span className="text-violet-400">
              {activeGesture.type.toUpperCase()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
