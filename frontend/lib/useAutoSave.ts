"use client";

import { useEffect, useRef } from "react";
import { useGraphStore } from "./store";

export function useAutoSave() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const transcript = useGraphStore((s) => s.transcript);
  const currentSessionId = useGraphStore((s) => s.currentSessionId);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!currentSessionId || nodes.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/sessions/${currentSessionId}/graph`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges, transcript }),
        });
      } catch {
        // Save failed — will retry on next change
      }
    }, 3000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges, transcript, currentSessionId]);
}
