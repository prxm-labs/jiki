import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";
import { LESSONS, type Task } from "../lessons";

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


export interface TaskResult {
  description: string;
  passed: boolean;
}

let lineId = 0;

export function useTutorialContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [currentLesson, setCurrentLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const refreshFiles = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const buildTree = (dirPath: string): FileEntry[] => {
      try {
        const entries = c.vfs.readdirSync(dirPath);
        return entries
          .filter((n) => !n.startsWith(".") && n !== "node_modules")
          .sort((a, b) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fullA).isDirectory();
            const bDir = c.vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fullPath = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = c.vfs.statSync(fullPath).isDirectory();
            return {
              name,
              path: fullPath,
              isDir,
              children: isDir ? buildTree(fullPath) : undefined,
            };
          });
      } catch {
        return [];
      }
    };
    setFiles(buildTree("/"));
  }, []);

  const clearVfs = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    try {
      for (const entry of c.vfs.readdirSync("/")) {
        if (entry === "." || entry === "..") continue;
        c.rm(`/${entry}`);
      }
    } catch { /* ignore */ }
  }, []);

  const loadLessonFiles = useCallback(
    (lessonIdx: number) => {
      const c = containerRef.current;
      if (!c) return;
      const lesson = LESSONS[lessonIdx];
      for (const [path, content] of Object.entries(lesson.starterFiles)) {
        c.writeFile(path, content);
      }
      refreshFiles();

      // Select first non-directory starter file
      const firstFile = Object.keys(lesson.starterFiles).find(
        (p) => !p.endsWith("/")
      );
      if (firstFile) {
        setSelectedFile(firstFile);
        setFileContent(lesson.starterFiles[firstFile]);
      } else {
        setSelectedFile(null);
        setFileContent("");
      }
    },
    [refreshFiles]
  );

  const bootContainer = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    // Load first lesson
    loadLessonFiles(0);

    setIsBooted(true);
    pushLine("info", `Lesson 1: ${LESSONS[0].title}`);
    pushLine("info", "Read the instructions on the right and complete the tasks.");
  }, [pushLine, loadLessonFiles]);

  const switchLesson = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= LESSONS.length) return;
      // Only allow switching to completed lessons or the next available one
      const maxUnlocked = Math.max(0, ...Array.from(completedLessons)) + 1;
      if (idx > maxUnlocked && !completedLessons.has(idx)) return;

      clearVfs();
      setCurrentLesson(idx);
      setTaskResults([]);
      linesRef.current = [];
      setTerminal([]);
      loadLessonFiles(idx);
      pushLine("info", `Lesson ${idx + 1}: ${LESSONS[idx].title}`);
    },
    [completedLessons, clearVfs, loadLessonFiles, pushLine]
  );

  const validate = useCallback(async () => {
    const c = containerRef.current;
    if (!c) return;

    setIsValidating(true);
    const lesson = LESSONS[currentLesson];
    const results: TaskResult[] = [];

    for (const task of lesson.tasks) {
      try {
        const passed = await task.check(c);
        results.push({ description: task.description, passed });
      } catch {
        results.push({ description: task.description, passed: false });
      }
    }

    setTaskResults(results);

    const allPassed = results.every((r) => r.passed);
    if (allPassed) {
      pushLine("info", "All tasks passed! Lesson complete.");
      setCompletedLessons((prev) => new Set([...prev, currentLesson]));
    } else {
      const failCount = results.filter((r) => !r.passed).length;
      pushLine("info", `${failCount} task(s) not yet complete. Keep going!`);
    }

    setIsValidating(false);
  }, [currentLesson, pushLine]);

  const resetLesson = useCallback(() => {
    clearVfs();
    setTaskResults([]);
    loadLessonFiles(currentLesson);
    linesRef.current = [];
    setTerminal([]);
    pushLine("info", `Lesson ${currentLesson + 1} reset to starter code.`);
  }, [currentLesson, clearVfs, loadLessonFiles, pushLine]);

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      pushLine("command", `$ ${cmd}`);
      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
        if (result.exitCode !== 0) {
          pushLine("info", `Process exited with code ${result.exitCode}`);
        }
      } catch (err) {
        pushLine("stderr", String(err));
      }
      refreshFiles();
    },
    [pushLine, refreshFiles]
  );

  const selectFile = useCallback(
    (path: string) => {
      const c = containerRef.current;
      if (!c) return;
      try {
        const content = c.readFile(path);
        setSelectedFile(path);
        setFileContent(content);
      } catch {
        pushLine("stderr", `Cannot read ${path}`);
      }
    },
    [pushLine]
  );

  const saveFile = useCallback(
    (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
    },
    [refreshFiles, pushLine]
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  useEffect(() => {
    bootContainer();
  }, [bootContainer]);

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    currentLesson,
    completedLessons,
    taskResults,
    isValidating,
    lessons: LESSONS,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
    switchLesson,
    validate,
    resetLesson,
  };
}
