import { useState } from "react";
import type { ContainerError } from "@run0/jiki";

interface Props {
  errors: ContainerError[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  build: { label: "BUILD", color: "bg-orange-500" },
  runtime: { label: "RUNTIME", color: "bg-red-500" },
  bundle: { label: "BUNDLE", color: "bg-amber-500" },
  install: { label: "INSTALL", color: "bg-yellow-500" },
  filesystem: { label: "FS", color: "bg-rose-500" },
};

export function ErrorOverlay({ errors, onDismiss, onClearAll }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (errors.length === 0) return null;

  const current = errors[Math.min(selectedIdx, errors.length - 1)];
  const cat = CATEGORY_LABELS[current.category] || {
    label: "ERROR",
    color: "bg-red-500",
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-red-950/90 border border-red-800 text-red-300 text-xs font-medium shadow-lg backdrop-blur-sm hover:bg-red-900/90 transition-colors"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
          {errors.length}
        </span>
        <span>
          {errors.length === 1 ? "1 error" : `${errors.length} errors`}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] max-h-[340px] flex flex-col rounded-xl bg-zinc-950/95 border border-red-900/60 shadow-2xl backdrop-blur-md overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${cat.color}`}
          >
            {cat.label}
          </span>
          <span className="text-xs font-semibold text-red-400 truncate max-w-[200px]">
            {current.title}
          </span>
          {errors.length > 1 && (
            <span className="text-[10px] text-zinc-500">
              {selectedIdx + 1}/{errors.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {errors.length > 1 && (
            <>
              <button
                onClick={() =>
                  setSelectedIdx((i: number) => Math.max(0, i - 1))
                }
                disabled={selectedIdx === 0}
                className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                title="Previous error"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={() =>
                  setSelectedIdx((i: number) =>
                    Math.min(errors.length - 1, i + 1)
                  )
                }
                disabled={selectedIdx >= errors.length - 1}
                className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                title="Next error"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}
          {errors.length > 1 && (
            <button
              onClick={onClearAll}
              className="ml-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Clear all"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setExpanded(false)}
            className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Minimize"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => onDismiss(current.id)}
            className="p-0.5 rounded text-zinc-500 hover:text-red-400 transition-colors"
            title="Dismiss"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-3 space-y-2 text-xs">
        {/* Message */}
        <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
          {current.message}
        </p>

        {/* Location */}
        {current.file && (
          <div className="text-red-400/80 text-[11px]">
            {current.file}
            {current.line != null && `:${current.line}`}
            {current.column != null && `:${current.column}`}
          </div>
        )}

        {/* Stack */}
        {current.stack && (
          <details className="group">
            <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors select-none">
              Stack trace
            </summary>
            <pre className="mt-1 text-[10px] text-zinc-500 leading-relaxed whitespace-pre-wrap max-h-[100px] overflow-auto">
              {current.stack}
            </pre>
          </details>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600 flex-shrink-0">
        <span>
          {new Date(current.timestamp).toLocaleTimeString()}
        </span>
        <span className="uppercase tracking-wider">jiki error overlay</span>
      </div>
    </div>
  );
}
