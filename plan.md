# Topology of Thoughts — Implementation Plan

## Context

Build a real-time web application where a user speaks (or types) their thoughts, and an AI extracts concepts, infers relationships, and visualizes the evolving structure as a 3D interactive graph. Beyond simple mind-mapping, the system applies **topological data analysis (TDA)** to reveal deeper structural patterns — holes, clusters, and persistent features in the "shape" of the user's thinking. The AI acts as a full reasoning partner, suggesting implicit connections and identifying contradictions or gaps.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Browser (Next.js)                              │
│  ┌──────────┐ ┌───────────┐ ┌────────────────┐ │
│  │ Deepgram │ │ 3D Graph  │ │ TDA Overlay    │ │
│  │ Voice In │ │ (3d-force)│ │ (persistence   │ │
│  └────┬─────┘ └─────▲─────┘ │  diagrams etc) │ │
│       │              │       └───────▲────────┘ │
│       ▼              │               │          │
│  ┌─────────────────────────────────────────┐    │
│  │  State Manager (Zustand)                │    │
│  │  nodes[], edges[], tda{}, session{}     │    │
│  └──────┬──────────────────────────────────┘    │
│         │                                       │
│  ┌──────▼──────┐  ┌───────────────┐             │
│  │ OpenRouter  │  │ Xenova        │             │
│  │ LLM Client │  │ Embeddings    │             │
│  └──────┬──────┘  └───────────────┘             │
└─────────┼───────────────────────────────────────┘
          │ (Next.js API routes proxy)
          ▼
┌─────────────────────────────────────────────────┐
│  Python Backend (FastAPI)                       │
│  ├─ /api/tda — persistent homology (ripser.py)  │
│  ├─ /api/analyze — concept extraction fallback  │
│  └─ WebSocket — real-time TDA updates           │
│  Storage: SQLite (sessions, nodes, edges)       │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Frontend | **Next.js 14 (App Router)** | API routes double as backend proxy, SSR optional, great DX |
| 3D Visualization | **3d-force-graph** + **Three.js** | Purpose-built for dynamic graphs, handles real-time node/edge addition |
| State Management | **Zustand** | Lightweight, works well with frequent graph updates |
| Speech-to-Text | **Deepgram SDK** | Real-time streaming, sub-200ms latency, 90%+ accuracy |
| LLM | **OpenRouter** | Multi-model flexibility (GPT-4, Claude, DeepSeek, etc.) |
| Embeddings | **Xenova/all-MiniLM-L6-v2** (in-browser) | Free, private, ~50ms per concept, no API calls |
| TDA Backend | **FastAPI + ripser.py + giotto-tda** | Only viable option for persistent homology computation |
| Persistence | **SQLite** (backend) + **IndexedDB** (frontend cache via Dexie.js) | Full persistence across sessions |
| Styling | **Tailwind CSS** | Fast UI development |

---

## Project Structure

```
topology-of-thoughts/
├── frontend/                    # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Main app page
│   │   └── api/                 # API route proxies
│   │       ├── openrouter/route.ts
│   │       └── tda/route.ts
│   ├── components/
│   │   ├── Graph3D.tsx          # 3d-force-graph wrapper
│   │   ├── VoiceInput.tsx       # Deepgram mic input
│   │   ├── TextInput.tsx        # Fallback text input
│   │   ├── TopologyPanel.tsx    # TDA results display
│   │   ├── SessionSidebar.tsx   # Past sessions list
│   │   └── ConceptDetail.tsx    # Node detail panel on click
│   ├── lib/
│   │   ├── store.ts             # Zustand store (graph state)
│   │   ├── openrouter.ts        # LLM client (streaming)
│   │   ├── embeddings.ts        # Xenova embeddings wrapper
│   │   ├── deepgram.ts          # Deepgram client
│   │   └── db.ts                # Dexie.js IndexedDB setup
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── backend/                     # Python FastAPI
│   ├── main.py                  # FastAPI app + WebSocket
│   ├── tda.py                   # Persistent homology computations
│   ├── models.py                # Pydantic models
│   ├── database.py              # SQLite persistence
│   ├── requirements.txt
│   └── .env.example
│
├── .env.example                 # API keys template
├── .gitignore
├── README.md
└── plan.md
```

---

## Implementation Phases

### Phase 1: Foundation & 3D Graph

**Goal:** Scaffold everything, get a 3D graph rendering with manual input.

1. Initialize Next.js app in `frontend/` with TypeScript + Tailwind
2. Initialize FastAPI app in `backend/` with basic health endpoint
3. Set up `3d-force-graph` in `Graph3D.tsx` — render a hardcoded sample graph in 3D
4. Set up Zustand store with `nodes[]`, `edges[]`, `addNode()`, `addEdge()`
5. Add a simple text input that creates a node when you press Enter
6. Wire text input → store → graph (nodes appear in real-time)

**Verify:** Type a concept, see it appear as a 3D node.

### Phase 2: LLM Integration

**Goal:** AI extracts concepts and relationships from natural language.

1. Set up OpenRouter client in `lib/openrouter.ts` with streaming
2. Create Next.js API route `/api/openrouter` to proxy requests (hides API key)
3. Design the **concept extraction prompt**: given raw text, extract concepts + relationships as structured JSON
4. Design the **reasoning partner prompt**: given existing graph context + new text, infer implicit connections, contradictions, and suggest new edges
5. Wire: user input → LLM → parse response → add nodes/edges to store → graph updates
6. Add visual distinction for AI-inferred edges (dashed lines, different color)

**Verify:** Type "machine learning is related to statistics", see both nodes + edge. AI may suggest "linear algebra" as implicit connection.

### Phase 3: Voice Input

**Goal:** Deepgram real-time streaming speech-to-text.

1. Set up Deepgram SDK in `lib/deepgram.ts` — browser microphone → WebSocket → transcription
2. Build `VoiceInput.tsx` with mic toggle button and live transcript display
3. Wire transcription stream → buffer sentences → send to LLM for concept extraction
4. Add visual indicator showing when the system is listening/processing
5. Handle interim vs final transcription results (only extract concepts from final results)

**Verify:** Click mic, speak naturally, see concepts extracted and graph updating in real-time.

### Phase 4: Embeddings & Semantic Similarity

**Goal:** In-browser embeddings for semantic clustering.

1. Load `Xenova/all-MiniLM-L6-v2` in `lib/embeddings.ts` (runs in-browser via Web Worker)
2. Compute embeddings for each concept node as it's created
3. Store embeddings in the Zustand store alongside nodes
4. Compute pairwise cosine similarity between all nodes
5. Use similarity to: suggest merges for near-duplicates, set edge weights, influence 3D positioning
6. Add a "similarity threshold" slider to show/hide weak connections

**Verify:** "machine learning" and "deep learning" cluster close; "cooking" stays far away.

### Phase 5: TDA Backend

**Goal:** Persistent homology reveals the shape of thinking.

1. Set up FastAPI with WebSocket endpoint for TDA
2. Implement `tda.py`: node embeddings → point cloud → persistent homology via ripser.py
3. Return: Betti numbers (β0 = components, β1 = loops, β2 = voids), persistence diagrams, representative cycles
4. Build `TopologyPanel.tsx`: Betti number summary, persistence diagram (birth-death scatter), highlighted cycles on 3D graph
5. Wire: on graph change → send embeddings to backend → receive TDA results → overlay on visualization
6. Add visual representations of topological features on the 3D graph

**Verify:** 3 interconnected concepts forming a triangle → β1 = 1 loop. Isolated concept → β0 increases.

### Phase 6: Persistence & Sessions

**Goal:** Save and resume thinking sessions.

1. Set up SQLite database in backend with tables: `sessions`, `nodes`, `edges`, `tda_snapshots`
2. Set up Dexie.js in frontend for offline-capable IndexedDB caching
3. Auto-save graph state on every change (debounced)
4. Build `SessionSidebar.tsx` — list past sessions, click to load
5. Add session creation and resume
6. Sync between IndexedDB (frontend cache) and SQLite (source of truth) via API

**Verify:** Create a graph, close browser, reopen — graph persists. Switch between sessions.

### Phase 7: Polish & Advanced Features

1. Node styling: size by connectivity, color by cluster/topic
2. Edge styling: thickness by weight, dashed for AI-inferred
3. Camera controls: focus on a node, zoom to cluster
4. Concept detail panel: click a node → see connections, embedding neighbors, related quotes
5. Export: download graph as JSON, export visualization as image
6. Dark mode UI

---

## Key AI Prompts

### Concept Extraction
```
Given the user's speech transcript, extract concepts and relationships.
Return JSON: { concepts: [{id, label, description}], relationships: [{source, target, type, description}] }
Merge with existing concepts when semantically equivalent.
Existing graph context: {current_nodes_and_edges}
```

### Reasoning Partner
```
You are analyzing the topology of someone's thinking. Given:
- Their existing concept graph
- Their latest statement
Identify: implicit connections, contradictions, gaps in reasoning, analogies to other fields.
Return JSON with suggested new edges and annotations.
```

---

## Environment Variables

```
OPENROUTER_API_KEY=        # OpenRouter for LLM access
DEEPGRAM_API_KEY=          # Deepgram for speech-to-text
NEXT_PUBLIC_BACKEND_URL=   # Python backend URL (default: http://localhost:8000)
```
