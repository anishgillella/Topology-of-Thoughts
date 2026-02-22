"use client";

import { useGraphStore } from "@/lib/store";

export default function TranscriptionPanel() {
  const isListening = useGraphStore((s) => s.isListening);
  const liveTranscript = useGraphStore((s) => s.liveTranscript);
  const isProcessingVoice = useGraphStore((s) => s.isProcessingVoice);

  if (!isListening && !liveTranscript && !isProcessingVoice) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none flex justify-center px-6 pb-4">
      <div className="pointer-events-auto w-full max-w-2xl bg-zinc-900/95 backdrop-blur-lg border border-zinc-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/50">
          {isListening && (
            <span className="relative flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider">
                Live
              </span>
            </span>
          )}
          {isProcessingVoice && (
            <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
              Processing...
            </span>
          )}
          {!isListening && !isProcessingVoice && liveTranscript && (
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Transcript
            </span>
          )}
        </div>

        {/* Transcript body */}
        <div className="px-4 py-3 max-h-32 overflow-y-auto">
          {liveTranscript ? (
            <p className="text-sm text-zinc-200 leading-relaxed">
              {liveTranscript}
              {isListening && (
                <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </p>
          ) : isListening ? (
            <p className="text-sm text-zinc-500 italic">Listening...</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
