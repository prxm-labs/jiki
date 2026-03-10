import { useErrorOverlayContainer } from "./hooks/useErrorOverlayContainer";
import { CodeEditor, Terminal, BrowserWindow } from "jiki-ui";

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    isBooted,
    htmlSrc,
    selectedFile,
    fileContent,
    saveFile,
    runCommand,
    clearTerminal,
    refresh,
  } = useErrorOverlayContainer();

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              Error Overlay
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono">Trigger errors in the preview</span>
          </div>
        </header>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-zinc-800">
          <div className="flex-1 min-h-0 border-b border-zinc-800">
            <CodeEditor filename={selectedFile} content={fileContent} onSave={saveFile} accentColor="violet" />
          </div>
          <div className="h-44 flex-shrink-0">
            <Terminal variant="compact" lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="violet" />
          </div>
        </div>
        <div className="flex-1 min-w-0 p-3">
          <BrowserWindow
            htmlSrc={htmlSrc}
            url="/"
            canGoBack={false}
            canGoForward={false}
            onBack={() => {}}
            onForward={() => {}}
            onRefresh={refresh}
            onNavigate={() => {}}
            title="Error Overlay"
          />
        </div>
      </div>
    </div>
  );
}
