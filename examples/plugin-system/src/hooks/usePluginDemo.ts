import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container, type JikiPlugin } from "@run0/jiki";
import type { TerminalLine, FileEntry } from '@run0/jiki-ui';

const cssStubPlugin: JikiPlugin = {
  name: 'css-stub',
  setup(hooks) {
    hooks.onLoad(/\.css$/, () => ({
      contents: 'module.exports = {};',
    }));
  },
};

const envPlugin: JikiPlugin = {
  name: 'virtual-env',
  setup(hooks) {
    hooks.onResolve(/^@env$/, () => ({ path: '/__env__.js' }));
    hooks.onLoad(/^\/__env__\.js$/, () => ({
      contents: `module.exports = { NODE_ENV: "development", API_URL: "https://api.example.com", VERSION: "1.0.0" };`,
    }));
  },
};

const bannerPlugin: JikiPlugin = {
  name: 'banner',
  setup(hooks) {
    hooks.onTransform(/\.js$/, (args) => ({
      contents: `/* Transformed by banner plugin */\n${args.contents}`,
    }));
  },
};

const SAMPLE_FILES: Record<string, string> = {
  "/package.json": JSON.stringify({ name: "plugin-demo", version: "1.0.0" }, null, 2),
  "/app.js": `const env = require("@env");
console.log("Environment:", env.NODE_ENV);
console.log("API URL:", env.API_URL);
console.log("Version:", env.VERSION);
`,
  "/style-test.js": `// CSS imports are stubbed by the css-stub plugin
const styles = require("./app.css");
console.log("CSS module loaded:", typeof styles === "object" ? "OK" : "FAIL");
`,
  "/app.css": `body { color: red; }`,
  "/banner-test.js": `// This file will have a banner comment prepended by the banner plugin
console.log("Banner plugin adds a comment to the top of every .js file");
`,
};

let lineId = 0;

export function usePluginDemo() {
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
      plugins: [cssStubPlugin, envPlugin, bannerPlugin],
      onConsole: (_method, args) => {
        pushLine("stdout", args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(SAMPLE_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted with 3 plugins: css-stub, virtual-env, banner");
    pushLine("info", "Try: node app.js, node style-test.js, node banner-test.js");
    refreshFiles();
    setSelectedFile("/app.js");
    setFileContent(SAMPLE_FILES["/app.js"]);
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
    pushLine("info", `Saved ${path}`);
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
