"""SQLite database for persisting sessions, nodes, and edges."""
import sqlite3
import json
import os
from datetime import datetime, timezone
from contextlib import contextmanager

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "topology.db"))


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT NOT NULL,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                label TEXT NOT NULL,
                description TEXT,
                embedding TEXT,
                x REAL,
                y REAL,
                z REAL,
                created_at TEXT,
                last_mentioned_at TEXT,
                mention_count INTEGER DEFAULT 1,
                PRIMARY KEY (id, session_id)
            );

            CREATE TABLE IF NOT EXISTS edges (
                id TEXT NOT NULL,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                label TEXT,
                ai_inferred INTEGER DEFAULT 0,
                weight REAL,
                created_at TEXT,
                PRIMARY KEY (id, session_id)
            );

            CREATE TABLE IF NOT EXISTS tda_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                betti_0 INTEGER,
                betti_1 INTEGER,
                betti_2 INTEGER,
                persistence_diagram TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id);
            CREATE INDEX IF NOT EXISTS idx_edges_session ON edges(session_id);
            CREATE INDEX IF NOT EXISTS idx_tda_session ON tda_snapshots(session_id);
            CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
        """)
        # Migration: add transcript column if missing
        try:
            conn.execute("ALTER TABLE sessions ADD COLUMN transcript TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # Column already exists


def create_session(session_id: str, name: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (session_id, name, now, now),
        )
    return {"id": session_id, "name": name, "createdAt": now, "updatedAt": now}


def list_sessions() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, created_at, updated_at FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"],
        }
        for r in rows
    ]


def delete_session(session_id: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))


def save_graph(session_id: str, nodes: list[dict], edges: list[dict], transcript: str | None = None):
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute("DELETE FROM nodes WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM edges WHERE session_id = ?", (session_id,))

        for node in nodes:
            embedding_json = json.dumps(node.get("embedding")) if node.get("embedding") else None
            conn.execute(
                """INSERT INTO nodes
                   (id, session_id, label, description, embedding, x, y, z, created_at, last_mentioned_at, mention_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    node["id"],
                    session_id,
                    node["label"],
                    node.get("description"),
                    embedding_json,
                    node.get("x"),
                    node.get("y"),
                    node.get("z"),
                    node.get("createdAt", now),
                    node.get("lastMentionedAt", now),
                    node.get("mentionCount", 1),
                ),
            )

        for edge in edges:
            conn.execute(
                """INSERT INTO edges
                   (id, session_id, source, target, label, ai_inferred, weight, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    edge["id"],
                    session_id,
                    edge["source"],
                    edge["target"],
                    edge.get("label"),
                    1 if edge.get("aiInferred") else 0,
                    edge.get("weight"),
                    edge.get("createdAt", now),
                ),
            )

        if transcript is not None:
            conn.execute(
                "UPDATE sessions SET updated_at = ?, transcript = ? WHERE id = ?",
                (now, transcript, session_id),
            )
        else:
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?", (now, session_id)
            )


def load_graph(session_id: str) -> dict:
    with get_connection() as conn:
        node_rows = conn.execute(
            "SELECT * FROM nodes WHERE session_id = ?", (session_id,)
        ).fetchall()
        edge_rows = conn.execute(
            "SELECT * FROM edges WHERE session_id = ?", (session_id,)
        ).fetchall()
        session_row = conn.execute(
            "SELECT transcript FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    nodes = []
    for r in node_rows:
        node = {
            "id": r["id"],
            "label": r["label"],
            "description": r["description"],
            "createdAt": r["created_at"],
            "lastMentionedAt": r["last_mentioned_at"],
            "mentionCount": r["mention_count"],
        }
        if r["embedding"]:
            node["embedding"] = json.loads(r["embedding"])
        if r["x"] is not None:
            node["x"] = r["x"]
            node["y"] = r["y"]
            node["z"] = r["z"]
        nodes.append(node)

    edges = [
        {
            "id": r["id"],
            "source": r["source"],
            "target": r["target"],
            "label": r["label"],
            "aiInferred": bool(r["ai_inferred"]),
            "weight": r["weight"],
            "createdAt": r["created_at"],
        }
        for r in edge_rows
    ]

    transcript = (session_row["transcript"] or "") if session_row else ""

    return {"nodes": nodes, "edges": edges, "transcript": transcript}


def get_all_nodes_with_embeddings(exclude_session_id: str | None = None) -> list[dict]:
    """Get all nodes across all sessions that have embeddings.
    Optionally exclude a session to avoid duplicating current context."""
    with get_connection() as conn:
        if exclude_session_id:
            rows = conn.execute(
                """SELECT n.id, n.session_id, n.label, n.description, n.embedding,
                          n.created_at, n.last_mentioned_at, n.mention_count,
                          s.name as session_name
                   FROM nodes n JOIN sessions s ON n.session_id = s.id
                   WHERE n.embedding IS NOT NULL AND n.session_id != ?
                   ORDER BY n.last_mentioned_at DESC""",
                (exclude_session_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT n.id, n.session_id, n.label, n.description, n.embedding,
                          n.created_at, n.last_mentioned_at, n.mention_count,
                          s.name as session_name
                   FROM nodes n JOIN sessions s ON n.session_id = s.id
                   WHERE n.embedding IS NOT NULL
                   ORDER BY n.last_mentioned_at DESC"""
            ).fetchall()

    return [
        {
            "id": r["id"],
            "session_id": r["session_id"],
            "label": r["label"],
            "description": r["description"],
            "embedding": json.loads(r["embedding"]),
            "createdAt": r["created_at"],
            "lastMentionedAt": r["last_mentioned_at"],
            "mentionCount": r["mention_count"],
            "sessionName": r["session_name"],
        }
        for r in rows
    ]


def get_edges_for_nodes(node_ids: list[str], session_id: str | None = None) -> list[dict]:
    """Get all edges that connect any of the given node IDs.
    If session_id is provided, only from that session."""
    if not node_ids:
        return []

    placeholders = ",".join("?" * len(node_ids))
    with get_connection() as conn:
        if session_id:
            rows = conn.execute(
                f"""SELECT * FROM edges
                    WHERE session_id = ? AND (source IN ({placeholders}) OR target IN ({placeholders}))""",
                [session_id] + node_ids + node_ids,
            ).fetchall()
        else:
            rows = conn.execute(
                f"""SELECT * FROM edges
                    WHERE source IN ({placeholders}) OR target IN ({placeholders})""",
                node_ids + node_ids,
            ).fetchall()

    return [
        {
            "id": r["id"],
            "session_id": r["session_id"],
            "source": r["source"],
            "target": r["target"],
            "label": r["label"],
            "aiInferred": bool(r["ai_inferred"]),
        }
        for r in rows
    ]


# Initialize on import
init_db()
