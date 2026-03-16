import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { boot, InMemoryAdapter, type Container } from "jiki";

const DEFAULT_CODE = `import chalk from 'chalk';
import _ from 'lodash';

const nums: number[] = [3, 1, 4, 1, 5, 9, 2, 6];

console.log(chalk.green.bold('Numbers:'));
console.log('Sorted:', _.sortBy(nums).join(', '));
console.log('Mean:', chalk.yellow(_.mean(nums).toFixed(1)));
`;

// ── ANSI → React renderer ────────────────────────────────────────
const ANSI_STYLES: Record<number, string> = {
  // modifiers
  1: "font-bold",
  2: "opacity-50",
  3: "italic",
  4: "underline",
  // foreground standard
  30: "text-zinc-900",
  31: "text-red-400",
  32: "text-green-400",
  33: "text-yellow-300",
  34: "text-blue-400",
  35: "text-purple-400",
  36: "text-cyan-400",
  37: "text-zinc-200",
  // foreground bright
  90: "text-zinc-500",
  91: "text-red-300",
  92: "text-green-300",
  93: "text-yellow-200",
  94: "text-blue-300",
  95: "text-purple-300",
  96: "text-cyan-300",
  97: "text-white",
  // background standard
  40: "bg-zinc-900",
  41: "bg-red-900",
  42: "bg-green-900",
  43: "bg-yellow-900",
  44: "bg-blue-900",
  45: "bg-purple-900",
  46: "bg-cyan-900",
  47: "bg-zinc-200",
};

// Reset codes — these clear a category rather than adding a class
const ANSI_RESETS = new Set([0, 22, 23, 24, 39, 49]);

function renderAnsi(text: string): React.ReactNode {
  // Fast path: no escape sequences at all
  if (!text.includes("\x1b[")) return text;

  const segments = text.split(/(\x1b\[[0-9;]*m)/);
  const result: React.ReactNode[] = [];
  let active: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith("\x1b[")) {
      const codes = seg.slice(2, -1).split(";").map(Number);
      for (const c of codes) {
        if (c === 0) {
          active = [];
        } else if (ANSI_RESETS.has(c)) {
          // strip the category this resets (fg 30-37/90-97 → "text-", bg 40-47 → "bg-", etc.)
          if (c === 39) active = active.filter(s => !s.startsWith("text-"));
          else if (c === 49) active = active.filter(s => !s.startsWith("bg-"));
          else if (c === 22)
            active = active.filter(
              s => s !== "font-bold" && s !== "opacity-50",
            );
          else if (c === 23) active = active.filter(s => s !== "italic");
          else if (c === 24) active = active.filter(s => s !== "underline");
        } else {
          const cls = ANSI_STYLES[c];
          if (cls) {
            const prefix = cls.split("-")[0]; // "text", "bg", "font", etc.
            // For fg/bg colors, replace rather than stack
            if (prefix === "text" || prefix === "bg") {
              active = [
                ...active.filter(s => !s.startsWith(prefix + "-")),
                cls,
              ];
            } else {
              if (!active.includes(cls)) active = [...active, cls];
            }
          }
        }
      }
    } else if (seg) {
      result.push(
        active.length > 0 ? (
          <span key={i} className={active.join(" ")}>
            {seg}
          </span>
        ) : (
          <span key={i}>{seg}</span>
        ),
      );
    }
  }

  return <>{result}</>;
}

// ── Syntax highlighting ──────────────────────────────────────────
function highlightCode(code: string): React.ReactNode[] {
  return code.split("\n").map((line, li) => {
    if (!line) return <div key={li}>{"\u00A0"}</div>;

    const tokens: { text: string; cls: string }[] = [];
    const re =
      /(\/\/.*$)|(["'`])(?:(?!\2|\\).|\\.)*\2|(\b(?:import|from|export|const|let|var|await|async|function|return|new|typeof|interface|type)\b)|(\b(?:number|string|boolean|void|any|null|undefined)\b)|(\b\d+(?:\.\d+)?\b)/gm;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(line)) !== null) {
      if (m.index > last)
        tokens.push({ text: line.slice(last, m.index), cls: "text-zinc-300" });

      const cls =
        m[1] !== undefined
          ? "text-zinc-600" // comment
          : m[2] !== undefined
            ? "text-emerald-300" // string
            : m[3] !== undefined
              ? "text-violet-400" // keyword
              : m[4] !== undefined
                ? "text-cyan-400" // type
                : "text-amber-300"; // number

      tokens.push({ text: m[0], cls });
      last = m.index + m[0].length;
    }

    if (last < line.length)
      tokens.push({ text: line.slice(last), cls: "text-zinc-300" });

    return (
      <div key={li}>
        {tokens.map((t, i) => (
          <span key={i} className={t.cls}>
            {t.text}
          </span>
        ))}
      </div>
    );
  });
}

interface OutputLine {
  id: number;
  type: "stdout" | "stderr" | "info" | "cmd";
  text: string;
}

let lineId = 0;

export default function HeroDemo() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [termInput, setTermInput] = useState("");
  const [status, setStatus] = useState<
    "booting" | "installing" | "ready" | "running"
  >("booting");
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const termRef = useRef<HTMLDivElement>(null);
  const termInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<OutputLine[]>([]);

  const pushLine = useCallback((type: OutputLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setOutput([...linesRef.current]);
  }, []);

  const clearLines = useCallback(() => {
    linesRef.current = [];
    setOutput([]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  // Boot container + install deps
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    async function init() {
      const c = boot({
        cwd: "/app",
        env: { FORCE_COLOR: "1" },
        persistence: new InMemoryAdapter(),
        onConsole: (_method: string, args: unknown[]) => {
          const text = args
            .map(a => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ");
          pushLine("stdout", text);
        },
      });
      containerRef.current = c;

      pushLine("info", "Installing lodash & chalk...");
      setStatus("installing");

      try {
        await c.install(["lodash", "chalk"]);
        pushLine("info", "\u2713 lodash, chalk installed");
      } catch (err) {
        pushLine("stderr", `Install failed: ${err}`);
      }

      c.writeFile("/app/index.ts", DEFAULT_CODE);
      pushLine("info", "Ready. Click Run or type commands below.");
      setStatus("ready");
    }

    init();
  }, [pushLine]);

  // Run the editor code
  const handleRun = useCallback(async () => {
    const c = containerRef.current;
    if (!c || status !== "ready") return;

    setStatus("running");
    clearLines();
    pushLine("cmd", "$ node index.ts");

    c.writeFile("/app/index.ts", code);

    try {
      const result = await c.run("node index.ts");
      if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
      if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
      if (result.exitCode !== 0) {
        pushLine("info", `Exit code ${result.exitCode}`);
      }
    } catch (err) {
      pushLine("stderr", String(err));
    }

    setStatus("ready");
  }, [code, status, pushLine, clearLines]);

  // Run a terminal command
  const runTerminalCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c || status !== "ready") return;

      if (cmd === "clear") {
        clearLines();
        return;
      }

      setStatus("running");
      pushLine("cmd", `$ ${cmd}`);

      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
        if (result.exitCode !== 0) {
          pushLine("info", `Exit code ${result.exitCode}`);
        }
      } catch (err) {
        pushLine("stderr", String(err));
      }

      setStatus("ready");
      termInputRef.current?.focus();
    },
    [status, pushLine, clearLines],
  );

  // Sync scroll between textarea and highlight layer
  const handleEditorScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !highlightRef.current) return;
    highlightRef.current.scrollTop = ta.scrollTop;
    highlightRef.current.scrollLeft = ta.scrollLeft;
  }, []);

  const highlighted = useMemo(() => highlightCode(code), [code]);

  // Editor key handler
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        setCode(ta.value.substring(0, start) + "  " + ta.value.substring(end));
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun],
  );

  // Terminal input key handler
  const handleTermKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = termInput.trim();
        if (!cmd || status !== "ready") return;
        setTermInput("");
        runTerminalCommand(cmd);
      }
    },
    [termInput, status, runTerminalCommand],
  );

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-emerald-500/5 flex flex-col">
      {/* ── Editor ─────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 flex flex-col min-h-0">
        {/* Titlebar */}
        <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex gap-1.5">
            <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-zinc-700/80" />
            <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-zinc-700/80" />
            <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-zinc-700/80" />
          </div>
          <span className="ml-2 font-mono text-[11px] sm:text-xs text-zinc-500">
            index.ts
          </span>
          <div className="ml-auto">
            <button
              onClick={handleRun}
              disabled={status !== "ready"}
              className={`
                flex items-center gap-1.5 rounded-md px-2.5 py-1 sm:px-3 font-mono text-[10px] sm:text-[11px] font-medium transition-all
                ${
                  status === "ready"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50"
                    : "bg-zinc-800/50 text-zinc-600 border border-zinc-700/50 cursor-not-allowed"
                }
              `}>
              {status === "running" ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-emerald-400" />
                  Running
                </>
              ) : status === "ready" ? (
                <>
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Run
                </>
              ) : (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-emerald-400" />
                  {status === "booting" ? "Booting" : "Installing"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code editor with syntax highlighting overlay */}
        <div
          className="relative h-[200px] sm:h-[260px] bg-[#09090b]"
          style={{ tabSize: 2 }}>
          {/* Highlight layer */}
          <div
            ref={highlightRef}
            className="absolute inset-0 overflow-hidden px-3 py-2.5 sm:px-5 sm:py-3.5 font-mono text-[11px] sm:text-[13px] leading-[1.7] whitespace-pre pointer-events-none"
            aria-hidden>
            {highlighted}
          </div>
          {/* Editable textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            onScroll={handleEditorScroll}
            wrap="off"
            spellCheck={false}
            className="absolute inset-0 w-full h-full resize-none bg-transparent px-3 py-2.5 sm:px-5 sm:py-3.5 font-mono text-[11px] sm:text-[13px] leading-[1.7] text-transparent caret-emerald-400 outline-none overflow-auto whitespace-pre selection:bg-emerald-500/20"
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* ── Terminal ───────────────────────────────────────── */}
      <div className="bg-zinc-900/40 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between px-3 sm:px-5 py-1.5 sm:py-2 border-b border-zinc-800/50">
          <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-600">
            Terminal
          </span>
          {status === "ready" && (
            <span className="font-mono text-[9px] sm:text-[10px] text-zinc-700 hidden sm:block">
              {"\u2318"}+Enter to run file
            </span>
          )}
        </div>

        {/* Output */}
        <div
          ref={termRef}
          className="h-[100px] sm:h-[130px] overflow-y-auto px-3 sm:px-5 py-2 font-mono text-[11px] sm:text-[13px] leading-[1.7]"
          onClick={() => termInputRef.current?.focus()}>
          {output.map(line => (
            <div
              key={line.id}
              className={
                line.type === "cmd"
                  ? "text-zinc-200"
                  : line.type === "stderr"
                    ? "text-red-400"
                    : line.type === "info"
                      ? "text-zinc-600"
                      : "text-zinc-400"
              }>
              {line.type === "cmd" ? (
                <>
                  <span className="text-emerald-600">{"\u276F"} </span>
                  {line.text.replace(/^\$ /, "")}
                </>
              ) : (
                renderAnsi(line.text)
              )}
            </div>
          ))}

          {status === "running" && (
            <div className="mt-1">
              <span className="inline-block w-2 h-3.5 -mb-0.5 bg-emerald-500/70 animate-pulse" />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 border-t border-zinc-800/50">
          <span className="text-emerald-600 font-mono text-[11px] sm:text-[13px] font-bold select-none">
            {"\u276F"}
          </span>
          <input
            ref={termInputRef}
            type="text"
            value={termInput}
            onChange={e => setTermInput(e.target.value)}
            onKeyDown={handleTermKeyDown}
            disabled={status !== "ready"}
            placeholder={status === "ready" ? "Type a command..." : "Wait..."}
            className="
              flex-1 bg-transparent text-zinc-200 font-mono text-[11px] sm:text-[13px]
              outline-none placeholder:text-zinc-700 disabled:opacity-50
              caret-emerald-400
            "
          />
          {status === "running" && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-emerald-400" />
          )}
        </div>
      </div>
    </div>
  );
}
