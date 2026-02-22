"use client";

import dynamic from "next/dynamic";
import TextInput from "@/components/TextInput";
import VoiceInput from "@/components/VoiceInput";
import SimilaritySlider from "@/components/SimilaritySlider";
import TopologyPanel from "@/components/TopologyPanel";
import SessionSidebar from "@/components/SessionSidebar";
import ConceptDetail from "@/components/ConceptDetail";
import ExportButton from "@/components/ExportButton";
import TranscriptionPanel from "@/components/TranscriptionPanel";
import { useAutoEmbeddings } from "@/lib/useEmbeddings";
import { useAutoSave } from "@/lib/useAutoSave";
import { useGraphStore } from "@/lib/store";

const Graph3D = dynamic(() => import("@/components/Graph3D"), { ssr: false });

export default function Home() {
  useAutoEmbeddings();
  useAutoSave();

  const nodeCount = useGraphStore((s) => s.nodes.length);
  const edgeCount = useGraphStore((s) => s.edges.length);

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* 3D Graph viewport */}
      <div className="flex-1 relative">
        <Graph3D />

        {/* Overlays */}
        <SessionSidebar />
        <TopologyPanel />
        <ConceptDetail />
        <TranscriptionPanel />

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
      </div>

      {/* Bottom input bar */}
      <div className="border-t border-zinc-800/50 bg-zinc-900/80 backdrop-blur-lg">
        <div className="flex items-center gap-2 px-4 py-3 max-w-5xl mx-auto">
          <VoiceInput />
          <TextInput />
          <div className="flex items-center gap-1">
            <SimilaritySlider />
            <ExportButton />
          </div>
        </div>
      </div>
    </div>
  );
}
