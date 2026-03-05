import { useState } from "react";
import { useServerDemo } from "./hooks/useServerDemo";
import {
  Terminal,
  MobileTabBar,
  CodeIcon,
  PreviewIcon,
  TerminalIcon,
  useMediaQuery,
} from "jiki-ui";
import { ApiExplorer, type RouteDefinition } from "./components/ApiExplorer";

const ROUTES: RouteDefinition[] = [
  { method: "GET", path: "/", description: "API info" },
  { method: "GET", path: "/api/users", description: "List all users" },
  { method: "GET", path: "/api/time", description: "Current time" },
  { method: "GET", path: "/api/random", description: "Random data" },
];

const STATUS_DOT: Record<string, string> = {
  idle: "bg-zinc-600",
  installing: "bg-amber-400 animate-pulse",
  running: "bg-emerald-400",
  error: "bg-red-400",
};

const ACCENT = "emerald" as const;

const MOBILE_TABS = [
  { id: "code", label: "Server", icon: <CodeIcon /> },
  { id: "api", label: "API", icon: <PreviewIcon /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon /> },
];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    serverStatus,
    serverCode,
    testRoute,
    runCommand,
    clearTerminal,
  } = useServerDemo();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activeTab, setActiveTab] = useState("code");

  const header = showHeader && (
    <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">
          jiki
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Express
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${STATUS_DOT[serverStatus]}`}
        />
        <span className="text-xs text-zinc-400 capitalize">
          {serverStatus}
        </span>
      </div>
    </header>
  );

  const codePanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          server.js
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/60">
          read-only
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-3 font-mono text-[12px] leading-5 text-zinc-400 whitespace-pre">
          {serverCode}
        </pre>
      </div>
    </div>
  );

  /* ── Mobile layout ──────────────────────────────────────────── */
  if (!isDesktop) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {header}
        <MobileTabBar
          tabs={MOBILE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor={ACCENT}
        />
        <div className="flex-1 min-h-0">
          {activeTab === "code" && codePanel}
          {activeTab === "api" && (
            <ApiExplorer routes={ROUTES} onTestRoute={testRoute} />
          )}
          {activeTab === "terminal" && (
            <Terminal
              lines={terminal}
              onCommand={runCommand}
              onClear={clearTerminal}
              accentColor={ACCENT}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col">
      {header}

      <div className="flex-1 grid grid-cols-2 min-h-0">
        <div className="border-r border-zinc-800 flex flex-col min-h-0">
          {codePanel}
        </div>
        <ApiExplorer routes={ROUTES} onTestRoute={testRoute} />
      </div>

      <div className="h-[220px] flex-shrink-0 border-t border-zinc-800">
        <Terminal
          lines={terminal}
          onCommand={runCommand}
          onClear={clearTerminal}
          accentColor={ACCENT}
        />
      </div>
    </div>
  );
}
