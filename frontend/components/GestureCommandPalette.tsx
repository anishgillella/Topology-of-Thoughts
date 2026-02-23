"use client";

import { useState } from "react";

const GESTURES = [
  {
    name: "Pinch",
    action: "Zoom in/out",
    description: "Bring thumb and index together to zoom in, apart to zoom out",
    svg: (
      <svg viewBox="0 0 60 60" className="w-12 h-12" stroke="currentColor" fill="none" strokeWidth="1.5">
        <circle cx="25" cy="20" r="3" />
        <circle cx="35" cy="20" r="3" />
        <line x1="25" y1="23" x2="30" y2="35" />
        <line x1="35" y1="23" x2="30" y2="35" />
        <line x1="30" y1="35" x2="30" y2="50" />
      </svg>
    ),
  },
  {
    name: "Grab + Move",
    action: "Rotate graph",
    description: "Make a fist and move hand to orbit the camera around the graph",
    svg: (
      <svg viewBox="0 0 60 60" className="w-12 h-12" stroke="currentColor" fill="none" strokeWidth="1.5">
        <rect x="18" y="15" width="24" height="30" rx="8" />
        <path d="M22 25 L22 20 M27 25 L27 18 M32 25 L32 18 M37 25 L37 20" strokeLinecap="round" />
        <path d="M45 30 L52 30 M48 27 L52 30 L48 33" />
      </svg>
    ),
  },
  {
    name: "Open Palm",
    action: "Reset view",
    description: "Show open palm to reset camera to fit all nodes",
    svg: (
      <svg viewBox="0 0 60 60" className="w-12 h-12" stroke="currentColor" fill="none" strokeWidth="1.5">
        <path d="M20 35 L20 22 M25 35 L25 15 M30 35 L30 13 M35 35 L35 15 M40 35 L40 22" strokeLinecap="round" />
        <path d="M18 35 Q18 50 30 50 Q42 50 42 35" />
      </svg>
    ),
  },
  {
    name: "Point",
    action: "Highlight node",
    description: "Extend only index finger to highlight nearest node",
    svg: (
      <svg viewBox="0 0 60 60" className="w-12 h-12" stroke="currentColor" fill="none" strokeWidth="1.5">
        <path d="M30 10 L30 30" strokeLinecap="round" strokeWidth="2" />
        <rect x="22" y="30" width="16" height="20" rx="6" />
        <circle cx="30" cy="8" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Swipe",
    action: "Rotate Y axis",
    description: "Swipe hand left or right to rotate the graph",
    svg: (
      <svg viewBox="0 0 60 60" className="w-12 h-12" stroke="currentColor" fill="none" strokeWidth="1.5">
        <rect x="20" y="20" width="20" height="25" rx="6" />
        <path d="M10 32 L18 32 M42 32 L50 32" />
        <path d="M13 29 L10 32 L13 35" />
        <path d="M47 29 L50 32 L47 35" />
      </svg>
    ),
  },
  {
    name: "Thumbs Up",
    action: "Accept suggestion",
    description: "Show thumbs up to accept an AI suggestion (future)",
    svg: (
      <svg viewBox="0 0 60 60" className="w-12 h-12" stroke="currentColor" fill="none" strokeWidth="1.5">
        <path d="M30 10 L30 28" strokeLinecap="round" strokeWidth="2.5" />
        <rect x="22" y="28" width="16" height="20" rx="6" />
        <path d="M26 33 L26 43 M30 33 L30 43 M34 33 L34 43" strokeLinecap="round" strokeWidth="1" />
      </svg>
    ),
  },
];

export default function GestureCommandPalette() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="absolute bottom-20 right-[4.5rem] z-40 w-12 h-12 flex items-center justify-center
          bg-zinc-800/80 backdrop-blur rounded-xl border border-zinc-700/50
          hover:bg-zinc-700/80 transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200
          font-mono text-lg font-bold"
        title="Gesture reference"
      >
        ?
      </button>

      {open && (
        <div
          className="absolute bottom-36 right-4 z-40 w-80
            bg-zinc-900/95 backdrop-blur-lg border border-zinc-700/50 rounded-2xl
            shadow-xl shadow-black/30 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-200">Gesture Controls</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            {GESTURES.map((g) => (
              <div
                key={g.name}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <div className="text-zinc-400 flex-shrink-0">{g.svg}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-200">{g.name}</span>
                    <span className="text-[10px] text-violet-400 font-mono">{g.action}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">{g.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
