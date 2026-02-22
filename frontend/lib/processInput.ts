/**
 * Shared input processing pipeline:
 * 1. Extract concepts from text (LLM)
 * 2. Search long-term memory (FAISS) for historical context
 * 3. Run reasoning partner with current + historical context
 * 4. Add all nodes/edges to the graph
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
  const { addNode, addEdge, updateNode, nodes, currentSessionId } =
    useGraphStore.getState();

  const nodeIdMap = new Map<string, string>();

  // Map existing nodes
  for (const n of nodes) {
    nodeIdMap.set(n.label.toLowerCase(), n.id);
  }

  // Step 1: Extract concepts
  try {
    const extractRes = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        existing_nodes: nodes.map((n) => n.label),
      }),
    });

    if (extractRes.ok) {
      const data = await extractRes.json();

      for (const extracted of data.nodes as ExtractedNode[]) {
        if (extracted.existing) {
          // Re-mentioned existing concept — update mention count
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
          // New concept — check for embedding-based duplicates before inserting
          const currentNodes = useGraphStore.getState().nodes;
          let matchedExistingId: string | null = null;

          try {
            const newEmbedding = await getEmbedding(extracted.label);
            const nodesWithEmbeddings = currentNodes.filter((n) => n.embedding);

            for (const existingNode of nodesWithEmbeddings) {
              const sim = cosineSimilarity(newEmbedding, existingNode.embedding!);
              if (sim > 0.85) {
                matchedExistingId = existingNode.id;
                // Update mention count on the matched node
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
            // Embedding dedup matched — reuse existing node
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

      for (const edge of data.edges as ExtractedEdge[]) {
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
    }
  } catch {
    // Extraction failed, continue with what we have
  }

  // Step 2: Search long-term memory
  let historicalNodes: MemoryNode[] = [];
  let historicalEdges: MemoryEdge[] = [];

  try {
    // Get embedding for the input text
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

  // Step 3: Run reasoning with historical context
  const updatedNodes = useGraphStore.getState().nodes;
  const updatedEdges = useGraphStore.getState().edges;

  try {
    // Build historical context for the reasoning partner
    const historicalNodeInfos = historicalNodes.map((n) => ({
      label: n.label,
      description: n.description || null,
      session_name: n.session_name || null,
      similarity: n.similarity || null,
      created_at: n.created_at || null,
      last_mentioned_at: n.last_mentioned_at || null,
      mention_count: n.mention_count || 1,
    }));

    // Resolve historical edge labels
    const historicalEdgeInfos = historicalEdges.map((e) => {
      const srcNode = historicalNodes.find((n) => n.id === e.source);
      const tgtNode = historicalNodes.find((n) => n.id === e.target);
      return {
        source_label: srcNode?.label || e.source,
        target_label: tgtNode?.label || e.target,
        label: e.label || "relates to",
        session_name: srcNode?.session_name || null,
      };
    });

    const reasonRes = await fetch("/api/reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        nodes: updatedNodes.map((n) => ({
          label: n.label,
          description: n.description || null,
        })),
        edges: updatedEdges.map((e) => {
          const src = updatedNodes.find((n) => n.id === e.source);
          const tgt = updatedNodes.find((n) => n.id === e.target);
          return {
            source_label: src?.label || "",
            target_label: tgt?.label || "",
            label: e.label || "relates to",
          };
        }),
        historical_nodes: historicalNodeInfos,
        historical_edges: historicalEdgeInfos,
      }),
    });

    if (reasonRes.ok) {
      const reasonData = await reasonRes.json();

      // Add AI-suggested nodes (may include historical concepts pulled in)
      for (const suggested of (reasonData.suggested_nodes ||
        []) as SuggestedNode[]) {
        if (!nodeIdMap.has(suggested.label.toLowerCase())) {
          // Check if this is a historical node being pulled into current session
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
        for (const targetLabel of suggested.connects_to) {
          const targetId = nodeIdMap.get(targetLabel.toLowerCase());
          if (srcId && targetId) {
            addEdge({
              id: crypto.randomUUID(),
              source: srcId,
              target: targetId,
              label: "connects to",
              aiInferred: true,
              historical: true,
            });
          }
        }
      }

      // Add AI-suggested edges (including cross-temporal)
      for (const edge of (reasonData.suggested_edges ||
        []) as SuggestedEdge[]) {
        const sourceId = nodeIdMap.get(edge.source.toLowerCase());
        const targetId = nodeIdMap.get(edge.target.toLowerCase());
        if (sourceId && targetId) {
          // Check if this connects to a historical concept
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
    }
  } catch {
    // Reasoning failed, that's ok
  }
}
