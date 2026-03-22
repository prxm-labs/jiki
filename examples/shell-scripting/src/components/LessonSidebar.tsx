import { useState } from "react";

interface Lesson {
  title: string;
  description: string;
  commands: string[];
}

const LESSONS: Lesson[] = [
  {
    title: "Pipes",
    description: "Chain command output as input to the next command",
    commands: [
      'echo "hello world" | cat',
      "cat data/logs.txt | grep ERROR",
      "cat data/logs.txt | grep INFO | cat",
    ],
  },
  {
    title: "Chains",
    description: "Run commands conditionally with && and ||",
    commands: [
      'mkdir -p output && echo "Created output/"',
      'false || echo "Fallback: previous command failed"',
      'true && echo "Step 1" ; echo "Step 2 (always runs)"',
    ],
  },
  {
    title: "Globs",
    description: "Match files using wildcard patterns",
    commands: [
      "ls src/*.js",
      "cat src/*.js",
      "ls data/*",
    ],
  },
  {
    title: "Variables",
    description: "Set and use environment variables",
    commands: [
      'export GREETING=Hello && echo "$GREETING, world!"',
      "export APP_NAME=jiki && echo \"Running ${APP_NAME}\"",
      "env",
    ],
  },
  {
    title: "Redirects",
    description: "Write command output to files",
    commands: [
      'echo "First line" > output/log.txt',
      'echo "Second line" >> output/log.txt',
      "cat output/log.txt",
    ],
  },
  {
    title: "Scripts",
    description: "Combine everything in a build script",
    commands: [
      "cat scripts/build.sh",
      "node -e \"$(cat scripts/build.sh)\"",
      "ls dist/",
    ],
  },
];

interface Props {
  onRunCommand: (cmd: string) => Promise<void>;
}

export function LessonSidebar({ onRunCommand }: Props) {
  const [activeLesson, setActiveLesson] = useState<number | null>(null);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Lessons
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {LESSONS.map((lesson, idx) => (
          <div key={idx} className="border-b border-zinc-800/50">
            <button
              onClick={() => setActiveLesson(activeLesson === idx ? null : idx)}
              className={`
                w-full text-left px-3 py-2.5 transition-colors
                ${activeLesson === idx ? "bg-amber-500/10" : "hover:bg-zinc-800/50"}
              `}
            >
              <div className="text-[13px] font-medium text-zinc-200">{lesson.title}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{lesson.description}</div>
            </button>
            {activeLesson === idx && (
              <div className="px-3 pb-3 space-y-1.5">
                {lesson.commands.map((cmd, ci) => (
                  <button
                    key={ci}
                    onClick={() => onRunCommand(cmd)}
                    className="
                      w-full text-left px-2.5 py-1.5 rounded
                      bg-zinc-800/50 hover:bg-zinc-700/50
                      text-[12px] font-mono text-amber-300/80 hover:text-amber-300
                      transition-colors truncate
                    "
                    title={cmd}
                  >
                    $ {cmd}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
