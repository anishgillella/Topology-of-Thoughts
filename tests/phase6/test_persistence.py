"""Phase 6 tests: Database persistence and session management."""
import pytest
import sys
import os
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

# Use a test database
os.environ["DB_PATH"] = os.path.join(os.path.dirname(__file__), "test_topology.db")


def setup_module():
    """Clean up test database before tests."""
    db_path = os.environ["DB_PATH"]
    if os.path.exists(db_path):
        os.remove(db_path)


def teardown_module():
    """Clean up test database after tests."""
    db_path = os.environ["DB_PATH"]
    if os.path.exists(db_path):
        os.remove(db_path)


def test_init_db():
    from database import init_db
    init_db()  # Should not raise


def test_create_session():
    from database import create_session
    session_id = str(uuid.uuid4())
    result = create_session(session_id, "Test Session")
    assert result["id"] == session_id
    assert result["name"] == "Test Session"
    assert "createdAt" in result


def test_list_sessions():
    from database import list_sessions, create_session
    session_id = str(uuid.uuid4())
    create_session(session_id, "Listed Session")
    sessions = list_sessions()
    assert any(s["id"] == session_id for s in sessions)


def test_save_and_load_graph():
    from database import create_session, save_graph, load_graph
    session_id = str(uuid.uuid4())
    create_session(session_id, "Graph Session")

    nodes = [
        {"id": "n1", "label": "Concept A", "description": "First concept"},
        {"id": "n2", "label": "Concept B"},
    ]
    edges = [
        {"id": "e1", "source": "n1", "target": "n2", "label": "relates to"},
    ]

    save_graph(session_id, nodes, edges)
    result = load_graph(session_id)

    assert len(result["nodes"]) == 2
    assert len(result["edges"]) == 1
    assert result["nodes"][0]["label"] == "Concept A"
    assert result["edges"][0]["source"] == "n1"


def test_save_graph_with_embeddings():
    from database import create_session, save_graph, load_graph
    session_id = str(uuid.uuid4())
    create_session(session_id, "Embedding Session")

    nodes = [
        {"id": "n1", "label": "A", "embedding": [1.0, 0.0, 0.0]},
    ]
    save_graph(session_id, nodes, [])
    result = load_graph(session_id)

    assert result["nodes"][0]["embedding"] == [1.0, 0.0, 0.0]


def test_save_overwrites_previous():
    from database import create_session, save_graph, load_graph
    session_id = str(uuid.uuid4())
    create_session(session_id, "Overwrite Session")

    save_graph(session_id, [{"id": "n1", "label": "First"}], [])
    save_graph(session_id, [{"id": "n2", "label": "Second"}], [])

    result = load_graph(session_id)
    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["label"] == "Second"


def test_delete_session():
    from database import create_session, delete_session, list_sessions
    session_id = str(uuid.uuid4())
    create_session(session_id, "To Delete")
    delete_session(session_id)
    sessions = list_sessions()
    assert not any(s["id"] == session_id for s in sessions)


def test_session_endpoints():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)

    # Create session
    session_id = str(uuid.uuid4())
    resp = client.post("/api/sessions", json={"id": session_id, "name": "API Test"})
    assert resp.status_code == 200

    # List sessions
    resp = client.get("/api/sessions")
    assert resp.status_code == 200
    assert any(s["id"] == session_id for s in resp.json())

    # Save graph
    resp = client.post(
        f"/api/sessions/{session_id}/graph",
        json={
            "nodes": [{"id": "n1", "label": "Test"}],
            "edges": [],
        },
    )
    assert resp.status_code == 200

    # Load graph
    resp = client.get(f"/api/sessions/{session_id}/graph")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["nodes"]) == 1

    # Delete session
    resp = client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 200


def test_frontend_session_files_exist():
    base = os.path.join(os.path.dirname(__file__), "../../frontend")
    assert os.path.exists(os.path.join(base, "components/SessionSidebar.tsx"))
    assert os.path.exists(os.path.join(base, "lib/useAutoSave.ts"))
    assert os.path.exists(os.path.join(base, "app/api/sessions/route.ts"))
