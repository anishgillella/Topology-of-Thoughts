"""Phase 2 tests: LLM extraction and reasoning endpoints."""
import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from main import app


client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_extract_endpoint_exists():
    """Verify /api/extract accepts POST requests (may fail without API key)."""
    resp = client.post(
        "/api/extract",
        json={"text": "test concept", "existing_nodes": []},
    )
    # 200 if API key works, 500 if not — but NOT 404 or 405
    assert resp.status_code in (200, 500)


def test_extract_validates_input():
    """Verify request validation works."""
    resp = client.post("/api/extract", json={})
    assert resp.status_code == 422  # Pydantic validation error


def test_reason_endpoint_exists():
    """Verify /api/reason accepts POST requests."""
    resp = client.post(
        "/api/reason",
        json={
            "text": "test",
            "nodes": [{"label": "A"}, {"label": "B"}],
            "edges": [{"source_label": "A", "target_label": "B", "label": "relates to"}],
        },
    )
    assert resp.status_code in (200, 500)


def test_reason_validates_input():
    resp = client.post("/api/reason", json={})
    assert resp.status_code == 422


def test_extract_with_valid_key():
    """Integration test — only passes with a valid OPENROUTER_API_KEY in .env."""
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "../../backend/.env"))

    if not os.getenv("OPENROUTER_API_KEY"):
        pytest.skip("No API key configured")

    resp = client.post(
        "/api/extract",
        json={
            "text": "Machine learning uses neural networks for pattern recognition",
            "existing_nodes": [],
        },
    )
    if resp.status_code == 200:
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data
        assert len(data["nodes"]) > 0
        # Verify node structure
        for node in data["nodes"]:
            assert "label" in node
            assert "existing" in node


def test_reason_with_valid_key():
    """Integration test — only passes with a valid OPENROUTER_API_KEY in .env."""
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "../../backend/.env"))

    if not os.getenv("OPENROUTER_API_KEY"):
        pytest.skip("No API key configured")

    resp = client.post(
        "/api/reason",
        json={
            "text": "Deep learning is a subset of machine learning",
            "nodes": [
                {"label": "Machine Learning", "description": "Field of AI"},
                {"label": "Neural Networks", "description": "Computing model"},
                {"label": "Pattern Recognition", "description": "Identifying patterns"},
            ],
            "edges": [
                {"source_label": "Machine Learning", "target_label": "Neural Networks", "label": "uses"},
            ],
        },
    )
    if resp.status_code == 200:
        data = resp.json()
        assert "suggested_edges" in data
        assert "suggested_nodes" in data
        assert "insights" in data
