import { create } from "zustand";

export interface Node {
  id: string;
  label: string;
  description?: string;
  embedding?: number[];
  ghost?: boolean; // Speculative node from interim voice transcript
  x?: number;
  y?: number;
  z?: number;
  createdAt?: string;
  lastMentionedAt?: string;
  mentionCount?: number;
  fromSession?: string; // If this node was pulled from historical memory
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  aiInferred?: boolean;
  weight?: number;
  ghost?: boolean;
  historical?: boolean; // Cross-temporal connection
}

export interface TDAResult {
  betti_0: number;
  betti_1: number;
  betti_2: number;
  persistence_diagram: Array<{ dimension: number; birth: number; death: number }>;
  cycles: Array<{ dimension: number; nodes: string[] }>;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface GraphStore {
  // Graph data
  nodes: Node[];
  edges: Edge[];

  // Ghost nodes (speculative, from interim transcripts)
  ghostNodes: Node[];
  setGhostNodes: (nodes: Node[]) => void;
  clearGhostNodes: () => void;

  // TDA
  tdaResult: TDAResult | null;
  setTDAResult: (result: TDAResult | null) => void;

  // Sessions
  sessions: Session[];
  currentSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (id: string | null) => void;

  // Session transcript
  transcript: string;
  appendTranscript: (text: string) => void;
  setTranscript: (text: string) => void;

  // UI state
  loading: boolean;
  setLoading: (loading: boolean) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  // Live transcription
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
  liveTranscript: string;
  setLiveTranscript: (text: string) => void;
  isProcessingVoice: boolean;
  setIsProcessingVoice: (processing: boolean) => void;

  // Graph actions
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  setGraph: (nodes: Node[], edges: Edge[]) => void;
  reset: () => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  ghostNodes: [],
  tdaResult: null,
  sessions: [],
  currentSessionId: null,
  transcript: "",
  loading: false,
  selectedNodeId: null,
  isListening: false,
  liveTranscript: "",
  isProcessingVoice: false,

  setGhostNodes: (ghostNodes) => set({ ghostNodes }),
  clearGhostNodes: () => set({ ghostNodes: [] }),
  setTDAResult: (result) => set({ tdaResult: result }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  appendTranscript: (text) =>
    set((state) => ({
      transcript: state.transcript ? state.transcript + "\n" + text : text,
    })),
  setTranscript: (transcript) => set({ transcript }),
  setLoading: (loading) => set({ loading }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsListening: (isListening) => set({ isListening }),
  setLiveTranscript: (liveTranscript) => set({ liveTranscript }),
  setIsProcessingVoice: (isProcessingVoice) => set({ isProcessingVoice }),

  addNode: (node) =>
    set((state) => {
      const duplicate = state.nodes.find(
        (n) => n.label.toLowerCase() === node.label.toLowerCase()
      );
      if (duplicate) return state; // Skip insert — label already exists
      return { nodes: [...state.nodes, node] };
    }),

  addEdge: (edge) =>
    set((state) => ({ edges: [...state.edges, edge] })),

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    })),

  setGraph: (nodes, edges) => set({ nodes, edges }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      ghostNodes: [],
      tdaResult: null,
      selectedNodeId: null,
      transcript: "",
    }),
}));
