import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


const SVELTE_INTERNAL_URL =
  "https://esm.sh/svelte@4.2.20/es2022/internal.bundle.mjs";

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Svelte App</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,

  "/src/App.svelte": `<script>
  let count = 0;
  let name = 'jiki';

  function increment() { count += 1; }
  function decrement() { count -= 1; }
  function reset() { count = 0; }

  $: doubled = count * 2;
  $: message = count === 0 ? 'Click to start' : count > 0 ? 'Going up' : 'Going down';
</script>

<div class="min-h-screen bg-white text-black">
  <nav class="border-b border-black/10">
    <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
      <span class="text-sm font-bold tracking-tight"><span class="text-orange-500">s</span>velte.</span>
      <span class="text-xs text-black/30">Svelte &middot; Tailwind &middot; jiki</span>
    </div>
  </nav>

  <main class="max-w-2xl mx-auto px-6 pt-16 pb-20">
    <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Svelte 4</p>
    <h1 class="text-5xl font-black leading-tight tracking-tight mb-4">
      Hello, {name}.<br/><span class="text-orange-500">Reactive.</span>
    </h1>
    <p class="text-base text-black/50 leading-relaxed max-w-md mb-12">
      A Svelte component compiled in the browser and running inside a jiki virtual filesystem.
    </p>

    <div class="mb-12">
      <p class="text-xs uppercase tracking-widest text-black/30 mb-3">{message}</p>
      <div class="flex items-center gap-4 mb-4">
        <button on:click={decrement} class="w-9 h-9 border-2 border-black text-lg font-bold flex items-center justify-center bg-white cursor-pointer">&minus;</button>
        <span class="text-5xl font-black tabular-nums min-w-[80px] text-center">{count}</span>
        <button on:click={increment} class="w-9 h-9 border-2 border-black bg-black text-white text-lg font-bold flex items-center justify-center cursor-pointer">+</button>
      </div>
      <div class="flex items-center gap-4">
        <button on:click={reset} class="text-xs font-bold uppercase tracking-widest text-black/30 hover:text-black cursor-pointer bg-transparent border-none">Reset</button>
        <span class="text-xs text-black/20">doubled = {doubled}</span>
      </div>
    </div>

    <div class="border-t border-black/10 pt-8">
      <label class="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Two-way binding</label>
      <input
        bind:value={name}
        class="w-full max-w-xs px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors"
        placeholder="Your name"
      />
      <p class="text-xs text-black/30 mt-2">Type to see the heading update reactively.</p>
    </div>

    <div class="border-t border-black/10 pt-8 mt-8">
      <div class="grid grid-cols-3 gap-8">
        <div>
          <h3 class="text-sm font-bold mb-1">Reactivity</h3>
          <p class="text-xs text-black/40 leading-relaxed">Assignments trigger updates. No setState needed.</p>
        </div>
        <div>
          <h3 class="text-sm font-bold mb-1">Compiled</h3>
          <p class="text-xs text-black/40 leading-relaxed">Svelte compiles to vanilla JS. No virtual DOM.</p>
        </div>
        <div>
          <h3 class="text-sm font-bold mb-1">Tiny</h3>
          <p class="text-xs text-black/40 leading-relaxed">Minimal runtime. Components ship almost no framework code.</p>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-black/10 mt-8">
    <div class="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
      <span class="text-xs font-bold tracking-tight"><span class="text-orange-500">s</span>velte.</span>
      <span class="text-xs text-black/30">Edit App.svelte and save to see changes.</span>
    </div>
  </footer>
</div>
`,

  "/package.json": `{
  "name": "svelte-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "svelte": "^4.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "vite": "^5.4.0"
  }
}`,
};

let svelteCompiler: { compile: (source: string, options: Record<string, unknown>) => { js: { code: string } } } | null = null;
let svelteRuntimeCode: string | null = null;

async function loadSvelteCompiler(): Promise<typeof svelteCompiler> {
  if (svelteCompiler) return svelteCompiler;
  const module = await import(
    // @ts-expect-error CDN import resolved at runtime
    /* @vite-ignore */ "https://esm.sh/svelte@4/compiler"
  );
  svelteCompiler = module;
  return svelteCompiler;
}

async function loadSvelteRuntime(): Promise<string> {
  if (svelteRuntimeCode) return svelteRuntimeCode;
  const resp = await fetch(SVELTE_INTERNAL_URL);
  let code = await resp.text();
  // Convert ESM exports to a global assignment for use in non-module scripts.
  // The bundle ends with: export{localA as ExportA, localB as ExportB, ...};
  code = code.replace(
    /export\s*\{([^}]+)\}\s*;?/,
    (_match, exports: string) => {
      const entries = exports.split(",").map((e: string) => {
        const parts = e.trim().split(/\s+as\s+/);
        const local = parts[0].trim();
        const exported = (parts[1] || parts[0]).trim();
        return `${exported}:${local}`;
      });
      return `window.__SVELTE_INTERNAL__={${entries.join(",")}};`;
    },
  );
  svelteRuntimeCode = code;
  return svelteRuntimeCode;
}

function assembleHtml(
  container: Container,
  compiledJs: string | null,
  compileError: string | null,
  runtimeCode: string | null,
): string {
  let html: string;
  try {
    html = container.readFile("/index.html");
  } catch {
    return "<html><body><p>Error: /index.html not found</p></body></html>";
  }

  if (compileError) {
    const errorHtml = `<div style="
      font-family: monospace; padding: 24px; margin: 24px;
      background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px;
      color: #991b1b; white-space: pre-wrap; font-size: 13px; line-height: 1.5;
    "><strong>Svelte Compile Error</strong>\n\n${compileError.replace(/</g, "&lt;")}</div>`;
    return html.replace("</body>", `${errorHtml}</body>`);
  }

  if (!compiledJs || !runtimeCode) {
    return html.replace(
      "</body>",
      `<div style="padding:40px;text-align:center;color:#666;">Loading Svelte compiler...</div></body>`,
    );
  }

  let rewritten = compiledJs.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']svelte\/internal["'];?/g,
    "var {$1} = window.__SVELTE_INTERNAL__;",
  );
  rewritten = rewritten.replace(/export\s+default\s+Component\s*;?\s*$/, "");

  const bootstrap = `<script>${runtimeCode}<\/script>
<script>
${rewritten}
new Component({ target: document.getElementById('root') });
<\/script>`;

  return html.replace("</body>", `${bootstrap}</body>`);
}

async function compileSvelte(source: string): Promise<{ code: string } | { error: string }> {
  try {
    const compiler = await loadSvelteCompiler();
    if (!compiler) return { error: "Failed to load Svelte compiler" };
    const result = compiler.compile(source, {
      name: "Component",
      filename: "App.svelte",
      sveltePath: "svelte",
      discloseVersion: false,
    });
    return { code: result.js.code };
  } catch (err) {
    return { error: String(err) };
  }
}

let lineId = 0;

export function useSvelteContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);

  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIdx, setHistoryIdx] = useState(0);

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

  const rebuildPreview = useCallback(async () => {
    const c = containerRef.current;
    if (!c) return;

    let svelteSource: string;
    try {
      svelteSource = c.readFile("/src/App.svelte");
    } catch {
      setHtmlSrc(assembleHtml(c, null, "Cannot read /src/App.svelte", null));
      return;
    }

    const [result, runtime] = await Promise.all([
      compileSvelte(svelteSource),
      loadSvelteRuntime(),
    ]);
    if ("error" in result) {
      setHtmlSrc(assembleHtml(c, null, result.error, null));
    } else {
      setHtmlSrc(assembleHtml(c, result.code, null, runtime));
    }
  }, []);

  useEffect(() => {
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

    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted. Svelte project loaded.");
    pushLine("info", "Loading Svelte compiler from CDN...");
    refreshFiles();
    setSelectedFile("/src/App.svelte");
    setFileContent(VIRTUAL_FILES["/src/App.svelte"]);

    rebuildPreview().then(() => {
      pushLine("info", "Svelte compiler ready. Edit App.svelte and save to see changes.");
    });
  }, [pushLine, refreshFiles, rebuildPreview]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "route-change" && typeof e.data.path === "string") {
        const newPath = e.data.path;
        setCurrentPath(newPath);
        setHistory((prev) => {
          const trimmed = prev.slice(0, historyIdx + 1);
          return [...trimmed, newPath];
        });
        setHistoryIdx((prev) => prev + 1);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [historyIdx]);

  const navigateTo = useCallback(
    (path: string) => {
      setCurrentPath(path);
      rebuildPreview();
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, path];
      });
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx, rebuildPreview],
  );

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    rebuildPreview();
  }, [history, historyIdx, rebuildPreview]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    rebuildPreview();
  }, [history, historyIdx, rebuildPreview]);

  const refresh = useCallback(() => {
    rebuildPreview();
  }, [rebuildPreview]);

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
    [pushLine],
  );

  const saveFile = useCallback(
    (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
      rebuildPreview();
    },
    [refreshFiles, pushLine, rebuildPreview],
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
        if (result.exitCode !== 0)
          pushLine("info", `Exit code ${result.exitCode}`);
      } catch (err) {
        pushLine("stderr", String(err));
      }
      refreshFiles();
    },
    [pushLine, refreshFiles],
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    htmlSrc,
    currentPath,
    canGoBack: historyIdx > 0,
    canGoForward: historyIdx < history.length - 1,
    navigateTo,
    goBack,
    goForward,
    refresh,
    selectFile,
    saveFile,
    runCommand,
    clearTerminal,
  };
}
