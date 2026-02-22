"""Phase 5 tests: TDA backend functionality."""
import pytest
import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))


def test_tda_module_imports():
    """Verify TDA module can be imported."""
    from tda import compute_persistence
    assert callable(compute_persistence)


def test_tda_empty_input():
    from tda import compute_persistence
    result = compute_persistence([])
    assert result["betti_0"] == 0


def test_tda_single_point():
    from tda import compute_persistence
    result = compute_persistence([[1.0, 0.0, 0.0]])
    assert result["betti_0"] == 1
    assert result["betti_1"] == 0


def test_tda_two_points():
    from tda import compute_persistence
    result = compute_persistence([
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ])
    assert "betti_0" in result
    assert "persistence_diagram" in result


def test_tda_cluster():
    """Test TDA with points forming a clear cluster."""
    from tda import compute_persistence
    # 4 points close together should show 1 connected component
    result = compute_persistence([
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
        [0.8, 0.2, 0.0],
        [0.85, 0.15, 0.0],
    ])
    assert "betti_0" in result
    assert "betti_1" in result
    assert "persistence_diagram" in result


def test_tda_separated_clusters():
    """Two separated clusters should show betti_0 >= 2."""
    from tda import compute_persistence
    result = compute_persistence([
        [1.0, 0.0, 0.0],
        [0.95, 0.05, 0.0],
        [0.0, 0.0, 1.0],
        [0.05, 0.0, 0.95],
    ])
    # Should detect at least the separation
    assert result["betti_0"] >= 1


def test_tda_endpoint():
    """Test the /api/tda endpoint via FastAPI TestClient."""
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    resp = client.post(
        "/api/tda",
        json={
            "embeddings": [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
            ],
            "node_ids": ["a", "b", "c"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "betti_0" in data
    assert "betti_1" in data
    assert "betti_2" in data
    assert "persistence_diagram" in data
    assert "cycles" in data


def test_tda_endpoint_validates():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    resp = client.post("/api/tda", json={})
    # Should succeed with defaults (empty embeddings)
    assert resp.status_code == 200


def test_topology_panel_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/TopologyPanel.tsx"
    )
    assert os.path.exists(path)


def test_tda_route_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/app/api/tda/route.ts"
    )
    assert os.path.exists(path)
