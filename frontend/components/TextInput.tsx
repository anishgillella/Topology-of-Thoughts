"use client";

import { useState } from "react";
import { useGraphStore } from "@/lib/store";
import { processInputWithMemory } from "@/lib/processInput";

export default function TextInput() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const addNode = useGraphStore((s) => s.addNode);
  const appendTranscript = useGraphStore((s) => s.appendTranscript);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setText("");
    setLoading(true);
    appendTranscript(trimmed);

    try {
      await processInputWithMemory(trimmed);
    } catch {
      // LLM pipeline failed — add raw text as a single node
      addNode({ id: crypto.randomUUID(), label: trimmed });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe your thoughts..."
        disabled={loading}
        className="flex-1 px-4 py-2.5 bg-zinc-800/50 text-white rounded-xl border border-zinc-700/50 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 placeholder-zinc-500 disabled:opacity-50 text-sm transition-all"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="px-5 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-all font-medium disabled:opacity-30 disabled:hover:bg-violet-600 text-sm cursor-pointer"
      >
        {loading ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        )}
      </button>
    </form>
  );
}
