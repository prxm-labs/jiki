import type { TaskResult } from "../hooks/useTutorialContainer";

interface Props {
  instructions: string;
  taskResults: TaskResult[];
  tasks: { description: string }[];
  onValidate: () => void;
  onReset: () => void;
  isValidating: boolean;
  isComplete: boolean;
}

export function InstructionPanel({
  instructions,
  taskResults,
  tasks,
  onValidate,
  onReset,
  isValidating,
  isComplete,
}: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Instructions
        </span>
      </div>

      {/* Instructions text */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-[13px] text-zinc-300 leading-6 whitespace-pre-wrap">
          {instructions.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <div key={i} className="font-semibold text-zinc-100 mt-3 mb-1">
                  {line.slice(2, -2)}
                </div>
              );
            }
            if (line.startsWith("   Hint:") || line.startsWith("**Hint:**")) {
              return (
                <div key={i} className="text-amber-400/80 text-[12px] mt-1">
                  {line}
                </div>
              );
            }
            return <div key={i}>{line || "\u00A0"}</div>;
          })}
        </div>

        {/* Task checklist */}
        <div className="mt-6 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Tasks
          </div>
          {tasks.map((task, idx) => {
            const result = taskResults[idx];
            const passed = result?.passed;
            const checked = result !== undefined;

            return (
              <div
                key={idx}
                className={`
                  flex items-start gap-2 text-[13px] px-2.5 py-1.5 rounded
                  ${checked ? (passed ? "bg-emerald-500/10" : "bg-red-500/10") : "bg-zinc-800/30"}
                `}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {checked ? (
                    passed ? (
                      <span className="text-emerald-400">&#x2713;</span>
                    ) : (
                      <span className="text-red-400">&#x2717;</span>
                    )
                  ) : (
                    <span className="text-zinc-600">&#x25CB;</span>
                  )}
                </span>
                <span className={checked ? (passed ? "text-emerald-300" : "text-red-300") : "text-zinc-400"}>
                  {task.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3 border-t border-zinc-800">
        <button
          onClick={onValidate}
          disabled={isValidating}
          className={`
            flex-1 text-sm py-2 rounded font-medium transition-colors
            ${isComplete
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : isValidating
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"}
          `}
        >
          {isComplete ? "Completed!" : isValidating ? "Validating..." : "Validate"}
        </button>
        <button
          onClick={onReset}
          className="text-sm px-3 py-2 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
