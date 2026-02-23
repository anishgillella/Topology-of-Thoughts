"use client";

import { useEffect, useRef } from "react";
import { useVisionStore } from "@/lib/visionStore";

// MediaPipe hand connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // index
  [0, 9], [9, 10], [10, 11], [11, 12],  // middle
  [0, 13], [13, 14], [14, 15], [15, 16],// ring
  [0, 17], [17, 18], [18, 19], [19, 20],// pinky
  [5, 9], [9, 13], [13, 17],            // palm
];

export default function GestureOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);
  const gestureOverlayVisible = useVisionStore((s) => s.gestureOverlayVisible);

  useEffect(() => {
    if (!cameraEnabled || !gestureOverlayVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const c = canvasRef.current!;
      const context = ctx!;

      c.width = window.innerWidth;
      c.height = window.innerHeight;
      context.clearRect(0, 0, c.width, c.height);

      const state = useVisionStore.getState();
      const { rawHandLandmarks, hands } = state;

      for (let h = 0; h < rawHandLandmarks.length; h++) {
        const { landmarks, handedness } = rawHandLandmarks[h];
        const color = handedness === "Left" ? "rgba(0, 255, 255, 0.6)" : "rgba(255, 0, 255, 0.6)";
        const dotColor = handedness === "Left" ? "rgba(0, 255, 255, 0.8)" : "rgba(255, 0, 255, 0.8)";

        // Mirror flip: x is already in video space which is mirrored
        const toScreen = (lm: { x: number; y: number }) => ({
          x: (1 - lm.x) * c.width,
          y: lm.y * c.height,
        });

        // Draw connections
        context.strokeStyle = color;
        context.lineWidth = 2;
        for (const [start, end] of HAND_CONNECTIONS) {
          const a = toScreen(landmarks[start]);
          const b = toScreen(landmarks[end]);
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }

        // Draw landmark dots
        context.fillStyle = dotColor;
        for (const lm of landmarks) {
          const p = toScreen(lm);
          context.beginPath();
          context.arc(p.x, p.y, 3, 0, Math.PI * 2);
          context.fill();
        }

        // Gesture label near wrist
        const gesture = hands[h];
        if (gesture && gesture.type !== "none") {
          const wrist = toScreen(landmarks[0]);
          context.font = "bold 14px monospace";
          context.fillStyle = "rgba(255, 255, 255, 0.9)";
          context.fillText(
            gesture.type.toUpperCase(),
            wrist.x - 30,
            wrist.y + 30
          );
        }

        // Pinch indicator
        if (gesture && gesture.type === "pinch") {
          const thumb = toScreen(landmarks[4]);
          const index = toScreen(landmarks[8]);
          const cx = (thumb.x + index.x) / 2;
          const cy = (thumb.y + index.y) / 2;
          const radius = Math.max(
            5,
            (gesture.pinchDistance ?? 0.5) * 30
          );

          context.beginPath();
          context.arc(cx, cy, radius, 0, Math.PI * 2);
          context.strokeStyle = "rgba(139, 92, 246, 0.8)";
          context.lineWidth = 2;
          context.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraEnabled, gestureOverlayVisible]);

  if (!cameraEnabled || !gestureOverlayVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
    />
  );
}
