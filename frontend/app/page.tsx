"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import TextInput from "@/components/TextInput";
import VoiceInput from "@/components/VoiceInput";
import TopologyPanel from "@/components/TopologyPanel";
import SessionSidebar from "@/components/SessionSidebar";
import ConceptDetail from "@/components/ConceptDetail";
import ExportButton from "@/components/ExportButton";
import TranscriptionPanel from "@/components/TranscriptionPanel";
import CameraFeed from "@/components/CameraFeed";
import CameraToggle from "@/components/CameraToggle";
import GestureOverlay from "@/components/GestureOverlay";
import FaceStatusIndicator from "@/components/FaceStatusIndicator";
import SystemStatusBar from "@/components/SystemStatusBar";
import GestureCommandPalette from "@/components/GestureCommandPalette";
import { useAutoEmbeddings } from "@/lib/useEmbeddings";
import { useAutoSave } from "@/lib/useAutoSave";
import { useMediaPipe } from "@/lib/useMediaPipe";
import { useGraphStore } from "@/lib/store";
import { useVisionStore } from "@/lib/visionStore";

const Graph3D = dynamic(() => import("@/components/Graph3D"), { ssr: false });

export default function Home() {
  useAutoEmbeddings();
  useAutoSave();

  const videoRef = useRef<HTMLVideoElement>(null);
  useMediaPipe(videoRef);

  const nodeCount = useGraphStore((s) => s.nodes.length);
  const edgeCount = useGraphStore((s) => s.edges.length);
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);

  return (
    <div className={`flex flex-col h-screen bg-zinc-950${cameraEnabled ? " jarvis-scanline" : ""}`}>
      {/* z-0: Camera feed background */}
      <CameraFeed videoRef={videoRef} />

      {/* z-5: Hand skeleton overlay */}
      <GestureOverlay />

      {/* 3D Graph viewport — z-2 (transparent when camera on) */}
      <div className="flex-1 relative" style={{ zIndex: 2 }}>
        <Graph3D />

        {/* z-10: Existing overlays */}
        <SessionSidebar />
        <TopologyPanel />
        <ConceptDetail />
        <TranscriptionPanel />

        {/* z-15: HUD elements */}
        <SystemStatusBar />
        <FaceStatusIndicator />

        {/* Stats badge */}
        {nodeCount > 0 && (
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 text-[11px] text-zinc-500">
            <span>{nodeCount} nodes</span>
            <span className="w-px h-3 bg-zinc-700" />
            <span>{edgeCount} edges</span>
            <span className="w-px h-3 bg-zinc-700" />
            <span>
              Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400 text-[10px]">R</kbd> to reset view
            </span>
          </div>
        )}

        {/* z-40: Camera controls */}
        <CameraToggle />
        <GestureCommandPalette />
      </div>

      {/* Bottom input bar */}
      <div className="border-t border-zinc-800/50 bg-zinc-900/80 backdrop-blur-lg relative z-10">
        <div className="flex items-center gap-2 px-4 py-3 max-w-5xl mx-auto">
          <VoiceInput />
          <TextInput />
          <ExportButton />
        </div>
      </div>
    </div>
  );
}
