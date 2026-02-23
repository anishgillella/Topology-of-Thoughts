"use client";

import { useRef, useCallback } from "react";
import { DeepgramClient } from "@/lib/deepgram";
import { useGraphStore } from "@/lib/store";
import { processInputWithMemory } from "@/lib/processInput";

export default function VoiceInput() {
  const clientRef = useRef<DeepgramClient | null>(null);
  const finalTranscriptRef = useRef("");
  const isListening = useGraphStore((s) => s.isListening);
  const setIsListening = useGraphStore((s) => s.setIsListening);
  const setLiveTranscript = useGraphStore((s) => s.setLiveTranscript);
  const setIsProcessingVoice = useGraphStore((s) => s.setIsProcessingVoice);
  const setGhostNodes = useGraphStore((s) => s.setGhostNodes);
  const clearGhostNodes = useGraphStore((s) => s.clearGhostNodes);

  const appendTranscript = useGraphStore((s) => s.appendTranscript);

  const processTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setIsProcessingVoice(true);
      clearGhostNodes();
      appendTranscript(text);

      // Process in background — don't await, so mic toggle isn't blocked
      processInputWithMemory(text)
        .catch(() => {})
        .finally(() => setIsProcessingVoice(false));
    },
    [clearGhostNodes, setIsProcessingVoice, appendTranscript]
  );

  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Stop immediately — no waiting for processing
      clientRef.current?.stop();
      clientRef.current = null;
      setIsListening(false);
      clearGhostNodes();

      // Process any remaining transcript in the background
      const remaining = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      if (remaining) {
        processTranscript(remaining);
      }
    } else {
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        console.error("NEXT_PUBLIC_DEEPGRAM_API_KEY not set");
        return;
      }

      finalTranscriptRef.current = "";
      setLiveTranscript("");

      const client = new DeepgramClient(
        { apiKey },
        (text, isFinal) => {
          if (isFinal) {
            finalTranscriptRef.current += " " + text;
            setLiveTranscript(finalTranscriptRef.current.trim());
            processTranscript(text);
          } else {
            setLiveTranscript(
              (finalTranscriptRef.current + " " + text).trim()
            );
            const words = text.split(/\s+/).filter((w) => w.length > 3);
            const uniqueWords = Array.from(new Set(words));
            const ghosts = uniqueWords.slice(0, 5).map((word) => ({
              id: `ghost-${word.toLowerCase()}`,
              label: word,
              ghost: true as const,
            }));
            setGhostNodes(ghosts);
          }
        }
      );

      try {
        await client.start();
        clientRef.current = client;
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start voice input:", err);
      }
    }
  }, [
    isListening,
    processTranscript,
    setGhostNodes,
    clearGhostNodes,
    setIsListening,
    setLiveTranscript,
  ]);

  return (
    <button
      onClick={toggleListening}
      className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
        isListening
          ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/50"
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
      }`}
      title={isListening ? "Stop listening" : "Start voice input"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
      {isListening && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}
