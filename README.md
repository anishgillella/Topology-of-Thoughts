# Topology of Thoughts

A real-time web application that visualizes the evolving structure of your ideas as an interactive 3D graph. Speak or type your thoughts, and an AI extracts concepts, infers relationships, and applies **topological data analysis (TDA)** to reveal deeper structural patterns — loops, clusters, and voids in the shape of your thinking.

Features a **Jarvis-style multimodal interface**: toggle your webcam to control the 3D graph with hand gestures and see your facial expressions analyzed in real time — all detected in-browser via MediaPipe.

---

## What It Does

- **Voice-first input** — speak naturally via Deepgram real-time transcription; interim transcripts appear as speculative "ghost" nodes
- **AI reasoning partner** — extracts concepts, infers implicit connections, identifies contradictions and gaps (via OpenRouter / multi-model)
- **3D force-directed graph** — watch your ideas form a living, interactive network with labeled spheres and colored edges
- **Topological data analysis** — persistent homology reveals the "shape" of your thought structure (Betti numbers, persistence diagrams, cycles)
- **In-browser embeddings** — semantic similarity clustering using HuggingFace Transformers (Matryoshka 256d embeddings, no API calls)
- **Long-term memory** — FAISS vector search over historical sessions with 1-2 hop neighborhood expansion for cross-temporal reasoning
- **Hand gesture control** — pinch to zoom, grab to rotate, open palm to reset view, swipe to spin, all via webcam
- **Facial expression HUD** — real-time detection of expressions (smiling, focused, surprised, skeptical), attention level, and engagement
- **Full persistence** — save and resume thinking sessions across browser restarts via SQLite

---

## Architecture

```
Browser (Next.js 16)
├── react-force-graph-3d / Three.js  — 3D graph visualization
├── Deepgram SDK                     — real-time speech-to-text (WebSocket)
├── @mediapipe/tasks-vision          — hand & face landmark detection (WASM/WebGL)
├── @huggingface/transformers        — in-browser 256d embeddings (ONNX)
├── Zustand                          — state management (2 stores)
└── Next.js API routes               — proxy layer to backend

Python Backend (FastAPI)
├── ripser.py / giotto-tda           — persistent homology (TDA)
├── FAISS                            — vector similarity search (memory)
├── httpx + OpenRouter               — LLM concept extraction & reasoning
├── SQLite (WAL mode)                — session persistence
└── WebSocket                        — real-time TDA updates
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend Framework | Next.js 16 (App Router), TypeScript, React 18 | SSR, routing, API proxy |
| Styling | Tailwind CSS 3.4 | Dark theme, glass morphism, responsive layout |
| 3D Visualization | react-force-graph-3d 1.29, Three.js 0.183 | Force-directed graph, custom node/edge rendering |
| Speech-to-Text | Deepgram (Nova-3, real-time WebSocket) | Streaming transcription with interim results |
| LLM | OpenRouter (GPT-4, Claude, DeepSeek, etc.) | Concept extraction, reasoning, gap detection |
| Embeddings | @huggingface/transformers (embeddinggemma-300m-ONNX, q4) | In-browser 256d semantic similarity |
| Computer Vision | @mediapipe/tasks-vision (FaceLandmarker + HandLandmarker) | Hand gestures, facial expressions, attention tracking |
| State Management | Zustand 5 | Two stores: graph state + vision state |
| TDA | FastAPI + ripser.py + giotto-tda | Persistent homology (Betti numbers, persistence diagrams) |
| Memory | FAISS (faiss-cpu) | Vector similarity search over historical embeddings |
| Persistence | SQLite (WAL mode) | Sessions, nodes, edges, TDA snapshots |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- API keys: OpenRouter, Deepgram

### Setup

```bash
# Clone and install frontend
cd frontend
npm install

# Install backend
cd ../backend
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your API keys to .env
```

### Run

```bash
# Terminal 1 — Frontend
cd frontend
npm run dev          # http://localhost:3000

# Terminal 2 — Backend
cd backend
uvicorn main:app --reload --port 8000
```

### Environment Variables

**Frontend** (`.env`):
```
NEXT_PUBLIC_DEEPGRAM_API_KEY=     # Deepgram for speech-to-text
OPENROUTER_API_KEY=               # OpenRouter for LLM access
NEXT_PUBLIC_BACKEND_URL=          # Python backend URL (default: http://localhost:8000)
```

**Backend** (`.env`):
```
OPENROUTER_API_KEY=               # OpenRouter for LLM access
DB_PATH=./topology.db             # SQLite database path
OPENROUTER_MODEL=openai/gpt-4-mini  # Default LLM model
```

---

## Project Structure

```
topology-of-thoughts/
├── frontend/                         # Next.js 16 app
│   ├── app/
│   │   ├── page.tsx                  # Main page — orchestrates all components
│   │   ├── layout.tsx                # Root layout with metadata
│   │   ├── globals.css               # Global styles, scanline animation
│   │   └── api/                      # API proxy routes → backend
│   │       ├── extract/route.ts      # LLM concept extraction
│   │       ├── reason/route.ts       # LLM reasoning partner
│   │       ├── tda/route.ts          # Topological data analysis
│   │       ├── memory/search/route.ts # FAISS memory search
│   │       ├── sessions/route.ts     # Session CRUD
│   │       └── sessions/[sessionId]/
│   │           ├── route.ts          # Delete session
│   │           └── graph/route.ts    # Load/save graph
│   ├── components/                   # React components (17 files)
│   │   ├── Graph3D.tsx               # 3D force-directed graph
│   │   ├── TextInput.tsx             # Text entry form
│   │   ├── VoiceInput.tsx            # Deepgram speech input
│   │   ├── TopologyPanel.tsx         # TDA stats & persistence diagram
│   │   ├── SessionSidebar.tsx        # Session management drawer
│   │   ├── ConceptDetail.tsx         # Selected node detail panel
│   │   ├── TranscriptionPanel.tsx    # Live transcription display
│   │   ├── SimilaritySlider.tsx      # Embedding threshold control
│   │   ├── ExportButton.tsx          # JSON export
│   │   ├── CameraFeed.tsx            # Full-screen webcam background
│   │   ├── CameraToggle.tsx          # Camera on/off FAB
│   │   ├── GestureOverlay.tsx        # Hand skeleton canvas
│   │   ├── FaceStatusIndicator.tsx   # Expression/attention HUD
│   │   ├── SystemStatusBar.tsx       # Vision metrics bar
│   │   └── GestureCommandPalette.tsx # Gesture reference card
│   └── lib/                          # Utilities & state (11 files)
│       ├── store.ts                  # Zustand graph store
│       ├── visionStore.ts            # Zustand vision store
│       ├── processInput.ts           # Input processing pipeline
│       ├── embeddings.ts             # In-browser embeddings
│       ├── deepgram.ts               # Deepgram WebSocket client
│       ├── gestureInterpreter.ts     # Hand landmark → gesture
│       ├── faceInterpreter.ts        # Blendshapes → expression
│       ├── useMediaPipe.ts           # MediaPipe detection loop
│       ├── useGestureToGraph.ts      # Gesture → camera control
│       ├── useAutoSave.ts            # Debounced session auto-save
│       └── useEmbeddings.ts          # Auto-compute node embeddings
├── backend/                          # Python FastAPI
│   ├── main.py                       # App entry + all endpoints
│   ├── models.py                     # Pydantic request/response schemas
│   ├── database.py                   # SQLite persistence layer
│   ├── llm.py                        # OpenRouter LLM client
│   ├── memory.py                     # FAISS memory index
│   ├── tda.py                        # Persistent homology computation
│   └── requirements.txt              # Python dependencies
└── README.md
```

---

## Frontend Components

### Core Graph

#### `Graph3D.tsx`
The central 3D visualization engine built on `react-force-graph-3d` and Three.js.

- **Node rendering**: Custom `nodeThreeObject` creates labeled spheres using `THREE.SphereGeometry` with `MeshLambertMaterial`, plus a `THREE.Sprite` text label below each sphere rendered onto a `CanvasTexture` with a semi-transparent pill background for readability
- **Node sizing**: `Math.cbrt(1 + connectivity * 0.5 + log2(mentionCount) * 0.5) * 2.5` — nodes grow with more connections and mentions
- **Node coloring**: Ghost (translucent blue), from historical session (teal `#2dd4bf`), selected (light blue `#60a5fa`), connected to selection (cyan `#38bdf8`), unconnected (dark gray `#27272a`), default (blue `#3b82f6`)
- **Edge rendering**: Text sprite labels at midpoints; colors distinguish explicit (gray), AI-inferred (indigo `#818cf8`), and historical/cross-session (teal `#2dd4bf`) edges; width scales with weight
- **Ghost nodes**: Speculative nodes from interim voice transcripts render at 40% opacity
- **Camera**: Click a node to orbit camera to it; press `R` to reset view via `zoomToFit(400, 60)`
- **Transparency**: When camera is enabled, background becomes transparent (`rgba(0,0,0,0)`) so the webcam feed shows through; reverts to `#09090b` when camera is off
- **Gesture control**: Integrates `useGestureToGraph` hook for hand-gesture camera manipulation
- **Responsive**: Listens to window resize events, adjusts canvas dimensions

#### `TextInput.tsx`
Manual text entry with LLM processing.

- Submits text through `processInputWithMemory()` which calls the extraction → dedup → memory → reasoning pipeline
- Fallback parser: if the LLM call fails, recognizes simple patterns like `"X connects to Y"` and creates nodes/edges directly
- Shows a loading spinner during processing
- Styled: `bg-zinc-800/50` background, `border-violet-500/50` focus ring, `rounded-xl`

#### `VoiceInput.tsx`
Real-time speech-to-text via Deepgram WebSocket.

- **Streaming**: Opens WebSocket to Deepgram Nova-3 model, streams PCM16 audio via `AudioContext` + `ScriptProcessorNode`
- **Interim transcripts**: Displayed as ghost nodes in the graph (speculative, removed on next final)
- **Final transcripts**: Processed through the full LLM pipeline (extraction → dedup → memory → reasoning)
- **UI**: Red microphone button when listening, live transcript with blinking cursor below the graph
- **Non-blocking**: LLM processing runs in the background so speech continues uninterrupted

### Info Panels

#### `TopologyPanel.tsx`
Right-side collapsible panel showing graph statistics and TDA results.

- **Stats grid** (2x2): Node count, edge count, connected components (computed via union-find), isolated nodes
- **Topology section**: Betti numbers (beta-0 = components, beta-1 = loops, beta-2 = voids), persistence diagram (SVG scatter plot of birth vs death), detected topological feature count
- **Transcript section**: Collapsible, shows session transcript
- **Auto-computation**: Debounces TDA calls (2s after graph changes) by sending node embeddings to `/api/tda`

#### `SessionSidebar.tsx`
Left-side slide-out drawer for session management.

- Lists all sessions (fetched from `/api/sessions` on mount), sorted by last updated
- Create new session: generates UUID, names session with timestamp
- Switch sessions: saves current graph first, then loads selected session's graph
- Delete session: hover-reveal delete button with API call
- Animated slide-in with semi-transparent backdrop

#### `ConceptDetail.tsx`
Left-top panel showing details of the selected node.

- Displays: label, mention count, description, embedding dimension count
- Lists all connected edges (up to scrollable limit) with colored dots: teal = historical, amber = AI-inferred, violet = explicit
- Click a connected node name to switch selection
- Delete node button removes node and all its edges

#### `TranscriptionPanel.tsx`
Bottom-center panel showing live transcription state.

- Three states: LIVE (red, listening), PROCESSING (amber, extracting concepts), TRANSCRIPT (muted, final result)
- Only visible when voice input is active or processing

#### `SimilaritySlider.tsx`
Range slider controlling the embedding similarity threshold (0 to 1, step 0.05, default 0.5).

Controls which semantically similar node pairs get edges drawn between them.

#### `ExportButton.tsx`
Exports the current graph state as a JSON file (nodes, edges, TDA results, timestamp). Only visible when nodes exist.

### Camera & Vision

#### `CameraFeed.tsx`
Full-screen webcam background layer.

- Requests `getUserMedia` with `facingMode: "user"`, 1280x720 resolution
- Renders as `position: fixed, inset: 0, object-fit: cover, transform: scaleX(-1)` (mirrored) at z-index 0
- Vignette overlay: `radial-gradient(ellipse at center, transparent 40%, rgba(9,9,11,0.7) 100%)` at z-index 1
- Graceful handling: if camera permission denied, disables camera and logs warning
- Cleanup: stops all media tracks on unmount or disable

#### `CameraToggle.tsx`
Floating action button to toggle the camera.

- Position: `absolute bottom-20 right-4 z-40`
- Icons: purple eye when on, gray camera when off
- Keyboard shortcut: `Ctrl+Shift+C`
- Styled: `bg-zinc-800/80 backdrop-blur rounded-xl border border-zinc-700/50`

#### `GestureOverlay.tsx`
Canvas overlay drawing detected hand landmarks.

- Covers the viewport at z-index 5, `pointer-events: none`
- Runs its own `requestAnimationFrame` draw loop, reading from `visionStore.getState()` imperatively (no React re-renders)
- Draws 21 landmarks per hand connected by 20 bone lines
- Left hand: cyan (`rgba(0,255,255,0.6)`), right hand: magenta (`rgba(255,0,255,0.6)`)
- Gesture label rendered near wrist position
- Pinch indicator: circle between thumb tip and index tip, radius proportional to pinch distance
- Coordinates mirror-flipped to match the mirrored video feed

#### `FaceStatusIndicator.tsx`
Top-center HUD pill showing facial expression metrics.

- **Expression label**: Color-coded text (NEUTRAL=gray, SMILING=green, FROWNING=red, SURPRISED=amber, FOCUSED=blue, SKEPTICAL=purple)
- **Attention bar**: Thin progress bar (0-100%), computed from eye openness and gaze direction
- **Engagement radial**: Small SVG circular progress indicator, composite of attention + facial activity
- Styled: `bg-zinc-900/90 backdrop-blur-lg border border-zinc-700/50 rounded-2xl`
- CSS transitions for smooth expression changes
- Only visible when camera is on and a face is detected

#### `SystemStatusBar.tsx`
Thin status bar at the top of the viewport (only when camera is enabled).

- Shows: Vision FPS (green if >20, amber otherwise), camera state, hand count (0/1/2), face detection status, active gesture name
- Styled: `bg-gradient-to-b from-zinc-950/80 to-transparent`, monospace 10px text, `pointer-events: none`

#### `GestureCommandPalette.tsx`
Toggleable overlay showing gesture reference with SVG illustrations.

- Activated via `?` button (positioned next to CameraToggle)
- Shows 6 gesture cards: Pinch (zoom), Grab+Move (rotate), Open Palm (reset view), Point (highlight node), Swipe (rotate Y axis), Thumbs Up (accept suggestion — future)
- Each card has an SVG line drawing, action name, and description

---

## Frontend Libraries

### State Management

#### `store.ts` — Graph Store (Zustand)
Single source of truth for the knowledge graph.

- **Node**: `{ id, label, description?, embedding?, ghost?, x/y/z?, createdAt?, lastMentionedAt?, mentionCount?, fromSession? }`
- **Edge**: `{ id, source, target, label?, aiInferred?, weight?, ghost?, historical? }`
- **TDA**: `{ betti_0, betti_1, betti_2, persistence_diagram[], cycles[] }`
- **Sessions**: `sessions[], currentSessionId, transcript`
- **UI**: `loading, selectedNodeId, similarityThreshold, isListening, liveTranscript, isProcessingVoice`
- Actions: `addNode` (with duplicate label prevention), `addEdge`, `updateNode`, `removeNode`, `removeEdge`, `setGraph`, `reset`, `setGhostNodes`, `clearGhostNodes`

#### `visionStore.ts` — Vision Store (Zustand)
Separate store for camera and vision state, decoupled from the graph store to avoid 30fps re-renders on graph components.

- **Camera**: `cameraEnabled` (default false), `cameraStream`, `toggleCamera()`
- **Hands**: `hands[]` (up to 2 HandGesture objects), `activeGesture`, `rawHandLandmarks[]` (for overlay drawing)
- **Face**: `faceState` (expression, attentionLevel, engagement, blendshapes record)
- **Metrics**: `visionFps`
- **HUD**: `gestureOverlayVisible` (default true), `faceHudVisible` (default true)

### Input Processing

#### `processInput.ts` — Core Pipeline
Orchestrates the full input-to-graph pipeline:

1. **Extract**: POST to `/api/extract` with text + existing node labels; LLM returns concepts and relationships
2. **Deduplicate**: For each extracted concept, compute embedding and check cosine similarity against existing nodes; >0.85 similarity = treat as existing (increment mention count instead of creating duplicate)
3. **Add nodes/edges**: New nodes get embeddings, timestamps, mentionCount=1; edges connect by ID
4. **Memory search**: POST to `/api/memory/search` with the first new node's embedding; retrieves top-10 similar historical nodes (min_similarity 0.3, hop_depth 2)
5. **Reasoning**: POST to `/api/reason` with current graph + historical context; LLM suggests implicit connections, cross-temporal links, contradictions
6. **AI additions**: Suggested nodes/edges added with `aiInferred=true`; cross-session links marked `historical=true`
7. **Graceful fallback**: If any step fails, earlier results are preserved

#### `embeddings.ts` — In-Browser Embeddings
Runs the `onnx-community/embeddinggemma-300m-ONNX` model (q4 quantization) entirely in the browser via `@huggingface/transformers`.

- **Output**: 256-dimensional vectors (Matryoshka truncation from 768d full output), L2-normalized
- **Functions**: `getEmbedding(text)`, `getEmbeddings(texts[])`, `cosineSimilarity(a, b)`, `findSimilarPairs(nodes, threshold)`
- **Lazy loading**: Pipeline is created on first call and cached for subsequent use

#### `deepgram.ts` — Deepgram WebSocket Client
Manages real-time streaming transcription.

- Opens WebSocket to `wss://api.deepgram.com/v1/listen` with configurable model (default: nova-3) and language (default: en)
- Audio pipeline: `navigator.mediaDevices.getUserMedia` → `AudioContext` (16kHz) → `ScriptProcessorNode` → PCM16 conversion → WebSocket binary frames
- Callbacks: `onTranscript(text, isFinal)` — interim results for ghost nodes, final results for LLM processing
- Handles WebSocket lifecycle (open, message, close, error) and cleanup (stop tracks, close context)

### Vision Interpretation

#### `gestureInterpreter.ts` — Hand Gesture Classification
Pure functions (no React) converting raw MediaPipe hand landmarks (21 points) into classified gestures.

| Gesture | Detection Algorithm |
|---------|-------------------|
| **Pinch** | Thumb tip (landmark 4) to index tip (landmark 8) Euclidean distance < 0.05 normalized |
| **Grab/Fist** | All four fingertips (8, 12, 16, 20) closer to wrist (0) than their respective MCP joints (5, 9, 13, 17) |
| **Open Palm** | All four fingertips extended past their MCP joints |
| **Point** | Only index finger extended, middle/ring/pinky curled |
| **Thumbs Up** | Thumb tip above thumb MCP (y < MCP y in normalized coords), all other fingers curled |
| **Swipe L/R** | Wrist velocity over last 5 frames exceeds threshold (1.5), primarily horizontal movement |

- **Stability filter**: Requires 2 consecutive frames of the same gesture before emitting (prevents flicker/jitter)
- **Velocity tracking**: Maintains a 10-frame position history per hand for swipe detection
- **Priority order**: Pinch > Thumbs Up > Point > Grab > Swipe > Open Palm

#### `faceInterpreter.ts` — Facial Expression Analysis
Pure functions converting MediaPipe's 52 face blendshapes into a structured `FaceState`.

| Expression | Blendshape Formula |
|-----------|-------------------|
| **Surprised** | `browInnerUp > 0.5 && jawOpen > 0.4` |
| **Smiling** | `mouthSmileLeft + mouthSmileRight > 0.6` |
| **Frowning** | `mouthFrownLeft + mouthFrownRight > 0.5` |
| **Focused** | `eyeSquintLeft + eyeSquintRight > 0.4 && (browDownLeft + browDownRight)/2 > 0.3` |
| **Skeptical** | `|browOuterUpLeft - browOuterUpRight| > 0.3` (asymmetric brow) |
| **Neutral** | Default when no other expression matches |

- **Attention level** (0-1): `eyeOpenness * 0.4 + gazeAtScreen * 0.6` — combines eye blink state with gaze direction (looking away reduces attention)
- **Engagement** (0-1): `attention * 0.6 + facialActivity * 0.4` — composite of attention plus any non-neutral facial muscle activity

### Hooks

#### `useMediaPipe.ts` — Detection Loop
Core hook managing MediaPipe model initialization and the frame-by-frame detection loop.

- **Lazy initialization**: Models (~5MB WASM + weights) loaded from CDN only on first camera enable, cached by browser
- **GPU with CPU fallback**: Attempts WebGL delegate first; if unavailable, falls back to CPU (XNNPACK) silently, suppressing MediaPipe's noisy INFO-level `console.error` messages
- **Detection loop**: `requestAnimationFrame` capped at ~30fps (skips if <33ms elapsed)
  - Hand detection: every frame (~30fps) for responsive gesture tracking
  - Face detection: every 3rd frame (~10fps) — expressions don't change fast enough to need 30fps, saving ~40% per-frame cost
- **Imperative writes**: Uses `useVisionStore.getState().setX()` to update state without triggering React re-renders in the detection loop
- **FPS counter**: Tracks actual detection frames per second, updates every 1s
- **Cleanup**: Closes both landmarkers and clears gesture history on unmount

#### `useGestureToGraph.ts` — Gesture-to-Camera Bridge
Maps detected gestures to ForceGraph3D camera manipulations.

| Gesture | Camera Action | Implementation |
|---------|-------------|----------------|
| **Pinch** | Zoom in/out | Camera distance multiplied by `1 + delta * 5`; clamped to 50-2000 range |
| **Grab + move** | Orbit rotation | Converts hand position delta to spherical coordinate changes (theta, phi); smooth orbit around origin |
| **Swipe left/right** | Y-axis rotation | 0.08 radian rotation per swipe event |
| **Open palm** | Reset view | `fgRef.current.zoomToFit(400, 60)` with 1-second cooldown to prevent spam |
| **Point** | (Future) Raycast highlight | Placeholder for node highlighting |
| **Thumbs up** | (Future) Accept AI suggestion | Placeholder |

- **EMA smoothing**: Exponential moving average on hand position with alpha=0.35 (responsive but smooth)
- **requestAnimationFrame**: Uses rAF instead of `setInterval` for jitter-free camera updates synced with display refresh
- **Mirror correction**: Inverts X coordinate to match the mirrored webcam feed
- **Spherical coordinates**: Camera orbits use (theta, phi, distance) → (x, y, z) conversion for natural-feeling rotation

#### `useAutoSave.ts` — Session Persistence
Debounced auto-save (3-second delay) that POSTs nodes, edges, and transcript to `/api/sessions/[sessionId]/graph`.

Only saves if a session is active and the graph has at least one node. Silently ignores save failures (retries on next change).

#### `useEmbeddings.ts` — Auto Embedding
Automatically computes embeddings for any node that doesn't have one yet.

Tracks in-progress embedding IDs to avoid duplicate computation. Errors are logged but don't block the UI.

---

## API Routes

All frontend API routes are thin proxies that forward requests to the Python backend at `NEXT_PUBLIC_BACKEND_URL`.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/extract` | POST | Send text + existing node labels → receive extracted concepts and relationships |
| `/api/reason` | POST | Send current + historical graph → receive suggested connections, new nodes, insights |
| `/api/memory/search` | POST | Send embedding vector → receive similar historical nodes with 1-2 hop neighborhood |
| `/api/tda` | POST | Send node embeddings → receive Betti numbers, persistence diagram, cycles |
| `/api/sessions` | GET | List all sessions (ordered by last updated) |
| `/api/sessions` | POST | Create a new session |
| `/api/sessions/[id]` | DELETE | Delete a session and all its data |
| `/api/sessions/[id]/graph` | GET | Load a session's graph (nodes, edges, transcript) |
| `/api/sessions/[id]/graph` | POST | Save a session's graph |

---

## Backend Services

### `main.py` — FastAPI Application
Entry point with CORS configuration (allows `localhost:3000`), all REST endpoints, and a WebSocket endpoint (`/ws`) for real-time TDA updates. Health check at `GET /health`.

### `llm.py` — OpenRouter LLM Client
Two prompt templates:

- **Extraction prompt**: Instructs the LLM to extract distinct concepts from text, recognize abbreviations/synonyms as existing nodes, and create specific relationship labels (not generic "relates to")
- **Reasoning prompt**: Instructs the LLM to identify implicit connections, cross-temporal patterns, contradictions, and knowledge gaps; returns suggested nodes/edges with reasoning

Uses `httpx` to call the OpenRouter API with configurable model selection.

### `database.py` — SQLite Persistence
Schema with 4 tables:

| Table | Columns | Purpose |
|-------|---------|---------|
| `sessions` | id, name, created_at, updated_at, transcript | Session metadata |
| `nodes` | id, session_id, label, description, embedding (JSON), x/y/z, created_at, last_mentioned_at, mention_count | Graph nodes with positions and embeddings |
| `edges` | id, session_id, source, target, label, ai_inferred, weight, created_at | Graph edges with relationship metadata |
| `tda_snapshots` | id, session_id, created_at, betti_0/1/2, persistence_diagram (JSON) | Historical TDA results |

Uses WAL mode and foreign keys. Provides functions for CRUD operations, graph upsert (save replaces all nodes/edges for a session), and cross-session queries.

### `memory.py` — FAISS Memory Index
`MemoryIndex` class that indexes all historical node embeddings in a FAISS flat index.

- `rebuild()`: Re-indexes all nodes with embeddings from the database
- `search(query_embedding, top_k, min_similarity)`: Returns top-K similar nodes above threshold
- `retrieve_historical_context(embedding, session_id, top_k, min_similarity, hop_depth)`: Finds seed nodes, then expands 1-2 hops via edge traversal, returning a neighborhood of related historical concepts

### `tda.py` — Persistent Homology
Computes topological features of the thought graph's embedding space.

- Builds a cosine distance matrix from node embeddings
- Runs `ripser` with `maxdim=2` to compute H0, H1, H2 persistence
- **Betti numbers**: Count features with persistence > 0.3 threshold
  - beta-0: Connected components (topic clusters)
  - beta-1: Loops/cycles (circular reasoning patterns)
  - beta-2: Voids/cavities (knowledge gaps)
- **Persistence diagram**: Array of (dimension, birth, death) tuples
- **Cycle detection**: Identifies which nodes participate in 1D homology features (max 6 nodes per cycle)

### `models.py` — Pydantic Schemas
Request/response models for all endpoints: extraction, reasoning, TDA, memory search, sessions, and graph data.

---

## Z-Index Layer Stack

When the camera is enabled, the UI layers as follows:

| z-index | Layer | Component |
|---------|-------|-----------|
| 0 | Webcam video | `CameraFeed` — full-screen mirrored background |
| 1 | Vignette | CSS radial gradient overlay for readability |
| 2 | 3D graph | `Graph3D` — transparent background, floating over video |
| 3 | Scanline | CSS animation sweep (Jarvis aesthetic) |
| 5 | Hand skeleton | `GestureOverlay` — canvas drawing hand landmarks |
| 10 | Existing panels | TopologyPanel, ConceptDetail, TranscriptionPanel, stats badge |
| 15 | HUD | FaceStatusIndicator, SystemStatusBar |
| 20-30 | SessionSidebar | Slide-out drawer with backdrop |
| 40 | Camera controls | CameraToggle FAB, GestureCommandPalette |

---

## Data Flow

### Input Pipeline
```
User speaks/types
    ↓
Deepgram (interim → ghost nodes) / TextInput form
    ↓
processInputWithMemory()
    ├── POST /api/extract → LLM extracts concepts + relationships
    ├── Embedding similarity check (>0.85 = existing concept, increment mention)
    ├── POST /api/memory/search → FAISS finds similar historical nodes + 1-2 hop neighborhood
    ├── POST /api/reason → LLM suggests implicit connections, cross-temporal links
    └── Add new nodes/edges to Zustand store
         ├── Auto-save (3s debounce) → POST /api/sessions/[id]/graph → SQLite
         ├── Auto-embed (nodes without embeddings) → in-browser HuggingFace
         └── Auto-TDA (2s debounce) → POST /api/tda → ripser → Betti numbers
```

### Vision Pipeline (when camera enabled)
```
Webcam → MediaPipe WASM
    ├── HandLandmarker (30fps) → gestureInterpreter → stability filter → activeGesture
    │   └── useGestureToGraph → EMA smoothing → ForceGraph3D camera manipulation
    └── FaceLandmarker (10fps) → faceInterpreter → expression + attention + engagement
        └── FaceStatusIndicator HUD
```

---

## Performance Strategy

- **30fps detection cap** with frame skipping in the rAF loop
- **Staggered detection**: Hands at 30fps, face at 10fps (expressions don't need 30fps)
- **Imperative store reads**: `getState()` in draw/poll loops avoids React re-renders at 30fps
- **GPU delegate with CPU fallback**: WebGL inference when available, XNNPACK otherwise
- **2-frame gesture stability**: Prevents gesture flicker without adding perceptible delay
- **EMA smoothing** (alpha 0.35): Responsive but smooth camera movements
- **requestAnimationFrame**: Display-synced gesture polling (not `setInterval`)
- **Lazy model loading**: MediaPipe WASM + models (~5MB) loaded only on first camera enable, browser-cached
- **Selective Zustand subscriptions**: HUD components subscribe to expression enums, not raw blendshape floats
- **Debounced computation**: Auto-save (3s) and TDA (2s) debounce expensive operations
- **Dynamic import**: Graph3D loaded with `next/dynamic` (no SSR)

---

## Progressive Enhancement

The camera/vision features are fully opt-in:

- `cameraEnabled` defaults to `false` — app renders exactly as a keyboard/mouse-driven tool on first load
- CameraToggle FAB is always visible, inviting opt-in
- Camera permission denial → graceful fallback with console warning, camera disabled
- MediaPipe load failure (old browser, no WASM) → camera feed shows but detection disabled
- All mouse/keyboard/trackpad controls continue working alongside gestures
- Press `R` to reset graph view at any time

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `R` | Reset graph view (zoom to fit) |
| `Ctrl+Shift+C` | Toggle camera on/off |

---

## License

MIT
