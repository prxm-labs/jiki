export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 text-xs font-bold">$</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-100">Shell Scripting</h1>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          jiki
        </span>
      </div>
      <span className="text-xs text-zinc-500">Pipes, chains, globs, redirects & variables</span>
    </header>
  );
}
