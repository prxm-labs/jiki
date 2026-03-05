import { useState, useCallback, useRef, useEffect } from "react";
import { boot, InMemoryAdapter, type Container } from "jiki";

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


const SAMPLE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "my-app",
      version: "1.0.0",
      scripts: { start: "node index.js", test: "node test-math.js" },
      dependencies: {},
    },
    null,
    2
  ),
  "/index.js": `const os = require('os');
const path = require('path');

console.log('Platform:', os.platform());
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());
console.log('');

const greeting = require('./lib/greeting');
console.log(greeting('jiki'));

const config = require('./config.json');
console.log('Config loaded:', JSON.stringify(config));
`,
  "/lib/greeting.js": `module.exports = function greeting(name) {
  return \`Hello from \${name}! Running in the browser.\`;
};
`,
  "/config.json": JSON.stringify(
    { env: "browser", debug: false, version: "0.1.0" },
    null,
    2
  ),
  "/math.js": `// ESM-style module (auto-transformed to CJS)
export const add = (a, b) => a + b;
export const multiply = (a, b) => a * b;
export default { add, multiply };
`,
  "/test-math.js": `const math = require('./math');
console.log('2 + 3 =', math.add(2, 3));
console.log('4 * 5 =', math.multiply(4, 5));

const results = [
  { op: 'add', a: 10, b: 20, expected: 30 },
  { op: 'multiply', a: 6, b: 7, expected: 42 },
];

for (const t of results) {
  const fn = math[t.op];
  const actual = fn(t.a, t.b);
  const ok = actual === t.expected ? 'PASS' : 'FAIL';
  console.log(\`[\${ok}] \${t.op}(\${t.a}, \${t.b}) = \${actual}\`);
}
`,
  "/README.md": `# jiki Demo

This project runs entirely in your browser using an in-memory virtual filesystem.

- Edit files in the editor panel
- Run shell commands in the terminal
- Execute JavaScript directly
`,
};

let lineId = 0;

export function useContainer() {
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
        const entries = c.vfs.readdirSync(dirPath);
        return entries
          .filter((n) => !n.startsWith("."))
          .sort((a, b) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fullA).isDirectory();
            const bDir = c.vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fullPath =
              dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
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

  const bootContainer = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      // Persist VFS to survive page refreshes (use IndexedDBAdapter in production)
      persistence: new InMemoryAdapter(),
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(SAMPLE_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted. Virtual filesystem ready.");
    pushLine(
      "info",
      "Try: node index.js, node test-math.js, ls, cat README.md"
    );
    refreshFiles();
    setSelectedFile("/index.js");
    setFileContent(SAMPLE_FILES["/index.js"]);
  }, [pushLine, refreshFiles]);

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
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
    pushLine,
  };
}
