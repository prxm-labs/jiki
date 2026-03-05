import { useJestRunner } from './hooks/useJestRunner';
import { CodeEditor, FileExplorer, Terminal } from 'jiki-ui';
import { TestResults } from './components/TestResults';

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    isRunning,
    testResults,
    runTests,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
  } = useJestRunner();

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">Booting container...</p>
        </div>
      </div>
    );
  }

  const passCount = testResults.filter((r) => r.status === 'pass').length;
  const failCount = testResults.filter((r) => r.status === 'fail').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showHeader && (
        <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">jiki</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Jest
            </span>
          </div>
          <div className="flex items-center gap-3">
            {testResults.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-emerald-400">{passCount} passed</span>
                <span className="text-zinc-600">&middot;</span>
                <span className="text-red-400">{failCount} failed</span>
              </div>
            )}
            <button onClick={runTests} disabled={isRunning} className="px-2.5 py-1 text-[10px] font-mono font-medium rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-40 transition-colors">
              {isRunning ? 'Running...' : 'Run Tests'}
            </button>
          </div>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Explorer
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <FileExplorer files={files} selectedFile={selectedFile} onSelect={selectFile} accentColor="orange" variant="compact" />
          </div>
        </div>

        {/* Editor + Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 border-b border-zinc-800">
            <CodeEditor accentColor="orange" filename={selectedFile} content={fileContent} onSave={saveFile} />
          </div>
          <div className="h-64 flex-shrink-0">
            <Terminal accentColor="orange" lines={terminal} onCommand={runCommand} onClear={clearTerminal} />
          </div>
        </div>

        {/* Test Results */}
        <div className="w-72 flex-shrink-0 border-l border-zinc-800">
          <TestResults results={testResults} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}
