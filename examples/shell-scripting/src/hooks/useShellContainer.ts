import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


const SAMPLE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    { name: "shell-demo", version: "1.0.0", scripts: {}, dependencies: {} },
    null,
    2
  ),

  "/src/app.js": `const http = require('http');
console.log('App module loaded');
module.exports = { name: 'my-app', version: '1.0.0' };
`,

  "/src/utils.js": `module.exports = {
  greet: (name) => \`Hello, \${name}!\`,
  sum: (...nums) => nums.reduce((a, b) => a + b, 0),
};
`,

  "/src/index.ts": `const app = require('./app');
const utils = require('./utils');
console.log(utils.greet(app.name));
`,

  "/data/users.json": JSON.stringify(
    [
      { name: "Alice", role: "admin" },
      { name: "Bob", role: "user" },
      { name: "Charlie", role: "user" },
    ],
    null,
    2
  ),

  "/data/logs.txt": `[INFO] Server started on port 3000
[ERROR] Failed to connect to database
[INFO] Request: GET /api/users
[WARN] Slow query detected (1200ms)
[ERROR] Unhandled exception in handler
[INFO] Request: POST /api/login
[INFO] User authenticated successfully
[ERROR] Connection timeout after 30s
[INFO] Graceful shutdown initiated
`,

  "/scripts/build.sh": `echo "Starting build..."
export BUILD_DIR=dist
mkdir -p $BUILD_DIR && echo "Created $BUILD_DIR/"
cat src/app.js src/utils.js > $BUILD_DIR/bundle.js && echo "Bundle created"
echo "Build complete!" > $BUILD_DIR/build.log
cat $BUILD_DIR/build.log
`,

  "/README.md": `# Shell Scripting Demo

Supported syntax:
- Pipes: cmd1 | cmd2
- Chains: cmd1 && cmd2, cmd1 || cmd2, cmd1 ; cmd2
- Globs: ls src/*.js, echo /src/**/*.ts, echo *.{js,ts}
- Recursive globs: echo /src/**/*.js (matches all nested .js files)
- Brace expansion: echo /{src,data}/*.{js,json}
- Redirects: echo "text" > file.txt, echo "more" >> file.txt
- Variables: export VAR=value, echo $VAR, \${VAR}
- Background jobs: echo hello &, jobs, fg 1
- Command history: history (view), up/down arrows (navigate)
- Tab completion: type a partial command and call shell.complete()
`,
};

let lineId = 0;

export function useShellContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
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

  const bootContainer = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: false,
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
    pushLine("info", "Shell ready. Try the lessons on the left, or type any command.");
    refreshFiles();
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
    isBooted,
    runCommand,
    clearTerminal,
  };
}
