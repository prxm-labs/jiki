import type { BuildResult } from "../hooks/useEsbuildContainer";

interface Props {
  result: BuildResult | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function BuildOutput({ result }: Props) {
  if (!result) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Build Output
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Hit Build to see output
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Build Output
        </span>
      </div>
      <div className="flex-1 flex min-h-0">
        {/* Bundled code */}
        <div className="flex-1 min-w-0 border-r border-zinc-800 overflow-auto">
          <pre className="p-3 text-[12px] font-mono text-zinc-300 leading-5 whitespace-pre-wrap break-all">
            {result.code}
          </pre>
        </div>

        {/* Stats */}
        <div className="w-48 flex-shrink-0 p-3 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Stats
          </div>
          {[
            { label: "Source", value: formatBytes(result.stats.originalSize) },
            { label: "Bundle", value: formatBytes(result.stats.bundleSize) },
            {
              label: "Reduction",
              value: `${result.stats.reduction}%`,
              color: result.stats.reduction > 0 ? "text-emerald-400" : "text-zinc-400",
            },
            { label: "Files", value: String(result.stats.fileCount) },
            { label: "Time", value: `${result.stats.buildTimeMs}ms` },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-[10px] text-zinc-500">{stat.label}</div>
              <div className={`text-sm font-mono font-medium ${stat.color || "text-zinc-200"}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
