from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    ProcessRequest, ProcessResponse, ExtractedNode, ExtractedEdge,
    SuggestedEdge, SuggestedNode,
    TDARequest, TDAResponse, PersistencePoint, Cycle,
    MemorySearchRequest, MemorySearchResponse, MemoryNode, MemoryEdge,
)
from llm import process_input
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


@app.post("/api/process", response_model=ProcessResponse)
async def process(request: ProcessRequest):
    """Single endpoint: extracts concepts AND reasons about connections in one LLM call."""
    try:
        current_nodes_dicts = [n.model_dump() for n in request.current_nodes]
        current_edges_dicts = [e.model_dump() for e in request.current_edges]
        historical_nodes_dicts = [n.model_dump() for n in request.historical_nodes]
        historical_edges_dicts = [e.model_dump() for e in request.historical_edges]

        result = await process_input(
            text=request.text,
            existing_nodes=request.existing_nodes,
            current_nodes=current_nodes_dicts,
            current_edges=current_edges_dicts,
            historical_nodes=historical_nodes_dicts,
            historical_edges=historical_edges_dicts,
        )

        return ProcessResponse(
            extracted_nodes=[
                ExtractedNode(
                    label=n.get("label", ""),
                    description=n.get("description"),
                    existing=n.get("existing", False),
                )
                for n in result.get("extracted_nodes", [])
            ],
            extracted_edges=[
                ExtractedEdge(
                    source=e.get("source", ""),
                    target=e.get("target", ""),
                    label=e.get("label"),
                )
                for e in result.get("extracted_edges", [])
            ],
            suggested_edges=[
                SuggestedEdge(
                    source=e.get("source", ""),
                    target=e.get("target", ""),
                    label=e.get("label"),
                    reason=e.get("reason"),
                )
                for e in result.get("suggested_edges", [])
            ],
            suggested_nodes=[
                SuggestedNode(
                    label=n.get("label", ""),
                    description=n.get("description"),
                    connects_to=n.get("connects_to", []),
                    edge_labels=n.get("edge_labels", []),
                )
                for n in result.get("suggested_nodes", [])
            ],
            insights=result.get("insights", []),
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
    transcript = body.get("transcript")
    save_graph(session_id, nodes, edges, transcript=transcript)
    return {"status": "saved"}
