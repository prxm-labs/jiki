import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  ViteDevServer,
  getServerBridge,
  type Container,
  type HMRUpdate,
} from "@run0/jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };

// ---------------------------------------------------------------------------
// Virtual project — a Vite + React + TypeScript + Tailwind app
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vite + React + TS</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  </style>
  <!-- COMPONENTS_PLACEHOLDER -->
</head>
<body>
  <div id="root"></div>
  <!-- BOOTSTRAP_PLACEHOLDER -->
</body>
</html>`,

  // ── Layout / shell ──

  "/src/components/Navbar.tsx": `function Navbar({ currentPath, onNavigate }) {
  const links = [
    { path: '/', label: 'Home' },
    { path: '/counter', label: 'Counter' },
    { path: '/todos', label: 'Todos' },
    { path: '/about', label: 'About' },
  ];

  return (
    <nav className="border-b border-black/10 sticky top-0 z-50 bg-white">
      <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
        <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/'); }} className="text-sm font-bold tracking-tight text-black no-underline">
          <span className="text-amber-500">v</span>ite.
        </a>
        <div className="flex items-center gap-5">
          {links.map((link) => (
            <a
              key={link.path}
              href={link.path}
              onClick={(e) => { e.preventDefault(); onNavigate(link.path); }}
              className={\`text-sm no-underline transition-colors \${
                currentPath === link.path ? 'text-black font-bold' : 'text-black/40 hover:text-black'
              }\`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}`,

  "/src/components/Footer.tsx": `function Footer() {
  return (
    <footer className="border-t border-black/10 mt-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-xs font-bold tracking-tight"><span className="text-amber-500">v</span>ite.</span>
        <span className="text-xs text-black/30">Vite &middot; React 18 &middot; TypeScript &middot; jiki</span>
      </div>
    </footer>
  );
}`,

  // ── Pages ──

  "/src/pages/Home.tsx": `function Home() {
  return (
    <div>
      <section className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Vite + React + TypeScript</p>
        <h1 className="text-5xl font-black leading-[1.1] tracking-tight mb-4">
          Instant HMR.<br/><span className="text-amber-500">In the browser.</span>
        </h1>
        <p className="text-base text-black/50 leading-relaxed max-w-md mb-10">
          A complete Vite-style dev environment running inside a virtual filesystem. Edit code, see changes instantly.
        </p>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-black text-white text-sm font-bold">Explore demo</div>
          <div className="px-4 py-2 border-2 border-black text-sm font-bold">View source</div>
        </div>
      </section>

      <section className="border-t border-black/10">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-8">
            {[
              { title: 'Instant HMR', desc: 'Edit any file and see changes without a full reload.' },
              { title: 'Virtual FS', desc: 'All files in memory. No server, no build step.' },
              { title: 'Full App', desc: 'Multi-page routing with Counter, Todos, and About.' },
            ].map((f, i) => (
              <div key={i}>
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-black/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}`,

  "/src/pages/Counter.tsx": `function Counter() {
  const [count, setCount] = React.useState(0);
  const [step, setStep] = React.useState(1);

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Interactive Counter</h1>
        <p className="text-zinc-500 mb-8">Demonstrates React state management with hooks.</p>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <div className="text-6xl font-extrabold text-zinc-900 tabular-nums mb-6">{count}</div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => setCount((c) => c - step)}
              className="w-12 h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xl transition-colors flex items-center justify-center"
            >
              -
            </button>
            <button
              onClick={() => setCount(0)}
              className="px-4 h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 font-medium text-sm transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setCount((c) => c + step)}
              className="w-12 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl transition-colors flex items-center justify-center shadow-sm"
            >
              +
            </button>
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">Step size</label>
            <div className="flex items-center justify-center gap-2">
              {[1, 5, 10, 25].map((s) => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  className={\`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors \${
                    step === s
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }\`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          Try editing Counter.tsx and saving to see the component update.
        </p>
      </div>
    </div>
  );
}`,

  "/src/pages/Todos.tsx": `function Todos() {
  const [items, setItems] = React.useState([
    { id: 1, text: 'Learn jiki virtual filesystem', done: true },
    { id: 2, text: 'Build a Vite + React demo', done: false },
    { id: 3, text: 'Try editing files in the editor', done: false },
  ]);
  const [input, setInput] = React.useState('');
  const nextId = React.useRef(4);

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    setItems((prev) => [...prev, { id: nextId.current++, text, done: false }]);
    setInput('');
  };

  const toggle = (id) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  };

  const remove = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const remaining = items.filter((i) => !i.done).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Todo List</h1>
        <p className="text-zinc-500 mb-6">A classic demo — add, complete, and delete tasks.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            placeholder="What needs to be done?"
            className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
          />
          <button
            onClick={addTodo}
            className="px-4 py-2.5 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors shadow-sm text-sm"
          >
            Add
          </button>
        </div>

        <div className="space-y-1.5 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={\`flex items-center gap-3 p-3 rounded-xl border transition-colors \${
                item.done
                  ? 'bg-zinc-50 border-zinc-100'
                  : 'bg-white border-zinc-200 hover:border-emerald-200'
              }\`}
            >
              <button
                onClick={() => toggle(item.id)}
                className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors \${
                  item.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-zinc-300 hover:border-emerald-400'
                }\`}
              >
                {item.done && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={\`flex-1 text-sm \${item.done ? 'line-through text-zinc-400' : 'text-zinc-800'}\`}>
                {item.text}
              </span>
              <button
                onClick={() => remove(item.id)}
                className="text-zinc-300 hover:text-red-500 transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="text-sm text-zinc-400">
          {remaining} item{remaining !== 1 ? 's' : ''} remaining
        </div>
      </div>
    </div>
  );
}`,

  "/src/pages/About.tsx": `function About() {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">About</p>
      <h1 className="text-4xl font-black leading-[1.1] tracking-tight mb-4">How it works.</h1>
      <p className="text-base text-black/50 leading-relaxed max-w-md mb-12">
        jiki running a Vite-style dev environment in the browser. No server, no bundler — virtual filesystem and client-side rendering.
      </p>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Stack</h2>
          <div className="space-y-3">
            {[
              { label: 'Runtime', value: 'jiki v0.1.0' },
              { label: 'Bundler', value: 'Vite (simulated)' },
              { label: 'UI', value: 'React 18 + TypeScript' },
              { label: 'Styling', value: 'Tailwind CSS' },
              { label: 'Filesystem', value: 'In-memory MemFS' },
              { label: 'JSX', value: 'Babel Standalone' },
            ].map((item, i) => (
              <div key={i} className="flex items-baseline justify-between border-b border-black/5 pb-3">
                <span className="text-sm font-bold">{item.value}</span>
                <span className="text-xs text-black/30 font-mono">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Pipeline</h2>
          <ol className="space-y-3">
            {[
              ['Boot container', 'Initialize jiki with boot()'],
              ['Write files', 'TSX components stored in virtual FS'],
              ['Assemble', 'Single HTML doc with Babel for client-side JSX'],
              ['Render', 'Sandboxed iframe displays the result'],
              ['HMR', 'On save, HTML reassembled and iframe updates'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-3">
                <span className="text-xs font-black text-amber-500 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <span className="text-sm font-bold">{title}.</span>
                  <span className="text-sm text-black/40"> {desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}`,

  // ── App shell ──

  "/src/App.tsx": `function App() {
  const [path, setPath] = React.useState(window.__INITIAL_PATH || '/');

  const navigate = (to) => {
    setPath(to);
    window.parent.postMessage({ type: 'route-change', path: to }, '*');
  };

  React.useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'navigate') setPath(e.data.path);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  let Page;
  switch (path) {
    case '/counter': Page = Counter; break;
    case '/todos':   Page = Todos;   break;
    case '/about':   Page = About;   break;
    default:         Page = Home;    break;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Navbar currentPath={path} onNavigate={navigate} />
      <main className="flex-1">
        <Page />
      </main>
      <Footer />
    </div>
  );
}`,

  // ── Config files ──

  "/package.json": `{
  "name": "vite-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}`,

  "/tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}`,

  "/vite.config.ts": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`,

  "/tailwind.config.js": `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};`,
};

// ---------------------------------------------------------------------------
// Assembly: merge virtual files into a single HTML document for the iframe
// ---------------------------------------------------------------------------

function assembleHtml(container: Container, route: string): string {
  let html: string;
  try {
    html = container.readFile("/index.html");
  } catch {
    return "<html><body><p>Error: /index.html not found</p></body></html>";
  }

  const componentPaths = [
    "/src/components/Navbar.tsx",
    "/src/components/Footer.tsx",
    "/src/pages/Home.tsx",
    "/src/pages/Counter.tsx",
    "/src/pages/Todos.tsx",
    "/src/pages/About.tsx",
    "/src/App.tsx",
  ];

  const scripts: string[] = [];
  for (const p of componentPaths) {
    try {
      const code = container.readFile(p);
      scripts.push(`<script type="text/babel">\n${code}\n<\/script>`);
    } catch {
      /* skip missing files */
    }
  }

  const bootstrap = `<script type="text/babel">
  window.__INITIAL_PATH = "${route}";
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
<\/script>`;

  html = html.replace("<!-- COMPONENTS_PLACEHOLDER -->", scripts.join("\n"));
  html = html.replace("<!-- BOOTSTRAP_PLACEHOLDER -->", bootstrap);
  return html;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

export function useViteContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);

  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  const rebuildPreview = useCallback((route: string) => {
    const c = containerRef.current;
    if (!c) return;
    setHtmlSrc(assembleHtml(c, route));
  }, []);

  // ── Boot ──

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

    // Set up ViteDevServer for HMR and module serving
    const server = new ViteDevServer(c.vfs, {
      port: 5173,
      root: "/",
      framework: "react",
    });
    server.on("hmr-update", (update: HMRUpdate) => {
      pushLine("info", `[HMR] ${update.type}: ${update.path}`);
    });
    server.start();

    // Try Service Worker bridge for real HTTP preview
    (async () => {
      try {
        const bridge = getServerBridge();
        await bridge.initServiceWorker();
        bridge.registerServer(server, 5173);
        const url = bridge.getServerUrl(5173);
        setPreviewUrl(url);
        pushLine("info", `Vite dev server running at ${url}`);
      } catch {
        pushLine("info", "Service Worker not available — using srcdoc preview");
        setHtmlSrc(assembleHtml(c, "/"));
      }
    })();

    setIsBooted(true);
    pushLine("info", "Container booted. Vite project loaded.");
    pushLine("info", "Try: ls, cat /src/App.tsx, or edit files and hit Save.");
    refreshFiles();
    setSelectedFile("/src/App.tsx");
    setFileContent(VIRTUAL_FILES["/src/App.tsx"]);
  }, [pushLine, refreshFiles]);

  // ── Listen for route changes from the iframe ──

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

  // ── Actions ──

  const navigateTo = useCallback(
    (path: string) => {
      setCurrentPath(path);
      rebuildPreview(path);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, path];
      });
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx, rebuildPreview]
  );

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    rebuildPreview(path);
  }, [history, historyIdx, rebuildPreview]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    rebuildPreview(path);
  }, [history, historyIdx, rebuildPreview]);

  const refresh = useCallback(() => {
    rebuildPreview(currentPath);
  }, [currentPath, rebuildPreview]);

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
      rebuildPreview(currentPath);
    },
    [refreshFiles, pushLine, rebuildPreview, currentPath]
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
    [pushLine, refreshFiles]
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
    previewUrl,
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
