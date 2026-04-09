import { usePluginDemo } from "./hooks/usePluginDemo";
import { CodeEditor, Terminal, FileExplorer } from '@run0/jiki-ui';

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const { terminal, files, selectedFile, fileContent, isBooted, selectFile, saveFile, runCommand, clearTerminal } = usePluginDemo();

  if (!isBooted) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
        <p className="mt-3 text-[11px] text-zinc-500 font-mono">Booting container...</p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showHeader && (
        <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">jiki</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">Plugin System</span>
          </div>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        <div className="w-48 flex-shrink-0 border-r border-zinc-800 overflow-y-auto">
          <FileExplorer files={files} selectedFile={selectedFile} onSelect={selectFile} accentColor="violet" />
        </div>
        <div className="flex-1 min-w-0">
          <CodeEditor filename={selectedFile} content={fileContent} onSave={saveFile} accentColor="violet" />
        </div>
      </div>
      <div className="h-56 flex-shrink-0 border-t border-zinc-800">
        <Terminal lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="violet" />
      </div>
    </div>
  );
}
