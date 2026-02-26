import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { AccentColor } from "./types";
import { getEditorTheme } from "./theme";
import { getLanguageLabel } from "./language-labels";
import { useShikiHighlighter } from "./use-shiki-highlighter";

export interface CodeEditorProps {
  filename: string | null;
  content: string;
  onSave: (path: string, content: string) => void;
  accentColor?: AccentColor;
}

export function CodeEditor({
  filename,
  content,
  onSave,
  accentColor = "emerald",
}: CodeEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const theme = getEditorTheme(accentColor);
  useShikiHighlighter(localContent, filename, highlightRef);

  useEffect(() => {
    setLocalContent(content);
    setIsDirty(false);
  }, [content, filename]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalContent(e.target.value);
      setIsDirty(e.target.value !== content);
    },
    [content],
  );

  const handleSave = useCallback(() => {
    if (filename && isDirty) {
      onSave(filename, localContent);
      setIsDirty(false);
    }
  }, [filename, isDirty, localContent, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        const newVal = val.substring(0, start) + "  " + val.substring(end);
        setLocalContent(newVal);
        setIsDirty(newVal !== content);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [handleSave, content],
  );

  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      if (lineCountRef.current) {
        lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  }, []);

  if (!filename) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
        Select a file to edit
      </div>
    );
  }

  const lineCount = localContent.split("\n").length;
  const lineNumbers = useMemo(
    () =>
      Array.from({ length: lineCount }, (_, i) => (
        <div
          key={i}
          className="px-3 text-right text-zinc-600 text-[12px] leading-5"
          style={{ minWidth: "3rem" }}>
          {i + 1}
        </div>
      )),
    [lineCount],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-mono text-zinc-300">
            {filename}
          </span>
          {isDirty && (
            <span
              className="inline-block h-2 w-2 rounded-full bg-amber-400"
              title="Unsaved changes"
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-600">
            {getLanguageLabel(filename)}
          </span>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`
              text-[11px] px-2.5 py-1 rounded font-medium transition-colors
              ${
                isDirty
                  ? theme.saveButtonActive
                  : "bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed"
              }
            `}>
            Save
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden relative font-mono text-[13px] leading-5">
        {/* Line numbers */}
        <div
          ref={lineCountRef}
          className="flex-shrink-0 overflow-hidden bg-zinc-900/30 select-none">
          {lineNumbers}
        </div>

        {/* Code container — overlay of highlight layer + textarea */}
        <div className="flex-1 relative min-w-0">
          {/* Highlight layer (behind textarea, renders Shiki HTML) */}
          <div
            ref={highlightRef}
            className="absolute inset-0 overflow-hidden p-2 pointer-events-none [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!font-[inherit] [&_pre]:![font-size:inherit] [&_pre]:![line-height:inherit] [&_pre]:![letter-spacing:inherit] [&_pre]:![white-space:pre] [&_pre]:![word-wrap:normal] [&_code]:!font-[inherit] [&_code]:![font-size:inherit] [&_code]:![line-height:inherit] [&_.shiki]:!overflow-visible"
            style={{ tabSize: 2 }}
          />

          {/* Textarea (transparent text, captures all input) */}
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            wrap="off"
            spellCheck={false}
            className={`
              absolute inset-0 w-full h-full resize-none bg-transparent p-2
              text-transparent outline-none overflow-auto whitespace-pre
              ${theme.caret} ${theme.selection}
            `}
            style={{ tabSize: 2, overflowWrap: "normal", wordBreak: "normal" }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/30 border-t border-zinc-800 text-[11px] text-zinc-600">
        <span>{lineCount} lines</span>
        <span>Ctrl+S / Cmd+S to save</span>
      </div>
    </div>
  );
}
