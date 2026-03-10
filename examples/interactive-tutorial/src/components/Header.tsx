import type { Lesson } from "../lessons";

interface Props {
  currentLesson: number;
  completedLessons: Set<number>;
  totalLessons: number;
}

export function Header({ currentLesson, completedLessons, totalLessons }: Props) {
  const completedCount = completedLessons.size;
  const pct = Math.round((completedCount / totalLessons) * 100);

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-cyan-500/20 flex items-center justify-center">
            <span className="text-cyan-400 text-xs font-bold">?</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-100">jiki Interactive Tutorial</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400">
          {completedCount}/{totalLessons} lessons
        </span>
        <div className="w-32 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </header>
  );
}
