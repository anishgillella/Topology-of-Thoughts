"use client";

import { useEffect, useRef } from "react";
import { useGraphStore } from "./store";
import { getEmbedding } from "./embeddings";

export function useAutoEmbeddings() {
  const nodes = useGraphStore((s) => s.nodes);
  const updateNode = useGraphStore((s) => s.updateNode);
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nodesWithoutEmbedding = nodes.filter(
      (n) => !n.embedding && !processingRef.current.has(n.id)
    );

    for (const node of nodesWithoutEmbedding) {
      processingRef.current.add(node.id);

      getEmbedding(node.label + (node.description ? ": " + node.description : ""))
        .then((embedding) => {
          updateNode(node.id, { embedding });
        })
        .catch((err) => {
          console.error(`Failed to compute embedding for "${node.label}":`, err);
        })
        .finally(() => {
          processingRef.current.delete(node.id);
        });
    }
  }, [nodes, updateNode]);
}
