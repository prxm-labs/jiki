interface Props {
  onRunTests: () => void;
  isRunning: boolean;
  passCount: number;
  failCount: number;
  hasResults: boolean;
}

export function Header({ onRunTests, isRunning, passCount, failCount, hasResults }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-orange-500/20 flex items-center justify-center">
            <span className="text-orange-400 text-xs font-bold">&gt;_</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-100">jiki</h1>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
          Jest Demo
        </span>
      </div>

      <div className="flex items-center gap-4">
        {hasResults && (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {passCount} passed
            </span>
            {failCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                {failCount} failed
              </span>
            )}
          </div>
        )}
        <button
          onClick={onRunTests}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            isRunning
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/40'
          }`}
        >
          {isRunning ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-orange-400" />
              Running...
            </>
          ) : (
            <>
              <span className="text-sm">&#9654;</span>
              Run Tests
            </>
          )}
        </button>
      </div>
    </header>
  );
}
