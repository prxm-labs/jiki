import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";
import type { TerminalLine, FileEntry } from 'jiki-ui';

const SAMPLE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify({ name: "sandbox-demo", version: "1.0.0" }, null, 2),
  "/README.md": `# Sandbox Demo

This container has resource limits:
- Max 10 files
- Max 1 MB memory
- Only /app and /tmp paths allowed
- Read-only mode available

Try writing files outside /app to see the sandbox in action.
`,
  "/app/index.js": `console.log("Hello from sandboxed container!");
console.log("Try creating files outside /app — it will be blocked.");
`,
  "/app/fill-test.js": `// Try to create many files to hit the file count limit
for (let i = 0; i < 20; i++) {
  try {
    require('fs').writeFileSync('/app/tmp-' + i + '.txt', 'data');
    console.log('Created file', i);
  } catch (e) {
    console.log('Blocked at file', i, ':', e.message);
    break;
  }
}
`,
};

let lineId = 0;

export function useSandboxDemo() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);

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
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      sandbox: {
        limits: { maxFileCount: 10, maxMemoryMB: 1 },
        fs: { allowedPaths: ["/app", "/tmp", "/package.json", "/README.md"] },
      },
      onConsole: (_method, args) => {
        pushLine("stdout", args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(SAMPLE_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Sandboxed container booted.");
    pushLine("info", "Limits: 10 files max, 1 MB memory, paths restricted to /app and /tmp");
    pushLine("info", "Try: node /app/index.js, echo test > /etc/secret");
    refreshFiles();
    setSelectedFile("/app/index.js");
    setFileContent(SAMPLE_FILES["/app/index.js"]);
  }, [pushLine, refreshFiles]);

  const selectFile = useCallback((path: string) => {
    const c = containerRef.current;
    if (!c) return;
    try { setSelectedFile(path); setFileContent(c.readFile(path)); }
    catch { pushLine("stderr", `Cannot read ${path}`); }
  }, [pushLine]);

  const saveFile = useCallback((path: string, content: string) => {
    try {
      containerRef.current?.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
    } catch (err) {
      pushLine("stderr", `Blocked: ${err instanceof Error ? err.message : String(err)}`);
    }
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

  return { terminal, files, selectedFile, fileContent, isBooted, selectFile, saveFile, runCommand, clearTerminal };
}
