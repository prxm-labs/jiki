import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


const SAMPLE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "ts-demo",
      version: "1.0.0",
      scripts: {
        start: "node main.ts",
        test: "node test.ts",
        greet: "node greeter.ts",
      },
    },
    null,
    2
  ),

  "/main.ts": `import { add, multiply } from './math';
import { formatResult } from './utils';

interface Calculation {
  op: string;
  a: number;
  b: number;
  result: number;
}

const calculations: Calculation[] = [
  { op: 'add', a: 10, b: 32, result: add(10, 32) },
  { op: 'multiply', a: 6, b: 7, result: multiply(6, 7) },
];

for (const calc of calculations) {
  console.log(formatResult(calc.op, calc.a, calc.b, calc.result));
}

console.log('');
console.log('TypeScript is running in the browser!');
`,

  "/math.ts": `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export type MathOp = 'add' | 'multiply';
`,

  "/utils.ts": `export function formatResult(
  op: string,
  a: number,
  b: number,
  result: number,
): string {
  return \`\${op}(\${a}, \${b}) = \${result}\`;
}

export type Formatter = (s: string) => string;
`,

  "/greeter.ts": `interface Person {
  name: string;
  age: number;
  role?: string;
}

function greet(person: Person): string {
  const role = person.role ? \` (\${person.role})\` : '';
  return \`Hello, \${person.name}\${role}! Age: \${person.age}\`;
}

const team: Person[] = [
  { name: 'Alice', age: 30, role: 'Engineer' },
  { name: 'Bob', age: 25 },
  { name: 'Carol', age: 28, role: 'Designer' },
];

for (const p of team) {
  console.log(greet(p));
}
`,

  "/test.ts": `import { add, multiply } from './math';

interface TestCase {
  name: string;
  fn: () => boolean;
}

const tests: TestCase[] = [
  { name: 'add(2, 3) === 5',       fn: () => add(2, 3) === 5 },
  { name: 'add(-1, 1) === 0',      fn: () => add(-1, 1) === 0 },
  { name: 'multiply(4, 5) === 20', fn: () => multiply(4, 5) === 20 },
  { name: 'multiply(0, 99) === 0', fn: () => multiply(0, 99) === 0 },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const ok = t.fn();
  if (ok) {
    console.log(\`  PASS  \${t.name}\`);
    passed++;
  } else {
    console.log(\`  FAIL  \${t.name}\`);
    failed++;
  }
}

console.log('');
console.log(\`Results: \${passed} passed, \${failed} failed\`);
`,

  "/enums.ts": `enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Left = 'LEFT',
  Right = 'RIGHT',
}

enum Color {
  Red,
  Green,
  Blue,
}

function move(dir: Direction): string {
  return \`Moving \${dir}\`;
}

console.log(move(Direction.Up));
console.log(move(Direction.Left));
console.log(\`Red = \${Color.Red}, Green = \${Color.Green}, Blue = \${Color.Blue}\`);
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

  const bootContainer = useCallback(async () => {
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

    pushLine("info", "Initializing TypeScript transpiler (esbuild-wasm)...");

    await c.init();

    for (const [path, content] of Object.entries(SAMPLE_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted with TypeScript support.");
    pushLine(
      "info",
      "Try: node main.ts, node test.ts, node greeter.ts, node enums.ts"
    );
    refreshFiles();
    setSelectedFile("/main.ts");
    setFileContent(SAMPLE_FILES["/main.ts"]);
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
  };
}
