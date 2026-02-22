# Topology of Thoughts

A real-time web application that visualizes the evolving structure of your ideas as an interactive 3D graph. Speak or type your thoughts, and an AI extracts concepts, infers relationships, and applies **topological data analysis (TDA)** to reveal deeper structural patterns — loops, clusters, and voids in the shape of your thinking.

## What It Does

- **Voice-first input** — speak naturally via Deepgram real-time transcription
- **AI reasoning partner** — extracts concepts, infers implicit connections, identifies contradictions and gaps (via OpenRouter / multi-model)
- **3D force-directed graph** — watch your ideas form a living, interactive network
- **Topological data analysis** — persistent homology reveals the "shape" of your thought structure (Betti numbers, persistence diagrams, cycles)
- **In-browser embeddings** — semantic similarity clustering with no API calls (Xenova/all-MiniLM-L6-v2)
- **Full persistence** — save and resume thinking sessions across browser restarts

## Architecture

```
Browser (Next.js)
├── 3d-force-graph        — 3D visualization
├── Deepgram SDK          — real-time speech-to-text
├── OpenRouter client     — LLM concept extraction & reasoning
├── Xenova embeddings     — in-browser semantic similarity
├── Zustand               — state management
└── Dexie.js (IndexedDB)  — frontend cache

Python Backend (FastAPI)
├── ripser.py / giotto-tda — persistent homology (TDA)
├── SQLite                 — session persistence
└── WebSocket              — real-time TDA updates
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| 3D Visualization | 3d-force-graph, Three.js |
| Speech-to-Text | Deepgram (real-time streaming) |
| LLM | OpenRouter (GPT-4, Claude, DeepSeek, etc.) |
| Embeddings | Xenova/all-MiniLM-L6-v2 (in-browser) |
| TDA | FastAPI + ripser.py + giotto-tda |
| Persistence | SQLite (backend) + IndexedDB (frontend) |

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

```
OPENROUTER_API_KEY=        # OpenRouter for LLM access
DEEPGRAM_API_KEY=          # Deepgram for speech-to-text
NEXT_PUBLIC_BACKEND_URL=   # Python backend URL (default: http://localhost:8000)
```

## Project Structure

```
topology-of-thoughts/
├── frontend/                  # Next.js app
│   ├── app/                   # App Router pages & API routes
│   ├── components/            # React components
│   └── lib/                   # Utilities (store, clients, embeddings)
├── backend/                   # Python FastAPI
│   ├── main.py                # App entry + WebSocket
│   ├── tda.py                 # Persistent homology
│   └── database.py            # SQLite persistence
├── README.md
└── plan.md
```

## How It Works

1. **You speak** (or type) your thoughts
2. **Deepgram** transcribes in real-time
3. **LLM** extracts concepts and relationships, infers implicit connections
4. **3D graph** updates live — nodes are concepts, edges are relationships
5. **Embeddings** compute semantic similarity — similar concepts cluster together
6. **TDA** analyzes the point cloud of embeddings to find topological features (loops = circular reasoning, voids = knowledge gaps, clusters = topic areas)
7. **Everything persists** — return to any session and keep building

## License

MIT
