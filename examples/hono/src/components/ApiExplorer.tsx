import { useState } from 'react';

export interface RouteDefinition {
  method: string;
  path: string;
  description: string;
}

export interface ApiResponse {
  status: number;
  body: string;
  time: number;
}

interface Props {
  routes: RouteDefinition[];
  onTestRoute: (method: string, path: string) => Promise<ApiResponse | null>;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'bg-emerald-500/20 text-emerald-400';
  if (code >= 400 && code < 500) return 'bg-amber-500/20 text-amber-400';
  return 'bg-red-500/20 text-red-400';
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function ApiExplorer({ routes, onTestRoute }: Props) {
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async (method: string, path: string) => {
    const key = `${method} ${path}`;
    setActiveRoute(key);
    setResponse(null);
    setLoading(true);
    const res = await onTestRoute(method, path);
    setResponse(res);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          API Explorer
        </span>
        {response && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(response.status)}`}>
            {response.status} &middot; {response.time}ms
          </span>
        )}
      </div>

      <div className="flex-shrink-0 p-2 border-b border-zinc-800 space-y-1.5">
        {routes.map((route) => {
          const key = `${route.method} ${route.path}`;
          const isActive = activeRoute === key;
          return (
            <button
              key={key}
              onClick={() => handleTest(route.method, route.path)}
              disabled={loading}
              className={`
                w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-[12px] transition-colors
                ${isActive ? 'bg-zinc-800 ring-1 ring-zinc-700' : 'hover:bg-zinc-900'}
                disabled:opacity-50
              `}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${METHOD_COLORS[route.method] || METHOD_COLORS.GET}`}>
                {route.method}
              </span>
              <span className="font-mono text-zinc-300 flex-1 truncate">{route.path}</span>
              <span className="text-zinc-600 text-[11px] hidden sm:inline">{route.description}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-5">
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-orange-400" />
            <span>Sending request...</span>
          </div>
        )}
        {!loading && response && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColor(response.status)}`}>
                {response.status}
              </span>
              <span className="text-zinc-500">{response.time}ms</span>
            </div>
            <pre className="text-orange-400 whitespace-pre-wrap break-words">
              {formatJson(response.body)}
            </pre>
          </div>
        )}
        {!loading && !response && (
          <div className="text-zinc-600 text-center mt-8">
            <p className="text-sm">Select a route above to test it</p>
            <p className="text-xs mt-1">Responses are processed in the virtual runtime</p>
          </div>
        )}
      </div>
    </div>
  );
}
