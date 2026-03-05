import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


export interface BuildConfig {
  entryPoint: string;
  format: "esm" | "cjs" | "iife";
  platform: "browser" | "node" | "neutral";
  minify: boolean;
  bundle: boolean;
  externals: string;
}

export interface BuildStats {
  originalSize: number;
  bundleSize: number;
  reduction: number;
  buildTimeMs: number;
  fileCount: number;
}

export interface BuildResult {
  code: string;
  stats: BuildStats;
}

const SOURCE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "esbuild-demo",
      version: "1.0.0",
      dependencies: { react: "^19.0.0" },
    },
    null,
    2
  ),

  "/src/index.tsx": `import React from 'react';
import { formatDate, capitalize } from './utils';
import { Button } from './components/Button';

function App() {
  return (
    <div>
      <h1>{capitalize('esbuild playground')}</h1>
      <p>Built at: {formatDate(new Date())}</p>
      <Button label="Click me" onClick={() => console.log('clicked!')} />
    </div>
  );
}

export default App;
`,

  "/src/utils.ts": `export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function capitalize(str: string): string {
  return str.replace(/\\b\\w/g, (c) => c.toUpperCase());
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
`,

  "/src/components/Button.tsx": `import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  const style = variant === 'primary'
    ? { background: '#3b82f6', color: 'white' }
    : { background: '#e5e7eb', color: '#1f2937' };

  return (
    <button onClick={onClick} style={{ ...style, padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
      {label}
    </button>
  );
}
`,
};

let lineId = 0;

export function useEsbuildContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);

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

    for (const [path, content] of Object.entries(SOURCE_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "esbuild Playground ready. Edit files and hit Build.");
    refreshFiles();
    setSelectedFile("/src/index.tsx");
    setFileContent(SOURCE_FILES["/src/index.tsx"]);
  }, [pushLine, refreshFiles]);

  const getSourceSize = useCallback((): { size: number; count: number } => {
    const c = containerRef.current;
    if (!c) return { size: 0, count: 0 };
    let size = 0;
    let count = 0;
    const walk = (dir: string) => {
      try {
        for (const name of c.vfs.readdirSync(dir)) {
          const full = dir === "/" ? `/${name}` : `${dir}/${name}`;
          if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
          if (c.vfs.statSync(full).isDirectory()) {
            walk(full);
          } else if (/\.(tsx?|jsx?|json)$/.test(name) && name !== "package.json") {
            size += c.readFile(full).length;
            count++;
          }
        }
      } catch { /* skip */ }
    };
    walk("/src");
    return { size, count };
  }, []);

  const build = useCallback(
    async (config: BuildConfig) => {
      const c = containerRef.current;
      if (!c) return;

      setIsBuilding(true);
      setBuildResult(null);

      const parts = ["esbuild", config.entryPoint];
      if (config.bundle) parts.push("--bundle");
      parts.push(`--format=${config.format}`);
      parts.push(`--platform=${config.platform}`);
      if (config.minify) parts.push("--minify");
      parts.push("--outfile=dist/bundle.js");

      const externals = config.externals.split(",").map((s) => s.trim()).filter(Boolean);
      for (const ext of externals) {
        parts.push(`--external:${ext}`);
      }

      const cmd = parts.join(" ");
      const { size: originalSize, count: fileCount } = getSourceSize();

      pushLine("command", `$ ${cmd}`);
      const start = performance.now();

      try {
        const result = await c.run(cmd);
        const elapsed = Math.round(performance.now() - start);

        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());

        if (result.exitCode !== 0) {
          pushLine("info", `Build failed with exit code ${result.exitCode}`);
          setIsBuilding(false);
          return;
        }

        // Read bundle output
        let code = "";
        let bundleSize = 0;
        try {
          code = c.readFile("/dist/bundle.js");
          bundleSize = code.length;
        } catch {
          pushLine("stderr", "Could not read dist/bundle.js");
        }

        const reduction = originalSize > 0
          ? Math.round((1 - bundleSize / originalSize) * 100)
          : 0;

        setBuildResult({
          code,
          stats: { originalSize, bundleSize, reduction, buildTimeMs: elapsed, fileCount },
        });
        pushLine("info", `Build complete in ${elapsed}ms`);
      } catch (err) {
        pushLine("stderr", String(err));
      }

      refreshFiles();
      setIsBuilding(false);
    },
    [pushLine, refreshFiles, getSourceSize]
  );

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
    isBuilding,
    buildResult,
    runCommand,
    build,
    selectFile,
    saveFile,
    clearTerminal,
  };
}
