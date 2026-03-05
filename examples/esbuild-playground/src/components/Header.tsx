interface Props {
  isBuilding: boolean;
}

export function Header({ isBuilding }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-yellow-500/20 flex items-center justify-center">
            <span className="text-yellow-400 text-xs font-bold">e</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-100">esbuild Playground</h1>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          jiki
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isBuilding && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-yellow-400" />
            <span className="text-xs text-zinc-400">Building...</span>
          </div>
        )}
      </div>
    </header>
  );
}
