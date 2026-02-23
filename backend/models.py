from pydantic import BaseModel


class Node(BaseModel):
    id: str
    label: str
    description: str | None = None


class Edge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None = None


class GraphData(BaseModel):
    nodes: list[Node] = []
    edges: list[Edge] = []


# --- Unified Processing (extract + reason in one call) ---

class NodeInfo(BaseModel):
    label: str
    description: str | None = None


class EdgeInfo(BaseModel):
    source_label: str
    target_label: str
    label: str | None = None


class HistoricalNode(BaseModel):
    label: str
    description: str | None = None
    session_name: str | None = None
    similarity: float | None = None
    created_at: str | None = None
    last_mentioned_at: str | None = None
    mention_count: int = 1


class HistoricalEdge(BaseModel):
    source_label: str
    target_label: str
    label: str | None = None
    session_name: str | None = None


class ProcessRequest(BaseModel):
    text: str
    existing_nodes: list[str] = []
    current_nodes: list[NodeInfo] = []
    current_edges: list[EdgeInfo] = []
    historical_nodes: list[HistoricalNode] = []
    historical_edges: list[HistoricalEdge] = []


class ExtractedNode(BaseModel):
    label: str
    description: str | None = None
    existing: bool = False


class ExtractedEdge(BaseModel):
    source: str
    target: str
    label: str | None = None


class SuggestedEdge(BaseModel):
    source: str
    target: str
    label: str | None = None
    reason: str | None = None


class SuggestedNode(BaseModel):
    label: str
    description: str | None = None
    connects_to: list[str] = []
    edge_labels: list[str] = []


class ProcessResponse(BaseModel):
    extracted_nodes: list[ExtractedNode] = []
    extracted_edges: list[ExtractedEdge] = []
    suggested_edges: list[SuggestedEdge] = []
    suggested_nodes: list[SuggestedNode] = []
    insights: list[str] = []


# --- TDA ---

class PersistencePoint(BaseModel):
    dimension: int
    birth: float
    death: float


class Cycle(BaseModel):
    dimension: int
    nodes: list[str] = []


class TDARequest(BaseModel):
    embeddings: list[list[float]] = []
    node_ids: list[str] = []


class TDAResponse(BaseModel):
    betti_0: int = 0
    betti_1: int = 0
    betti_2: int = 0
    persistence_diagram: list[PersistencePoint] = []
    cycles: list[Cycle] = []


# --- Memory ---

class MemorySearchRequest(BaseModel):
    embedding: list[float]
    current_session_id: str | None = None
    top_k: int = 10
    min_similarity: float = 0.3
    hop_depth: int = 2


class MemoryNode(BaseModel):
    id: str
    session_id: str
    label: str
    description: str | None = None
    similarity: float | None = None
    session_name: str | None = None
    created_at: str | None = None
    last_mentioned_at: str | None = None
    mention_count: int = 1


class MemoryEdge(BaseModel):
    id: str
    session_id: str
    source: str
    target: str
    label: str | None = None
    ai_inferred: bool = False


class MemorySearchResponse(BaseModel):
    seed_nodes: list[MemoryNode] = []
    neighbor_nodes: list[MemoryNode] = []
    edges: list[MemoryEdge] = []
