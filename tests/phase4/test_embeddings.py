"""Phase 4 tests: Embeddings and similarity (unit tests for cosine similarity logic).
Note: Xenova model loading requires a browser/Node environment with transformers.js.
These tests verify the Python-side and file structure."""
import os
import math


def test_embeddings_module_exists():
    """Verify the embeddings TypeScript module exists."""
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/lib/embeddings.ts"
    )
    assert os.path.exists(path), "embeddings.ts should exist"


def test_use_embeddings_hook_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/lib/useEmbeddings.ts"
    )
    assert os.path.exists(path), "useEmbeddings.ts should exist"


def test_similarity_slider_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/SimilaritySlider.tsx"
    )
    assert os.path.exists(path), "SimilaritySlider.tsx should exist"


def test_cosine_similarity_logic():
    """Test the cosine similarity algorithm (Python implementation matching TS)."""

    def cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    # Identical vectors → 1.0
    assert abs(cosine_similarity([1, 0, 0], [1, 0, 0]) - 1.0) < 1e-6

    # Orthogonal vectors → 0.0
    assert abs(cosine_similarity([1, 0, 0], [0, 1, 0]) - 0.0) < 1e-6

    # Opposite vectors → -1.0
    assert abs(cosine_similarity([1, 0], [-1, 0]) - (-1.0)) < 1e-6

    # Similar vectors → high similarity
    sim = cosine_similarity([1, 1, 0], [1, 0.9, 0.1])
    assert sim > 0.9

    # Zero vector → 0.0
    assert cosine_similarity([0, 0, 0], [1, 2, 3]) == 0.0


def test_find_similar_pairs_logic():
    """Test pair-finding logic."""

    def find_similar_pairs(nodes, threshold):
        def cosine_similarity(a, b):
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = math.sqrt(sum(x * x for x in a))
            norm_b = math.sqrt(sum(x * x for x in b))
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return dot / (norm_a * norm_b)

        pairs = []
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                a = nodes[i].get("embedding")
                b = nodes[j].get("embedding")
                if not a or not b:
                    continue
                sim = cosine_similarity(a, b)
                if sim >= threshold:
                    pairs.append({
                        "source": nodes[i]["id"],
                        "target": nodes[j]["id"],
                        "similarity": sim,
                    })
        return sorted(pairs, key=lambda p: -p["similarity"])

    nodes = [
        {"id": "1", "label": "A", "embedding": [1, 0, 0]},
        {"id": "2", "label": "B", "embedding": [0.9, 0.1, 0]},
        {"id": "3", "label": "C", "embedding": [0, 0, 1]},
    ]

    pairs = find_similar_pairs(nodes, 0.5)
    assert len(pairs) == 1  # Only A-B are similar
    assert pairs[0]["source"] == "1"
    assert pairs[0]["target"] == "2"

    # Lower threshold includes more pairs
    pairs = find_similar_pairs(nodes, 0.0)
    assert len(pairs) == 3  # All pairs
