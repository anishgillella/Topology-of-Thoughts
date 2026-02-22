"""Long-term memory via FAISS vector search + graph neighborhood expansion.

Flow:
1. Index all historical node embeddings in FAISS
2. On new input, embed it and find top-K similar historical nodes
3. Expand 1-2 hops from those nodes to get their neighborhood
4. Return the historical subgraph as context for reasoning
"""
import numpy as np
import faiss
from database import get_all_nodes_with_embeddings, get_edges_for_nodes


class MemoryIndex:
    """FAISS-backed vector index over all historical node embeddings."""

    def __init__(self):
        self.index: faiss.IndexFlatIP | None = None
        self.nodes: list[dict] = []
        self.dimension: int = 0

    def rebuild(self, exclude_session_id: str | None = None):
        """Rebuild the FAISS index from all stored nodes."""
        self.nodes = get_all_nodes_with_embeddings(exclude_session_id)

        if not self.nodes:
            self.index = None
            return

        embeddings = np.array(
            [n["embedding"] for n in self.nodes], dtype=np.float32
        )

        # Normalize for cosine similarity (inner product on normalized vectors = cosine sim)
        faiss.normalize_L2(embeddings)

        self.dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(embeddings)

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
    ) -> list[dict]:
        """Find the top-K most similar historical nodes to the query."""
        if self.index is None or self.index.ntotal == 0:
            return []

        query = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(query)

        k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(query, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            node = self.nodes[idx].copy()
            node["similarity"] = float(score)
            # Don't send the full embedding back to reduce payload
            node.pop("embedding", None)
            results.append(node)

        return results

    def search_text_embedding(
        self,
        embedding: list[float],
        top_k: int = 10,
        min_similarity: float = 0.3,
    ) -> list[dict]:
        """Search with a minimum similarity threshold."""
        results = self.search(embedding, top_k)
        return [r for r in results if r["similarity"] >= min_similarity]


# Singleton index
_memory_index = MemoryIndex()


def get_memory_index() -> MemoryIndex:
    return _memory_index


def retrieve_historical_context(
    query_embedding: list[float],
    current_session_id: str | None = None,
    top_k: int = 10,
    min_similarity: float = 0.3,
    hop_depth: int = 2,
) -> dict:
    """Main entry point: retrieve relevant historical context.

    Returns:
        {
            "seed_nodes": [...],  # Directly similar nodes
            "neighbor_nodes": [...],  # Nodes connected to seeds (1-2 hops)
            "edges": [...],  # Edges in the historical subgraph
        }
    """
    index = get_memory_index()

    # Rebuild index (fast for <100K nodes)
    index.rebuild(exclude_session_id=current_session_id)

    # Find seed nodes
    seed_nodes = index.search_text_embedding(
        query_embedding, top_k=top_k, min_similarity=min_similarity
    )

    if not seed_nodes:
        return {"seed_nodes": [], "neighbor_nodes": [], "edges": []}

    # Collect seed node IDs
    seed_ids = [n["id"] for n in seed_nodes]
    all_node_ids = set(seed_ids)

    # Graph neighborhood expansion (1-2 hops)
    frontier = set(seed_ids)
    visited_edges = []

    for _ in range(hop_depth):
        if not frontier:
            break

        edges = get_edges_for_nodes(list(frontier))
        new_frontier = set()

        for edge in edges:
            edge_key = (edge["source"], edge["target"])
            if edge_key not in {(e["source"], e["target"]) for e in visited_edges}:
                visited_edges.append(edge)
                # Add nodes we haven't seen
                if edge["source"] not in all_node_ids:
                    new_frontier.add(edge["source"])
                    all_node_ids.add(edge["source"])
                if edge["target"] not in all_node_ids:
                    new_frontier.add(edge["target"])
                    all_node_ids.add(edge["target"])

        frontier = new_frontier

    # Get details for neighbor nodes (non-seed nodes we discovered)
    neighbor_ids = all_node_ids - set(seed_ids)
    neighbor_nodes = []
    if neighbor_ids:
        # Look up neighbor nodes from the DB
        all_stored = get_all_nodes_with_embeddings()
        for node in all_stored:
            if node["id"] in neighbor_ids:
                node.pop("embedding", None)
                neighbor_nodes.append(node)

    return {
        "seed_nodes": seed_nodes,
        "neighbor_nodes": neighbor_nodes,
        "edges": visited_edges,
    }
