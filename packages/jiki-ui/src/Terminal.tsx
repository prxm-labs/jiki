import { useState, useRef, useEffect, useCallback } from "react";
import type { AccentColor, TerminalLine } from "./types";
import { getTerminalTheme, getLineStyles } from "./theme";

export interface TerminalProps {
  lines: TerminalLine[];
  onCommand?: (cmd: string) => Promise<void>;
  onClear: () => void;
  accentColor?: AccentColor;
  variant?: "default" | "compact";
  title?: string;
  lineStyles?: Partial<Record<TerminalLine["type"], string>>;
}

export function Terminal({
  lines,
  onCommand,
  onClear,
  accentColor = "emerald",
  variant = "default",
  title = "Terminal",
  lineStyles: lineStyleOverrides,
}: TerminalProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const termTheme = getTerminalTheme(accentColor);
  const styles = getLineStyles(accentColor, lineStyleOverrides);

  const isCompact = variant === "compact";
  const hasInput = !!onCommand;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const executeCommand = useCallback(
    async (cmd: string) => {
      if (cmd === "clear") {
        onClear();
        return;
      }
      if (!onCommand) return;
      setIsRunning(true);
      await onCommand(cmd);
      setIsRunning(false);
      inputRef.current?.focus();
    },
    [onCommand, onClear],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = e.currentTarget.value.trim();
        if (!cmd || isRunning) return;
        setInput("");
        setHistory(prev => [...prev, cmd]);
        setHistoryIdx(-1);
        executeCommand(cmd);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const newIdx =
          historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx === -1) return;
        const newIdx = historyIdx + 1;
        if (newIdx >= history.length) {
          setHistoryIdx(-1);
          setInput("");
        } else {
          setHistoryIdx(newIdx);
          setInput(history[newIdx]);
        }
      }
    },
    [history, historyIdx, isRunning, executeCommand],
  );

  // Size tokens based on variant
  const headerPy = isCompact ? "py-1" : "py-1.5";
  const dotSize = isCompact ? "h-2 w-2" : "h-2.5 w-2.5";
  const dotOpacity = isCompact ? "bg-red-500/60" : "bg-red-500/70";
  const dotYellow = isCompact ? "bg-yellow-500/60" : "bg-yellow-500/70";
  const dotGreen = isCompact ? "bg-green-500/60" : "bg-green-500/70";
  const titleSize = isCompact ? "text-[10px]" : "text-[11px]";
  const titleMl = isCompact ? "ml-1" : "";
  const clearSize = isCompact ? "text-[10px]" : "text-[11px]";
  const outputClass = isCompact
    ? "flex-1 overflow-y-auto px-3 py-1.5 font-mono text-[11px] leading-4"
    : "flex-1 overflow-y-auto p-3 font-mono text-[13px] leading-5";
  const inputPy = isCompact ? "py-1.5" : "py-2";
  const inputGap = isCompact ? "gap-1.5" : "gap-2";
  const promptSize = isCompact ? "text-[11px]" : "text-sm";
  const inputFontSize = isCompact ? "text-[11px]" : "text-[13px]";
  const spinnerSize = isCompact ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 ${headerPy} bg-zinc-900/50 border-b border-zinc-800`}>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            <div className={`${dotSize} rounded-full ${dotOpacity}`} />
            <div className={`${dotSize} rounded-full ${dotYellow}`} />
            <div className={`${dotSize} rounded-full ${dotGreen}`} />
          </div>
          <span
            className={`${titleSize} font-semibold uppercase tracking-wider text-zinc-500 ${titleMl}`}>
            {title}
          </span>
        </div>
        <button
          onClick={onClear}
          className={`${clearSize} text-zinc-600 hover:text-zinc-400 transition-colors`}>
          Clear
        </button>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        data-testid="terminal-output"
        className={outputClass}>
        {lines.map(line => (
          <div key={line.id} className={styles[line.type]}>
            {line.text.split("\n").map((segment, i) => (
              <div key={i}>{segment || "\u00A0"}</div>
            ))}
          </div>
        ))}
      </div>

      {/* Input (only when onCommand is provided) */}
      {hasInput && (
        <div className="flex-shrink-0 border-t border-zinc-800">
          <div className={`flex items-center px-3 ${inputPy} ${inputGap}`}>
            <span
              className={`${termTheme.promptColor} font-mono ${promptSize} font-bold select-none`}>
              $
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
              placeholder={isRunning ? "Running..." : "Type a command..."}
              className={`
                flex-1 bg-transparent text-zinc-200 ${inputFontSize} font-mono
                outline-none placeholder:text-zinc-700
                disabled:opacity-50
                ${termTheme.inputCaret}
              `}
            />
            {isRunning && (
              <div
                className={`${spinnerSize} animate-spin rounded-full border border-zinc-600 ${termTheme.spinnerBorder}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
