interface Props {
  onRunAll: () => void;
  isRunning: boolean;
}

export function Header({ onRunAll, isRunning }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-violet-500/20 flex items-center justify-center">
            <span className="text-violet-400 text-xs font-bold">#</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-100">Crypto Toolkit</h1>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
          jiki
        </span>
      </div>
      <button
        onClick={onRunAll}
        disabled={isRunning}
        className={`
          text-xs px-3 py-1.5 rounded font-medium transition-colors
          ${isRunning
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30"}
        `}
      >
        {isRunning ? "Running..." : "Run All Demos"}
      </button>
    </header>
  );
}
