import { useServerDemo } from './hooks/useServerDemo';
import { Terminal } from '@run0/jiki-ui';
import { ApiExplorer, type RouteDefinition } from './components/ApiExplorer';

const ROUTES: RouteDefinition[] = [
  { method: 'GET', path: '/', description: 'API info + middleware list' },
  { method: 'GET', path: '/api/users', description: 'List all users' },
  { method: 'GET', path: '/api/time', description: 'Current time + request ID' },
  { method: 'GET', path: '/api/random', description: 'Random data + request ID' },
];

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-zinc-600',
  installing: 'bg-amber-400 animate-pulse',
  running: 'bg-orange-400',
  error: 'bg-red-400',
};

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const { terminal, serverStatus, serverCode, testRoute, runCommand, clearTerminal } = useServerDemo();

  return (
    <div className="h-full flex flex-col">
      {showHeader && (
        <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">jiki</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Hono
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${STATUS_DOT[serverStatus]}`} />
            <span className="text-xs text-zinc-400 capitalize">{serverStatus}</span>
          </div>
        </header>
      )}

      <div className="flex-1 grid grid-cols-2 min-h-0">
        <div className="border-r border-zinc-800 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">server.js</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500/60">read-only</span>
          </div>
          <div className="flex-1 overflow-auto">
            <pre className="p-3 font-mono text-[12px] leading-5 text-zinc-400 whitespace-pre">{serverCode}</pre>
          </div>
        </div>

        <ApiExplorer routes={ROUTES} onTestRoute={testRoute} />
      </div>

      <div className="h-[220px] flex-shrink-0 border-t border-zinc-800">
        <Terminal lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="orange" lineStyles={{ info: 'text-amber-400 italic' }} />
      </div>
    </div>
  );
}
