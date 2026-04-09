import { usePrettierContainer } from "./hooks/usePrettierContainer";
import { CodeEditor, FileExplorer, Terminal } from '@run0/jiki-ui';

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    formatting,
    prettierReady,
    lastResult,
    isFormattable,
    selectFile,
    saveFile,
    formatFile,
    formatAll,
    runCommand,
    clearTerminal,
  } = usePrettierContainer();

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-pink-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">Booting container...</p>
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
              Prettier
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${prettierReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              {prettierReady ? 'Ready' : 'Loading...'}
            </span>
          </div>
        </header>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Explorer + Editor + Terminal */}
        <div className="w-[440px] flex-shrink-0 flex flex-col border-r border-zinc-800">
          {/* File explorer */}
          <div className="flex-shrink-0 border-b border-zinc-800" style={{ maxHeight: "220px" }}>
            <div className="px-3 py-1.5 border-b border-zinc-800">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Explorer
              </span>
            </div>
            <div className="overflow-y-auto p-0.5" style={{ maxHeight: "190px" }}>
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onSelect={selectFile}
                accentColor="pink"
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
              accentColor="pink"
            />
          </div>

          {/* Terminal */}
          <div className="h-44 flex-shrink-0">
            <Terminal
              variant="compact"
              lines={terminal}
              onCommand={runCommand}
              onClear={clearTerminal}
              accentColor="pink"
            />
          </div>
        </div>

        {/* Right: Format panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Format toolbar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectedFile && formatFile(selectedFile)}
                disabled={!prettierReady || formatting || !isFormattable}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 border border-pink-500/20"
              >
                {formatting ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-pink-400/30 border-t-pink-400" />
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h16M4 12h10M4 17h6" strokeLinecap="round" />
                  </svg>
                )}
                Format File
              </button>
              <button
                onClick={formatAll}
                disabled={!prettierReady || formatting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" />
                </svg>
                Format All
              </button>
            </div>
            {lastResult && (
              <div className="flex items-center gap-2 text-[11px]">
                {lastResult.changed ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Formatted
                  </span>
                ) : (
                  <span className="text-zinc-500">No changes needed</span>
                )}
                <span className="text-zinc-600">{lastResult.duration}ms</span>
              </div>
            )}
          </div>

          {/* Diff / formatted output */}
          <div className="flex-1 overflow-auto">
            {lastResult ? (
              <div className="h-full flex flex-col">
                {lastResult.changed ? (
                  <div className="flex-1 flex min-h-0">
                    {/* Before */}
                    <div className="flex-1 flex flex-col border-r border-zinc-800 min-w-0">
                      <div className="flex-shrink-0 px-3 py-1.5 bg-red-500/5 border-b border-zinc-800">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">Before</span>
                      </div>
                      <pre className="flex-1 overflow-auto p-3 text-[11px] leading-4 font-mono text-zinc-400 whitespace-pre-wrap break-all">
                        {lastResult.original}
                      </pre>
                    </div>
                    {/* After */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex-shrink-0 px-3 py-1.5 bg-emerald-500/5 border-b border-zinc-800">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">After</span>
                      </div>
                      <pre className="flex-1 overflow-auto p-3 text-[11px] leading-4 font-mono text-zinc-200 whitespace-pre-wrap break-all">
                        {lastResult.formatted}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-2">&#x2728;</div>
                      <p className="text-sm text-zinc-400">File is already formatted</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        Matches .prettierrc configuration
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-xs">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-pink-500/10 mb-4">
                    <svg className="w-6 h-6 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 7h16M4 12h10M4 17h6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-1">
                    Prettier Code Formatter
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Select a file from the explorer and click <span className="text-pink-400 font-medium">Format File</span> to
                    see the before/after diff. Configuration is read from <code className="px-1 py-0.5 bg-zinc-800 rounded text-[10px] text-pink-300">.prettierrc</code>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
