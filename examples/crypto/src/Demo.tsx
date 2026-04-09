import { useCryptoContainer } from "./hooks/useCryptoContainer";
import { CodeEditor, Terminal } from '@run0/jiki-ui';
import { OutputPanel } from "./components/OutputPanel";

const DEMO_FILES = ["hash-demo.js", "hmac-demo.js", "random-demo.js", "file-integrity.js"];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    results,
    selectedFile,
    fileContent,
    isBooted,
    isRunningAll,
    runCommand,
    runAll,
    selectFile,
    saveFile,
    clearTerminal,
  } = useCryptoContainer();

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
              Crypto
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={runAll} disabled={isRunningAll} className="px-2.5 py-1 text-[10px] font-mono font-medium rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-40 transition-colors">
              {isRunningAll ? 'Running...' : 'Run All'}
            </button>
          </div>
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        {/* Left: file tabs + editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
          {/* File tabs */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
            {DEMO_FILES.map((name) => (
              <button
                key={name}
                onClick={() => selectFile(`/${name}`)}
                className={`
                  text-[12px] font-mono px-2.5 py-1 rounded transition-colors
                  ${selectedFile === `/${name}`
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}
                `}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor filename={selectedFile} content={fileContent} onSave={saveFile} accentColor="emerald" />
          </div>
        </div>

        {/* Right: output panel */}
        <div className="w-96 flex-shrink-0">
          <OutputPanel results={results} />
        </div>
      </div>

      {/* Bottom: terminal */}
      <div className="h-56 flex-shrink-0 border-t border-zinc-800">
        <Terminal lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="emerald" />
      </div>
    </div>
  );
}
