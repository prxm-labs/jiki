import type { BuildConfig } from "../hooks/useEsbuildContainer";

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
  onBuild: () => void;
  isBuilding: boolean;
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`
              text-[11px] font-mono px-2 py-1 rounded transition-colors
              ${value === opt
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"}
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BuildConfigPanel({ config, onChange, onBuild, isBuilding }: Props) {
  const update = (partial: Partial<BuildConfig>) => onChange({ ...config, ...partial });

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Build Config
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <RadioGroup
          label="Format"
          options={["esm", "cjs", "iife"]}
          value={config.format}
          onChange={(v) => update({ format: v as BuildConfig["format"] })}
        />
        <RadioGroup
          label="Platform"
          options={["browser", "node", "neutral"]}
          value={config.platform}
          onChange={(v) => update({ platform: v as BuildConfig["platform"] })}
        />

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.minify}
              onChange={(e) => update({ minify: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500/30"
            />
            <span className="text-[12px] text-zinc-300">Minify</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.bundle}
              onChange={(e) => update({ bundle: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500/30"
            />
            <span className="text-[12px] text-zinc-300">Bundle</span>
          </label>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Externals
          </label>
          <input
            type="text"
            value={config.externals}
            onChange={(e) => update({ externals: e.target.value })}
            placeholder="react, react-dom"
            className="
              w-full text-[12px] font-mono px-2.5 py-1.5 rounded
              bg-zinc-800 border border-zinc-700 text-zinc-300
              placeholder:text-zinc-600 outline-none
              focus:border-yellow-500/50
            "
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Entry Point
          </label>
          <input
            type="text"
            value={config.entryPoint}
            onChange={(e) => update({ entryPoint: e.target.value })}
            className="
              w-full text-[12px] font-mono px-2.5 py-1.5 rounded
              bg-zinc-800 border border-zinc-700 text-zinc-300
              outline-none focus:border-yellow-500/50
            "
          />
        </div>
      </div>

      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={onBuild}
          disabled={isBuilding}
          className={`
            w-full text-sm py-2 rounded font-medium transition-colors
            ${isBuilding
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30"}
          `}
        >
          {isBuilding ? "Building..." : "Build"}
        </button>
      </div>
    </div>
  );
}
