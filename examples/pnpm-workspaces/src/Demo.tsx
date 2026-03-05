import { useWorkspacesContainer } from './hooks/useWorkspacesContainer';
import { CodeEditor, Terminal, FileExplorer } from 'jiki-ui';

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    workspaces,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
  } = useWorkspacesContainer();

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">Discovering workspaces...</p>
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
              pnpm Workspaces
            </span>
          </div>
          <div className="flex items-center gap-2">
            {workspaces.map((ws) => (
              <span
                key={ws.name}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50"
              >
                {ws.name}
              </span>
            ))}
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
              accentColor="amber"
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
              accentColor="amber"
            />
          </div>

          {/* Terminal */}
          <div className="h-72 flex-shrink-0">
            <Terminal
              lines={terminal}
              onCommand={runCommand}
              onClear={clearTerminal}
              accentColor="amber"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
