import { useState } from "react";
import { useNextContainer, type RouterMode } from "./hooks/useNextContainer";
import { BrowserWindow, CodeEditor, FileExplorer, Terminal } from "@run0/jiki-ui";
import { HMRLog } from "./components/HMRLog";

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    htmlSrc,
    previewUrl,
    currentPath,
    hmrEvents,
    hmrFlash,
    routerMode,
    installing,
    canGoBack,
    canGoForward,
    navigateTo,
    goBack,
    goForward,
    refresh,
    selectFile,
    saveFile,
    clearTerminal,
    clearHMRLog,
    toggleRouterMode,
    installPackage,
  } = useNextContainer();

  const [pkgInput, setPkgInput] = useState("");

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">Starting Next.js dev server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      {showHeader && (
        <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">jiki</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Next.js
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Router Mode Toggle - simplified */}
            <div className="flex items-center bg-zinc-800/50 rounded p-0.5">
              {(["app", "pages"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => toggleRouterMode(mode)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                    routerMode === mode
                      ? "bg-blue-500/15 text-blue-400"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {mode === "app" ? "App" : "Pages"}
                </button>
              ))}
            </div>

            {/* Package Install - simplified */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = pkgInput.trim();
                if (name) {
                  installPackage(name);
                  setPkgInput("");
                }
              }}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                value={pkgInput}
                onChange={(e) => setPkgInput(e.target.value)}
                placeholder="+ package"
                disabled={installing}
                className="w-24 px-2 py-0.5 text-[10px] font-mono bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
              />
            </form>

            {/* HMR status */}
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${hmrFlash ? 'bg-yellow-400' : 'bg-emerald-500'}`} />
              HMR
            </span>
          </div>
        </header>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: explorer + editor + bottom panels */}
        <div className="w-[460px] flex-shrink-0 flex flex-col border-r border-zinc-800">
          {/* File explorer */}
          <div
            className="flex-shrink-0 border-b border-zinc-800"
            style={{ maxHeight: "220px" }}
          >
            <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Explorer
              </span>
              <span className="text-[10px] text-zinc-600 font-mono">
                /{routerMode === "app" ? "app" : "pages"}
              </span>
            </div>
            <div
              className="overflow-y-auto p-0.5"
              style={{ maxHeight: "190px" }}
            >
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onSelect={selectFile}
                accentColor="blue"
                variant="compact"
              />
            </div>
          </div>

          {/* Code editor */}
          <div className="flex-1 min-h-0 border-b border-zinc-800">
            <CodeEditor
              filename={selectedFile}
              content={fileContent}
              onSave={saveFile}
              accentColor="blue"
            />
          </div>

          {/* Bottom: HMR log + Terminal side-by-side */}
          <div className="h-36 flex-shrink-0 flex border-t border-zinc-800">
            <div className="flex-1 border-r border-zinc-800">
              <HMRLog events={hmrEvents} onClear={clearHMRLog} />
            </div>
            <div className="flex-1">
              <Terminal lines={terminal} onClear={clearTerminal} accentColor="blue" variant="compact" title="Output" lineStyles={{ info: 'text-emerald-400 italic' }} />
            </div>
          </div>
        </div>

        {/* Right panel: browser preview */}
        <div className="flex-1 min-w-0 p-3">
          <BrowserWindow
            title="Next.js App"
            htmlSrc={htmlSrc}
            previewUrl={previewUrl ?? undefined}
            url={currentPath}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={goBack}
            onForward={goForward}
            onRefresh={refresh}
            onNavigate={navigateTo}
          />
        </div>
      </div>
    </div>
  );
}
