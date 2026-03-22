export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-xs font-bold">&gt;_</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-100">jiki</h1>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          v0.1.0
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>In-browser Node.js runtime</span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
