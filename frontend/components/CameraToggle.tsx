"use client";

import { useEffect } from "react";
import { useVisionStore } from "@/lib/visionStore";

export default function CameraToggle() {
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);
  const toggleCamera = useVisionStore((s) => s.toggleCamera);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        toggleCamera();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCamera]);

  return (
    <button
      onClick={toggleCamera}
      className="absolute bottom-20 right-4 z-40 w-12 h-12 flex items-center justify-center
        bg-zinc-800/80 backdrop-blur rounded-xl border border-zinc-700/50
        hover:bg-zinc-700/80 transition-colors cursor-pointer"
      title={cameraEnabled ? "Turn off camera (Ctrl+Shift+C)" : "Turn on camera (Ctrl+Shift+C)"}
    >
      {cameraEnabled ? (
        // Eye icon (camera on)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        // Camera icon (camera off)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a1a1aa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      )}
    </button>
  );
}
