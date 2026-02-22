"use client";

import { useState, useEffect, useCallback } from "react";
import { useGraphStore, Session } from "@/lib/store";

export default function SessionSidebar() {
  const [open, setOpen] = useState(false);
  const sessions = useGraphStore((s) => s.sessions);
  const currentSessionId = useGraphStore((s) => s.currentSessionId);
  const setSessions = useGraphStore((s) => s.setSessions);
  const setCurrentSessionId = useGraphStore((s) => s.setCurrentSessionId);
  const setGraph = useGraphStore((s) => s.setGraph);
  const reset = useGraphStore((s) => s.reset);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // offline
    }
  }, [setSessions]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = async () => {
    const id = crypto.randomUUID();
    const name = `Session ${sessions.length + 1}`;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      if (res.ok) {
        reset();
        setCurrentSessionId(id);
        await fetchSessions();
      }
    } catch {
      setCurrentSessionId(id);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (currentSessionId && nodes.length > 0) {
      await fetch(`/api/sessions/${currentSessionId}/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/graph`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data.nodes || [], data.edges || []);
        setCurrentSessionId(sessionId);
      }
    } catch {
      // offline
    }
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (currentSessionId === sessionId) {
          reset();
          setCurrentSessionId(null);
        }
        await fetchSessions();
      }
    } catch {
      // offline
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="absolute top-4 left-4 z-10 flex items-center justify-center w-10 h-10 bg-zinc-800/80 backdrop-blur hover:bg-zinc-700 rounded-xl border border-zinc-700/50 transition-all"
        title="Sessions"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-300"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="absolute inset-0 z-20 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`absolute top-0 left-0 z-30 h-full w-72 bg-zinc-900/95 backdrop-blur-lg border-r border-zinc-700/50 flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-200 tracking-wide">
            Sessions
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-4">
          <button
            onClick={createSession}
            className="w-full px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-500 transition-colors"
          >
            + New Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-1.5">
          {sessions.map((session: Session) => (
            <div
              key={session.id}
              onClick={() => loadSession(session.id)}
              className={`group relative w-full text-left px-4 py-3 rounded-xl text-sm cursor-pointer transition-all ${
                session.id === currentSessionId
                  ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
                  : "text-zinc-300 hover:bg-zinc-800/70"
              }`}
            >
              <div className="font-medium truncate pr-6">{session.name}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {new Date(session.updatedAt).toLocaleDateString()}
              </div>
              <button
                onClick={(e) => deleteSession(e, session.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Delete session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">No sessions yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Create one to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
