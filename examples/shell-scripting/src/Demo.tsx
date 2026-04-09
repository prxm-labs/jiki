import { useState } from "react";
import { useShellContainer } from "./hooks/useShellContainer";
import { FileExplorer, Terminal } from "@run0/jiki-ui";
import { LessonSidebar } from "./components/LessonSidebar";

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const { terminal, files, isBooted, runCommand, clearTerminal } = useShellContainer();
  const [showFiles, setShowFiles] = useState(false);

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">Booting container...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showHeader && (
        <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">jiki</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Shell
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono hidden sm:block">Pipes · globs · redirects · variables</span>
          </div>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        {/* Left: lesson sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-zinc-800">
          <LessonSidebar onRunCommand={runCommand} />
        </div>

        {/* Center: terminal (primary) */}
        <div className="flex-1 min-w-0">
          <Terminal lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="emerald" />
        </div>
      </div>

      {/* Bottom: collapsible file explorer */}
      <div className="border-t border-zinc-800">
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            File Explorer
          </span>
          <span className="text-[10px] text-zinc-600">{showFiles ? "Hide" : "Show"}</span>
        </button>
        {showFiles && (
          <div className="h-48 overflow-y-auto border-t border-zinc-800/50 p-1">
            <FileExplorer files={files} selectedFile={null} onSelect={() => {}} accentColor="emerald" variant="compact" />
          </div>
        )}
      </div>
    </div>
  );
}
