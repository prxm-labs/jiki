import { useTutorialContainer } from "./hooks/useTutorialContainer";
import { CodeEditor, Terminal, FileExplorer } from '@run0/jiki-ui';
import { LessonList } from "./components/LessonList";
import { InstructionPanel } from "./components/InstructionPanel";

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    currentLesson,
    completedLessons,
    taskResults,
    isValidating,
    lessons,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
    switchLesson,
    validate,
    resetLesson,
  } = useTutorialContainer();

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">Booting container...</p>
        </div>
      </div>
    );
  }

  const lesson = lessons[currentLesson];
  const isComplete = completedLessons.has(currentLesson);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showHeader && (
        <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">jiki</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Tutorial
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
              <span>{completedLessons.size}/{lessons.length} completed</span>
              <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/60 rounded-full transition-all" style={{ width: `${(completedLessons.size / lessons.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: lesson list */}
        <div className="w-44 flex-shrink-0 border-r border-zinc-800">
          <LessonList
            lessons={lessons}
            currentLesson={currentLesson}
            completedLessons={completedLessons}
            onSelect={switchLesson}
          />
        </div>

        {/* File explorer */}
        <div className="w-44 flex-shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Files
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <FileExplorer files={files} selectedFile={selectedFile} onSelect={selectFile} accentColor="emerald" />
          </div>
        </div>

        {/* Center: code editor */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-zinc-800">
          <div className="flex-1 min-h-0">
            <CodeEditor filename={selectedFile} content={fileContent} onSave={saveFile} accentColor="emerald" />
          </div>
        </div>

        {/* Right: instructions + validation */}
        <div className="w-80 flex-shrink-0">
          <InstructionPanel
            instructions={lesson.instructions}
            taskResults={taskResults}
            tasks={lesson.tasks}
            onValidate={validate}
            onReset={resetLesson}
            isValidating={isValidating}
            isComplete={isComplete}
          />
        </div>
      </div>

      {/* Bottom: terminal */}
      <div className="h-56 flex-shrink-0 border-t border-zinc-800">
        <Terminal lines={terminal} onCommand={runCommand} onClear={clearTerminal} accentColor="emerald" />
      </div>
    </div>
  );
}
