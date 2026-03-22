import type { CryptoResult } from "../hooks/useCryptoContainer";

interface Props {
  results: CryptoResult[];
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  hash: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  hmac: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  random: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  integrity: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
};

export function OutputPanel({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Results
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Run a demo to see results
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Results
        </span>
        <span className="text-[11px] text-zinc-600">{results.length} items</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {results.map((result) => {
          const colors = TYPE_COLORS[result.type] || TYPE_COLORS.hash;
          return (
            <div
              key={result.id}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>
                  {result.type}
                </span>
                <span className="text-xs font-medium text-zinc-300">{result.label}</span>
              </div>
              <div className="space-y-1">
                {Object.entries(result.details).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-[12px] font-mono">
                    <span className="text-zinc-500 flex-shrink-0">{key}:</span>
                    <span className="text-zinc-300 break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
