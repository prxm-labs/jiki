import type { Lesson } from "../lessons";

interface Props {
  lessons: Lesson[];
  currentLesson: number;
  completedLessons: Set<number>;
  onSelect: (idx: number) => void;
}

export function LessonList({ lessons, currentLesson, completedLessons, onSelect }: Props) {
  const maxUnlocked = Math.max(0, ...Array.from(completedLessons)) + 1;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Lessons
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {lessons.map((lesson, idx) => {
          const isCompleted = completedLessons.has(idx);
          const isCurrent = idx === currentLesson;
          const isLocked = idx > maxUnlocked && !isCompleted;

          return (
            <button
              key={idx}
              onClick={() => !isLocked && onSelect(idx)}
              disabled={isLocked}
              className={`
                w-full text-left px-3 py-2 flex items-center gap-2 transition-colors
                ${isCurrent ? "bg-cyan-500/10" : "hover:bg-zinc-800/50"}
                ${isLocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <span className="text-sm flex-shrink-0 w-5 text-center">
                {isCompleted ? (
                  <span className="text-emerald-400">&#x2713;</span>
                ) : isCurrent ? (
                  <span className="text-cyan-400">&#x25B6;</span>
                ) : (
                  <span className="text-zinc-600">&#x25CB;</span>
                )}
              </span>
              <div className="min-w-0">
                <div className={`text-[13px] font-medium truncate ${isCurrent ? "text-cyan-300" : "text-zinc-300"}`}>
                  {idx + 1}. {lesson.shortTitle}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">{lesson.title}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
