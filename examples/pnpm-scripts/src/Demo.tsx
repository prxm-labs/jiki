import { useState, useCallback } from "react";
import { useContainer } from "./useContainer";
import { Terminal } from "@run0/jiki-ui";

const QUICK_ACTIONS = [
  { label: "lodash", pkg: "lodash" },
  { label: "pluralize", pkg: "pluralize" },
  { label: "uuid", pkg: "uuid" },
  { label: "ms", pkg: "ms" },
  { label: "minimist", pkg: "minimist" },
];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    packageJson,
    script,
    isBooted,
    isRunning,
    setPackageJson,
    setScript,
    runScript,
    runCommand,
    installPackage,
    clearTerminal,
  } = useContainer();

  const [installInput, setInstallInput] = useState("");

  const handleInstall = useCallback(async () => {
    if (!installInput.trim() || isRunning) return;
    const pkg = installInput.trim();
    setInstallInput("");
    await installPackage(pkg);
  }, [installInput, isRunning, installPackage]);

  const handleQuickInstall = useCallback(
    async (pkg: string) => {
      if (isRunning) return;
      await installPackage(pkg);
    },
    [isRunning, installPackage]
  );

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
              pnpm Scripts
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono hidden sm:block">Install packages · run scripts</span>
          </div>
        </header>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-1/2 flex flex-col border-r border-zinc-800 min-h-0">
          <div className="flex flex-col h-[35%] min-h-0 border-b border-zinc-800">
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800 flex-shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                package.json
              </span>
            </div>
            <textarea
              value={packageJson}
              onChange={(e) => setPackageJson(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed text-amber-400 outline-none min-h-0"
            />
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800 flex-shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                index.js
              </span>
              <button
                onClick={runScript}
                disabled={isRunning}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded"
              >
                {isRunning ? "Running..." : "Run Script"}
              </button>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed text-zinc-300 outline-none min-h-0"
            />
          </div>
        </div>

        <div className="w-1/2 flex flex-col min-h-0">
          <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-mono flex-shrink-0">
                Install
              </span>
              <input
                type="text"
                value={installInput}
                onChange={(e) => setInstallInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInstall()}
                placeholder="package-name"
                disabled={isRunning}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[13px] font-mono text-zinc-200 outline-none focus:border-amber-500/40 placeholder:text-zinc-700 disabled:opacity-50"
              />
              <button
                onClick={handleInstall}
                disabled={isRunning || !installInput.trim()}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded"
              >
                Add
              </button>
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
              <span className="text-[10px] text-zinc-600 mr-1">Quick:</span>
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.pkg}
                  onClick={() => handleQuickInstall(qa.pkg)}
                  disabled={isRunning}
                  className="px-2 py-0.5 text-[10px] font-mono bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 rounded hover:text-amber-400 hover:border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  + {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal - use jiki-ui */}
          <div className="flex-1 min-h-0">
            <Terminal lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}
