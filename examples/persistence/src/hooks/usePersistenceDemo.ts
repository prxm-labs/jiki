import { useState, useCallback, useRef, useEffect } from "react";
import { boot, InMemoryAdapter, type Container } from "jiki";
import type { TerminalLine, FileEntry } from 'jiki-ui';

const SAMPLE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify({ name: "persistence-demo", version: "1.0.0" }, null, 2),
  "/notes.txt": "This file is persisted!\nEdit it and it will survive container restarts.",
  "/counter.js": `const fs = require('fs');
const path = '/data/count.txt';
let count = 0;
try { count = parseInt(fs.readFileSync(path, 'utf8'), 10) || 0; } catch {}
count++;
const dir = '/data';
try { fs.mkdirSync(dir, { recursive: true }); } catch {}
fs.writeFileSync(path, String(count));
console.log('Counter:', count);
`,
};

let lineId = 0;

export function usePersistenceDemo() {
  const containerRef = useRef<Container | null>(null);
  const adapterRef = useRef(new InMemoryAdapter());
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [entryCount, setEntryCount] = useState(0);

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
        return c.vfs.readdirSync(dirPath)
          .filter((n: string) => !n.startsWith("."))
          .sort()
          .map((name: string) => {
            const fullPath = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = c.vfs.statSync(fullPath).isDirectory();
            return { name, path: fullPath, isDir, children: isDir ? buildTree(fullPath) : undefined };
          });
      } catch { return []; }
    };
    setFiles(buildTree("/"));
    setEntryCount(adapterRef.current.size);
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      persistence: adapterRef.current,
      onConsole: (_method, args) => {
        pushLine("stdout", args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(SAMPLE_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted with InMemoryAdapter persistence.");
    pushLine("info", `${adapterRef.current.size} entries persisted.`);
    pushLine("info", "Try: node counter.js (run it multiple times!)");
    refreshFiles();
    setSelectedFile("/counter.js");
    setFileContent(SAMPLE_FILES["/counter.js"]);
  }, [pushLine, refreshFiles]);

  const selectFile = useCallback((path: string) => {
    const c = containerRef.current;
    if (!c) return;
    try { setSelectedFile(path); setFileContent(c.readFile(path)); }
    catch { pushLine("stderr", `Cannot read ${path}`); }
  }, [pushLine]);

  const saveFile = useCallback((path: string, content: string) => {
    containerRef.current?.writeFile(path, content);
    setFileContent(content);
    refreshFiles();
    pushLine("info", `Saved ${path} (${adapterRef.current.size} entries persisted)`);
  }, [refreshFiles, pushLine]);

  const runCommand = useCallback(async (cmd: string) => {
    const c = containerRef.current;
    if (!c) return;
    pushLine("command", `$ ${cmd}`);
    try {
      const result = await c.run(cmd);
      if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
      if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
      if (result.exitCode !== 0) pushLine("info", `Exit code ${result.exitCode}`);
    } catch (err) { pushLine("stderr", String(err)); }
    refreshFiles();
  }, [pushLine, refreshFiles]);

  const clearTerminal = useCallback(() => { linesRef.current = []; setTerminal([]); }, []);

  return { terminal, files, selectedFile, fileContent, isBooted, entryCount, selectFile, saveFile, runCommand, clearTerminal };
}
