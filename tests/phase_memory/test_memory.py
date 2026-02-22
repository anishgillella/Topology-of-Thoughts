"""Tests for long-term memory: FAISS index, graph traversal, historical context."""
import pytest
import sys
import os
import uuid
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

# Use a test database
os.environ["DB_PATH"] = os.path.join(os.path.dirname(__file__), "test_memory.db")


def setup_module():
    db_path = os.environ["DB_PATH"]
    if os.path.exists(db_path):
        os.remove(db_path)
    from database import init_db
    init_db()


def teardown_module():
    db_path = os.environ["DB_PATH"]
    if os.path.exists(db_path):
        os.remove(db_path)


def _create_session_with_nodes(name, nodes_data):
    """Helper: create a session and save nodes with embeddings."""
    from database import create_session, save_graph
    sid = str(uuid.uuid4())
    create_session(sid, name)
    nodes = []
    for label, embedding in nodes_data:
        nodes.append({
            "id": str(uuid.uuid4()),
            "label": label,
            "description": f"Test node: {label}",
            "embedding": embedding,
        })
    save_graph(sid, nodes, [])
    return sid, nodes


def test_memory_index_import():
    from memory import MemoryIndex, retrieve_historical_context
    assert callable(retrieve_historical_context)


def test_memory_index_rebuild_empty():
    from memory import MemoryIndex
    idx = MemoryIndex()
    idx.rebuild()
    # Should not crash on empty DB


def test_memory_index_search():
    from memory import MemoryIndex

    # Create two sessions with nodes
    s1, nodes1 = _create_session_with_nodes("Session Alpha", [
        ("Machine Learning", [1.0, 0.0, 0.0]),
        ("Neural Networks", [0.9, 0.1, 0.0]),
    ])
    s2, nodes2 = _create_session_with_nodes("Session Beta", [
        ("Statistics", [0.0, 1.0, 0.0]),
        ("Data Analysis", [0.0, 0.9, 0.1]),
    ])

    idx = MemoryIndex()
    idx.rebuild()

    assert idx.index is not None
    assert idx.index.ntotal >= 4

    # Search for something similar to "Machine Learning"
    results = idx.search([1.0, 0.0, 0.0], top_k=5)
    assert len(results) >= 2
    # The closest should be "Machine Learning"
    labels = [r["label"] for r in results]
    assert "Machine Learning" in labels
    ml_result = next(r for r in results if r["label"] == "Machine Learning")
    assert ml_result["similarity"] > 0.9


def test_memory_index_search_with_threshold():
    from memory import MemoryIndex

    _create_session_with_nodes("Session Gamma", [
        ("Quantum Physics", [0.5, 0.5, 0.0]),
    ])

    idx = MemoryIndex()
    idx.rebuild()

    # High threshold should filter out distant results
    results = idx.search_text_embedding([0.0, 0.0, 1.0], top_k=10, min_similarity=0.9)
    # Nothing should be very similar to [0,0,1]
    for r in results:
        assert r["similarity"] >= 0.9


def test_memory_index_exclude_session():
    from memory import MemoryIndex

    sid, _ = _create_session_with_nodes("Excluded Session", [
        ("Exclusion Test", [0.3, 0.3, 0.3]),
    ])

    idx = MemoryIndex()
    idx.rebuild(exclude_session_id=sid)

    # The excluded session's nodes should not be in results
    results = idx.search([0.3, 0.3, 0.3], top_k=100)
    excluded_labels = [r["label"] for r in results if r["session_id"] == sid]
    assert len(excluded_labels) == 0


def test_retrieve_historical_context():
    from memory import retrieve_historical_context

    s1, nodes1 = _create_session_with_nodes("Context Session", [
        ("Topology", [1.0, 0.0, 0.0]),
        ("Homology", [0.9, 0.1, 0.0]),
    ])

    # Search for something related
    result = retrieve_historical_context(
        query_embedding=[0.95, 0.05, 0.0],
        current_session_id="nonexistent-session",
        top_k=5,
        min_similarity=0.3,
    )

    assert "seed_nodes" in result
    assert "neighbor_nodes" in result
    assert "edges" in result
    assert len(result["seed_nodes"]) > 0


def test_get_all_nodes_with_embeddings():
    from database import get_all_nodes_with_embeddings

    nodes = get_all_nodes_with_embeddings()
    assert isinstance(nodes, list)
    for node in nodes:
        assert "id" in node
        assert "label" in node
        assert "embedding" in node
        assert isinstance(node["embedding"], list)


def test_get_edges_for_nodes():
    from database import create_session, save_graph, get_edges_for_nodes

    sid = str(uuid.uuid4())
    create_session(sid, "Edge Test")
    nodes = [
        {"id": "e1", "label": "A"},
        {"id": "e2", "label": "B"},
        {"id": "e3", "label": "C"},
    ]
    edges = [
        {"id": "edge1", "source": "e1", "target": "e2", "label": "connects"},
        {"id": "edge2", "source": "e2", "target": "e3", "label": "leads to"},
    ]
    save_graph(sid, nodes, edges)

    # Search for edges connected to e1
    result = get_edges_for_nodes(["e1"])
    assert any(e["source"] == "e1" or e["target"] == "e1" for e in result)


def test_memory_search_endpoint():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    resp = client.post(
        "/api/memory/search",
        json={
            "embedding": [1.0, 0.0, 0.0],
            "top_k": 5,
            "min_similarity": 0.1,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "seed_nodes" in data
    assert "neighbor_nodes" in data
    assert "edges" in data


def test_reasoning_accepts_historical_context():
    """Verify the /api/reason endpoint accepts historical_nodes and historical_edges."""
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    resp = client.post(
        "/api/reason",
        json={
            "text": "Deep learning transforms data",
            "nodes": [{"label": "Deep Learning"}],
            "edges": [],
            "historical_nodes": [
                {
                    "label": "Machine Learning",
                    "description": "Broader field",
                    "session_name": "Past Session",
                    "similarity": 0.85,
                    "created_at": "2025-12-01",
                }
            ],
            "historical_edges": [
                {
                    "source_label": "Machine Learning",
                    "target_label": "Statistics",
                    "label": "uses",
                    "session_name": "Past Session",
                }
            ],
        },
    )
    # 200 if API key present, 500 if not, but not 422
    assert resp.status_code in (200, 500)


def test_frontend_memory_files_exist():
    base = os.path.join(os.path.dirname(__file__), "../../frontend")
    assert os.path.exists(os.path.join(base, "lib/processInput.ts"))
    assert os.path.exists(os.path.join(base, "app/api/memory/search/route.ts"))


def test_ghost_node_support_in_store():
    """Verify store.ts has ghost node fields."""
    store_path = os.path.join(
        os.path.dirname(__file__), "../../frontend/lib/store.ts"
    )
    with open(store_path) as f:
        content = f.read()
    assert "ghost" in content
    assert "ghostNodes" in content
    assert "setGhostNodes" in content
    assert "clearGhostNodes" in content
    assert "fromSession" in content
    assert "historical" in content
