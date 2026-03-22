import { useContainer } from './useContainer';
import { CodeEditor, Terminal, FileExplorer } from '@run0/jiki-ui';

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
  } = useContainer();

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Node.js
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 font-mono hidden sm:block">In-browser Node.js runtime</span>
          </div>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar - File Explorer */}
        <div className="w-64 flex-shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Explorer
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <FileExplorer
              files={files}
              selectedFile={selectedFile}
              onSelect={selectFile}
              accentColor="emerald"
            />
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Code Editor */}
          <div className="flex-1 min-h-0 border-b border-zinc-800">
            <CodeEditor
              filename={selectedFile}
              content={fileContent}
              onSave={saveFile}
              accentColor="emerald"
            />
          </div>

          {/* Terminal */}
          <div className="h-72 flex-shrink-0">
            <Terminal
              lines={terminal}
              onCommand={runCommand}
              onClear={clearTerminal}
              accentColor="emerald"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
