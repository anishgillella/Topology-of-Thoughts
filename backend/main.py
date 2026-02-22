import json

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    ExtractionRequest, ExtractionResponse, ExtractedNode, ExtractedEdge,
    ReasoningRequest, ReasoningResponse, SuggestedEdge, SuggestedNode,
    TDARequest, TDAResponse, PersistencePoint, Cycle,
    MemorySearchRequest, MemorySearchResponse, MemoryNode, MemoryEdge,
)
from llm import extract_concepts, reason_about_graph
from tda import compute_persistence
from database import (
    create_session, list_sessions, delete_session,
    save_graph, load_graph,
)
from memory import retrieve_historical_context

app = FastAPI(title="Topology of Thoughts API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/extract", response_model=ExtractionResponse)
async def extract(request: ExtractionRequest):
    try:
        result = await extract_concepts(request.text, request.existing_nodes)
        nodes = [
            ExtractedNode(
                label=n.get("label", ""),
                description=n.get("description"),
                existing=n.get("existing", False),
            )
            for n in result.get("nodes", [])
        ]
        edges = [
            ExtractedEdge(
                source=e.get("source", ""),
                target=e.get("target", ""),
                label=e.get("label"),
            )
            for e in result.get("edges", [])
        ]
        return ExtractionResponse(nodes=nodes, edges=edges)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reason", response_model=ReasoningResponse)
async def reason(request: ReasoningRequest):
    try:
        nodes_dicts = [n.model_dump() for n in request.nodes]
        edges_dicts = [e.model_dump() for e in request.edges]
        historical_nodes_dicts = [n.model_dump() for n in request.historical_nodes]
        historical_edges_dicts = [e.model_dump() for e in request.historical_edges]
        result = await reason_about_graph(
            request.text, nodes_dicts, edges_dicts,
            historical_nodes_dicts, historical_edges_dicts,
        )
        suggested_edges = [
            SuggestedEdge(
                source=e.get("source", ""),
                target=e.get("target", ""),
                label=e.get("label"),
                reason=e.get("reason"),
            )
            for e in result.get("suggested_edges", [])
        ]
        suggested_nodes = [
            SuggestedNode(
                label=n.get("label", ""),
                description=n.get("description"),
                connects_to=n.get("connects_to", []),
            )
            for n in result.get("suggested_nodes", [])
        ]
        insights = result.get("insights", [])
        return ReasoningResponse(
            suggested_edges=suggested_edges,
            suggested_nodes=suggested_nodes,
            insights=insights,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/memory/search", response_model=MemorySearchResponse)
async def memory_search(request: MemorySearchRequest):
    try:
        result = retrieve_historical_context(
            query_embedding=request.embedding,
            current_session_id=request.current_session_id,
            top_k=request.top_k,
            min_similarity=request.min_similarity,
            hop_depth=request.hop_depth,
        )
        return MemorySearchResponse(
            seed_nodes=[
                MemoryNode(
                    id=n.get("id", ""),
                    session_id=n.get("session_id", ""),
                    label=n.get("label", ""),
                    description=n.get("description"),
                    similarity=n.get("similarity"),
                    session_name=n.get("sessionName"),
                    created_at=n.get("createdAt"),
                    last_mentioned_at=n.get("lastMentionedAt"),
                    mention_count=n.get("mentionCount", 1),
                )
                for n in result.get("seed_nodes", [])
            ],
            neighbor_nodes=[
                MemoryNode(
                    id=n.get("id", ""),
                    session_id=n.get("session_id", ""),
                    label=n.get("label", ""),
                    description=n.get("description"),
                    session_name=n.get("sessionName"),
                    created_at=n.get("createdAt"),
                    last_mentioned_at=n.get("lastMentionedAt"),
                    mention_count=n.get("mentionCount", 1),
                )
                for n in result.get("neighbor_nodes", [])
            ],
            edges=[
                MemoryEdge(
                    id=e.get("id", ""),
                    session_id=e.get("session_id", ""),
                    source=e.get("source", ""),
                    target=e.get("target", ""),
                    label=e.get("label"),
                    ai_inferred=e.get("aiInferred", False),
                )
                for e in result.get("edges", [])
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tda", response_model=TDAResponse)
async def tda_analyze(request: TDARequest):
    try:
        result = compute_persistence(request.embeddings)
        return TDAResponse(
            betti_0=result.get("betti_0", 0),
            betti_1=result.get("betti_1", 0),
            betti_2=result.get("betti_2", 0),
            persistence_diagram=[
                PersistencePoint(**p) for p in result.get("persistence_diagram", [])
            ],
            cycles=[
                Cycle(
                    dimension=c.get("dimension", 0),
                    nodes=[
                        request.node_ids[int(idx)]
                        for idx in c.get("nodes", [])
                        if int(idx) < len(request.node_ids)
                    ],
                )
                for c in result.get("cycles", [])
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Session endpoints ---

@app.get("/api/sessions")
async def get_sessions():
    return list_sessions()


@app.post("/api/sessions")
async def new_session(body: dict):
    session_id = body.get("id", "")
    name = body.get("name", "Untitled")
    if not session_id:
        raise HTTPException(status_code=400, detail="id is required")
    return create_session(session_id, name)


@app.delete("/api/sessions/{session_id}")
async def remove_session(session_id: str):
    delete_session(session_id)
    return {"status": "deleted"}


@app.get("/api/sessions/{session_id}/graph")
async def get_graph(session_id: str):
    return load_graph(session_id)


@app.post("/api/sessions/{session_id}/graph")
async def set_graph(session_id: str, body: dict):
    nodes = body.get("nodes", [])
    edges = body.get("edges", [])
    save_graph(session_id, nodes, edges)
    return {"status": "saved"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time TDA updates."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "tda":
                embeddings = msg.get("embeddings", [])
                node_ids = msg.get("node_ids", [])
                result = compute_persistence(embeddings)

                cycles = []
                for c in result.get("cycles", []):
                    cycle_node_ids = [
                        node_ids[int(idx)]
                        for idx in c.get("nodes", [])
                        if int(idx) < len(node_ids)
                    ]
                    cycles.append({
                        "dimension": c.get("dimension", 0),
                        "nodes": cycle_node_ids,
                    })

                await websocket.send_text(json.dumps({
                    "type": "tda_result",
                    "betti_0": result.get("betti_0", 0),
                    "betti_1": result.get("betti_1", 0),
                    "betti_2": result.get("betti_2", 0),
                    "persistence_diagram": result.get("persistence_diagram", []),
                    "cycles": cycles,
                }))
            else:
                await websocket.send_text(json.dumps({"type": "echo", "data": data}))
    except Exception:
        pass
