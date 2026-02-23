/**
 * Input processing pipeline (single LLM call):
 * 1. Compute embedding + search long-term memory (FAISS) in parallel
 * 2. Single LLM call: extract concepts + reason about connections
 * 3. Add all nodes/edges to the graph
 */

import { useGraphStore } from "./store";
import { getEmbedding, cosineSimilarity } from "./embeddings";

interface ExtractedNode {
  label: string;
  description?: string;
  existing: boolean;
}

interface ExtractedEdge {
  source: string;
  target: string;
  label?: string;
}

interface SuggestedEdge {
  source: string;
  target: string;
  label?: string;
}

interface SuggestedNode {
  label: string;
  description?: string;
  connects_to: string[];
  edge_labels?: string[];
}

interface MemoryNode {
  id: string;
  session_id: string;
  label: string;
  description?: string;
  similarity?: number;
  session_name?: string;
  created_at?: string;
  last_mentioned_at?: string;
  mention_count?: number;
}

interface MemoryEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export async function processInputWithMemory(text: string): Promise<void> {
  const { addNode, addEdge, updateNode, nodes, edges, currentSessionId } =
    useGraphStore.getState();

  const nodeIdMap = new Map<string, string>();
  for (const n of nodes) {
    nodeIdMap.set(n.label.toLowerCase(), n.id);
  }

  // Step 1: Compute embedding + FAISS search in parallel
  let historicalNodes: MemoryNode[] = [];
  let historicalEdges: MemoryEdge[] = [];

  try {
    const queryEmbedding = await getEmbedding(text);

    const memRes = await fetch("/api/memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embedding: queryEmbedding,
        current_session_id: currentSessionId,
        top_k: 10,
        min_similarity: 0.3,
        hop_depth: 2,
      }),
    });

    if (memRes.ok) {
      const memData = await memRes.json();
      historicalNodes = [
        ...(memData.seed_nodes || []),
        ...(memData.neighbor_nodes || []),
      ];
      historicalEdges = memData.edges || [];
    }
  } catch {
    // Memory search failed, continue without historical context
  }

  // Step 2: Single LLM call — extract + reason together
  const historicalNodeInfos = historicalNodes.map((n) => ({
    label: n.label,
    description: n.description || null,
    session_name: n.session_name || null,
    similarity: n.similarity || null,
    created_at: n.created_at || null,
    last_mentioned_at: n.last_mentioned_at || null,
    mention_count: n.mention_count || 1,
  }));

  const historicalEdgeInfos = historicalEdges.map((e) => {
    const srcNode = historicalNodes.find((n) => n.id === e.source);
    const tgtNode = historicalNodes.find((n) => n.id === e.target);
    return {
      source_label: srcNode?.label || e.source,
      target_label: tgtNode?.label || e.target,
      label: e.label || undefined,
      session_name: srcNode?.session_name || null,
    };
  });

  try {
    const processRes = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        existing_nodes: nodes.map((n) => n.label),
        current_nodes: nodes.map((n) => ({
          label: n.label,
          description: n.description || null,
        })),
        current_edges: edges.map((e) => {
          const src = nodes.find((n) => n.id === e.source);
          const tgt = nodes.find((n) => n.id === e.target);
          return {
            source_label: src?.label || "",
            target_label: tgt?.label || "",
            label: e.label || undefined,
          };
        }),
        historical_nodes: historicalNodeInfos,
        historical_edges: historicalEdgeInfos,
      }),
    });

    if (!processRes.ok) return;
    const data = await processRes.json();

    // Step 3a: Process extracted nodes
    for (const extracted of (data.extracted_nodes || []) as ExtractedNode[]) {
      if (extracted.existing) {
        const existing = nodes.find(
          (n) => n.label.toLowerCase() === extracted.label.toLowerCase()
        );
        if (existing) {
          nodeIdMap.set(extracted.label.toLowerCase(), existing.id);
          updateNode(existing.id, {
            lastMentionedAt: new Date().toISOString(),
            mentionCount: (existing.mentionCount ?? 1) + 1,
          });
        }
      } else {
        // Embedding-based dedup
        const currentNodes = useGraphStore.getState().nodes;
        let matchedExistingId: string | null = null;

        try {
          const newEmbedding = await getEmbedding(extracted.label);
          for (const existingNode of currentNodes) {
            if (!existingNode.embedding) continue;
            if (cosineSimilarity(newEmbedding, existingNode.embedding) > 0.85) {
              matchedExistingId = existingNode.id;
              updateNode(existingNode.id, {
                lastMentionedAt: new Date().toISOString(),
                mentionCount: (existingNode.mentionCount ?? 1) + 1,
              });
              break;
            }
          }
        } catch {
          // Embedding check failed, proceed with insert
        }

        if (matchedExistingId) {
          nodeIdMap.set(extracted.label.toLowerCase(), matchedExistingId);
        } else {
          const id = crypto.randomUUID();
          nodeIdMap.set(extracted.label.toLowerCase(), id);
          addNode({
            id,
            label: extracted.label,
            description: extracted.description ?? undefined,
            createdAt: new Date().toISOString(),
            lastMentionedAt: new Date().toISOString(),
            mentionCount: 1,
          });
        }
      }
    }

    // Step 3b: Process extracted edges
    for (const edge of (data.extracted_edges || []) as ExtractedEdge[]) {
      const sourceId = nodeIdMap.get(edge.source.toLowerCase());
      const targetId = nodeIdMap.get(edge.target.toLowerCase());
      if (sourceId && targetId) {
        addEdge({
          id: crypto.randomUUID(),
          source: sourceId,
          target: targetId,
          label: edge.label ?? undefined,
        });
      }
    }

    // Step 3c: Process suggested nodes
    for (const suggested of (data.suggested_nodes || []) as SuggestedNode[]) {
      if (!nodeIdMap.has(suggested.label.toLowerCase())) {
        const histMatch = historicalNodes.find(
          (h) => h.label.toLowerCase() === suggested.label.toLowerCase()
        );
        const id = crypto.randomUUID();
        nodeIdMap.set(suggested.label.toLowerCase(), id);
        addNode({
          id,
          label: suggested.label,
          description: suggested.description ?? undefined,
          fromSession: histMatch?.session_name,
        });
      }

      const srcId = nodeIdMap.get(suggested.label.toLowerCase());
      const connectsTo = suggested.connects_to || [];
      const edgeLabels = suggested.edge_labels || [];

      for (let i = 0; i < connectsTo.length; i++) {
        const targetId = nodeIdMap.get(connectsTo[i].toLowerCase());
        if (srcId && targetId) {
          addEdge({
            id: crypto.randomUUID(),
            source: srcId,
            target: targetId,
            label: edgeLabels[i] || undefined,
            aiInferred: true,
            historical: true,
          });
        }
      }
    }

    // Step 3d: Process suggested edges
    for (const edge of (data.suggested_edges || []) as SuggestedEdge[]) {
      const sourceId = nodeIdMap.get(edge.source.toLowerCase());
      const targetId = nodeIdMap.get(edge.target.toLowerCase());
      if (sourceId && targetId) {
        const isHistorical =
          historicalNodes.some(
            (h) => h.label.toLowerCase() === edge.source.toLowerCase()
          ) ||
          historicalNodes.some(
            (h) => h.label.toLowerCase() === edge.target.toLowerCase()
          );
        addEdge({
          id: crypto.randomUUID(),
          source: sourceId,
          target: targetId,
          label: edge.label ?? undefined,
          aiInferred: true,
          historical: isHistorical,
        });
      }
    }
  } catch {
    // LLM call failed — at least memory search may have worked
  }
}
