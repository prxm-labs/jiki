import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  type Container,
  type JikiPlugin,
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  extractPackageName,
  preprocessImports,
  initTranspiler,
  transpile,
} from "@run0/jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


// ---------------------------------------------------------------------------
// Virtual project files -- a multi-page React + Tailwind app
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My React App</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
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

  "/src/components/Navbar.jsx": `function Navbar({ currentPath, onNavigate }) {
  const links = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/icons', label: 'Icons' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <nav className="border-b border-black/10 sticky top-0 z-50 bg-white">
      <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onNavigate('/'); }}
          className="text-sm font-bold tracking-tight text-black no-underline"
        >
          <span className="text-sky-500">r</span>eact.
        </a>
        <div className="flex items-center gap-5">
          {links.map((link) => (
            <a
              key={link.path}
              href={link.path}
              onClick={(e) => { e.preventDefault(); onNavigate(link.path); }}
              className={\`text-sm no-underline transition-colors \${
                currentPath === link.path
                  ? 'text-black font-bold'
                  : 'text-black/40 hover:text-black'
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

  "/src/components/Footer.jsx": `function Footer() {
  return (
    <footer className="border-t border-black/10 mt-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-xs font-bold tracking-tight"><span className="text-sky-500">r</span>eact.</span>
        <span className="text-xs text-black/30">React 18 &middot; Tailwind &middot; jiki</span>
      </div>
    </footer>
  );
}`,

  "/src/pages/Home.jsx": `function Home() {
  return (
    <div>
      <section className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">React 18</p>
        <h1 className="text-5xl font-black leading-[1.1] tracking-tight mb-4">
          Multi-page app.<br/><span className="text-sky-500">In the browser.</span>
        </h1>
        <p className="text-base text-black/50 leading-relaxed max-w-md mb-10">
          A React application with routing, npm packages, and Tailwind CSS — all running in a jiki virtual filesystem.
        </p>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-black text-white text-sm font-bold">Get started</div>
          <div className="px-4 py-2 border-2 border-black text-sm font-bold">View source</div>
        </div>
      </section>

      <section className="border-t border-black/10">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-8">
            {[
              { title: 'Instant Boot', desc: 'Container starts in milliseconds. No server required.' },
              { title: 'Virtual FS', desc: 'Full POSIX-like filesystem running in memory.' },
              { title: 'npm Packages', desc: 'Install real packages like lucide-react from the terminal.' },
            ].map((f, i) => (
              <div key={i}>
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-black/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-sm"><span className="font-bold">Try it:</span> <span className="text-black/50">run</span> <code className="text-xs font-mono bg-black/5 px-1.5 py-0.5">npm install lucide-react</code> <span className="text-black/50">in the terminal, then open the</span> <span className="font-bold text-sky-500">Icons</span> <span className="text-black/50">page.</span></p>
        </div>
      </section>
    </div>
  );
}`,

  "/src/pages/About.jsx": `function About() {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">About</p>
      <h1 className="text-4xl font-black leading-[1.1] tracking-tight mb-4">How it works.</h1>
      <p className="text-base text-black/50 leading-relaxed max-w-md mb-12">
        A jiki container boots a virtual filesystem, writes JSX files, transpiles them, and renders the result in a sandboxed iframe.
      </p>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Stack</h2>
          <div className="space-y-3">
            {[
              { label: 'Runtime', value: 'jiki v0.1.0' },
              { label: 'Framework', value: 'React 18' },
              { label: 'Styling', value: 'Tailwind CSS' },
              { label: 'Filesystem', value: 'In-memory MemFS' },
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
              ['Write files', 'JSX components stored in virtual FS'],
              ['Transpile', 'esbuild-wasm converts JSX to JS'],
              ['Assemble', 'Scripts injected into HTML document'],
              ['Render', 'Sandboxed iframe displays the result'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-3">
                <span className="text-xs font-black text-sky-500 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
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

  "/src/pages/Contact.jsx": `function Contact() {
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <div className="max-w-sm mx-auto">
        <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4 text-center">Contact</p>
        <h1 className="text-3xl font-black tracking-tight mb-2 text-center">Get in touch.</h1>
        <p className="text-sm text-black/40 text-center mb-8">Form running inside the virtual container.</p>

        {submitted ? (
          <div className="border-2 border-black p-6 text-center">
            <p className="text-sm font-bold">Sent.</p>
            <p className="text-xs text-black/40 mt-1">Thanks for reaching out (this is a demo).</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-1.5">Name</label>
              <input type="text" required placeholder="Your name" className="w-full px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-1.5">Email</label>
              <input type="email" required placeholder="you@example.com" className="w-full px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-1.5">Message</label>
              <textarea required rows={4} placeholder="How can we help?" className="w-full px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors resize-none" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-black text-white text-sm font-bold hover:bg-black/80 transition-colors">
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}`,

  "/src/pages/Icons.jsx": `import { Camera, Heart, Star, Sun, Moon, Zap, Coffee, Music, Globe, Rocket } from 'lucide-react';

function Icons() {
  const [size, setSize] = React.useState(28);
  const [color, setColor] = React.useState('#000000');

  const icons = [
    { Icon: Camera, name: 'Camera' },
    { Icon: Heart, name: 'Heart' },
    { Icon: Star, name: 'Star' },
    { Icon: Sun, name: 'Sun' },
    { Icon: Moon, name: 'Moon' },
    { Icon: Zap, name: 'Zap' },
    { Icon: Coffee, name: 'Coffee' },
    { Icon: Music, name: 'Music' },
    { Icon: Globe, name: 'Globe' },
    { Icon: Rocket, name: 'Rocket' },
  ];

  const hasIcons = typeof Camera !== 'undefined';

  if (!hasIcons) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-20 text-center">
        <h1 className="text-3xl font-black tracking-tight mb-3">Install lucide-react</h1>
        <p className="text-sm text-black/40 mb-6">Run this in the terminal below:</p>
        <code className="inline-block bg-black text-white font-mono text-sm px-5 py-2.5 font-bold">npm install lucide-react</code>
        <p className="text-xs text-black/30 mt-4">Preview refreshes automatically after install.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">npm package</p>
      <h1 className="text-3xl font-black tracking-tight mb-2">Icon Gallery</h1>
      <p className="text-sm text-black/40 mb-8">
        From <code className="text-xs font-mono bg-black/5 px-1.5 py-0.5">lucide-react</code>, installed via npm in the browser.
      </p>

      <div className="flex items-center gap-6 mb-8 border-b border-black/10 pb-6">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-black/40">Size</label>
          <input type="range" min="16" max="64" value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20" />
          <span className="text-xs font-mono text-black/30 w-8">{size}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-black/40">Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 border-2 border-black/10 cursor-pointer" />
          <span className="text-xs font-mono text-black/30">{color}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {icons.map(({ Icon, name }) => (
          <div key={name} className="flex flex-col items-center gap-2 py-4">
            <Icon size={size} color={color} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}`,

  "/src/App.jsx": `function App() {
  const [path, setPath] = React.useState(window.__INITIAL_PATH || '/');

  const navigate = (to) => {
    setPath(to);
    window.parent.postMessage({ type: 'route-change', path: to }, '*');
  };

  React.useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'navigate') {
        setPath(e.data.path);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  let Page;
  switch (path) {
    case '/about':   Page = About;   break;
    case '/contact': Page = Contact; break;
    case '/icons':   Page = Icons;   break;
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
};

// ---------------------------------------------------------------------------
// Assembly: merge virtual files into a single HTML document for the iframe
// ---------------------------------------------------------------------------

const DEFAULT_CDN_GLOBALS: Record<string, string> = {
  react: "React",
  "react-dom": "ReactDOM",
  "react-dom/client": "ReactDOM",
};

const CDN_EXTERNALS = new Set(Object.keys(DEFAULT_CDN_GLOBALS));

const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);

const JSX_OPTIONS = {
  jsx: "transform" as const,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
};

function discoverComponents(container: Container, dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = container.vfs.readdirSync(dir);
    for (const name of entries) {
      const fullPath = dir === "/" ? `/${name}` : `${dir}/${name}`;
      try {
        const stat = container.vfs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...discoverComponents(container, fullPath));
        } else {
          const ext = fullPath.slice(fullPath.lastIndexOf("."));
          if (JSX_EXTENSIONS.has(ext)) results.push(fullPath);
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* dir doesn't exist */ }
  return results;
}

function sortComponentPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const aIsApp = a.endsWith("/App.jsx") || a.endsWith("/App.tsx");
    const bIsApp = b.endsWith("/App.jsx") || b.endsWith("/App.tsx");
    if (aIsApp && !bIsApp) return 1;
    if (!aIsApp && bIsApp) return -1;
    return a.localeCompare(b);
  });
}

async function transpileComponent(
  code: string,
  filename: string
): Promise<string> {
  const processed = preprocessImports(code);
  return transpile(processed, filename, JSX_OPTIONS);
}

interface ContainerOptions {
  cdnGlobals?: Record<string, string>;
}

async function assembleHtml(container: Container, route: string, options?: ContainerOptions): Promise<string> {
  let html: string;
  try {
    html = container.readFile("/index.html");
  } catch {
    return "<html><body><p>Error: /index.html not found</p></body></html>";
  }

  const componentPaths = sortComponentPaths(discoverComponents(container, "/src"));

  const sources: string[] = [];
  const transpileJobs: Array<{ code: string; path: string }> = [];
  for (const p of componentPaths) {
    try {
      const code = container.readFile(p);
      sources.push(code);
      transpileJobs.push({ code, path: p });
    } catch { /* skip unreadable */ }
  }

  const transpiled = await Promise.all(
    transpileJobs.map(({ code, path }) => transpileComponent(code, path))
  );
  const scripts = transpiled.map(
    (js) => `<script>\n${js}\n<\/script>`
  );

  const cdnGlobals = { ...DEFAULT_CDN_GLOBALS, ...options?.cdnGlobals };
  const cdnExternals = new Set(Object.keys(cdnGlobals));

  const bareImports = scanBareImports(sources);
  for (const specifier of [...bareImports]) {
    const pkg = extractPackageName(specifier);
    if (cdnExternals.has(pkg) || cdnExternals.has(specifier)) {
      bareImports.delete(specifier);
    }
  }

  const bundles = new Map();
  for (const specifier of bareImports) {
    try {
      const bundle = bundlePackageForBrowser(container.vfs, specifier, cdnExternals);
      bundles.set(specifier, bundle);
    } catch (err) {
      console.warn(`[assembleHtml] Could not bundle "${specifier}":`, err);
    }
  }

  const requireShim = generateRequireScript(bundles, cdnGlobals);

  const bootstrap = `<script>
  window.__INITIAL_PATH = "${route}";
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
<\/script>`;

  html = html.replace(
    "<!-- COMPONENTS_PLACEHOLDER -->",
    requireShim + "\n" + scripts.join("\n")
  );
  html = html.replace("<!-- BOOTSTRAP_PLACEHOLDER -->", bootstrap);
  return html;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

// TODO: Future example types to add:
// - Monorepo workspace example (multiple packages sharing a VFS)
// - Environment variables example (.env file loading)
// - Debugging example (breakpoints, source maps)
// - Dynamic imports example (code splitting with import())
export function useReactContainer() {
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

  // -- helpers --

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

  const rebuildPreview = useCallback(async (route: string) => {
    const c = containerRef.current;
    if (!c) return;
    try {
      const html = await assembleHtml(c, route);
      setHtmlSrc(html);
    } catch (err) {
      console.error("[rebuildPreview]", err);
      setHtmlSrc(
        `<html><body><pre style="color:red;padding:1em">${String(err)}</pre></body></html>`
      );
    }
  }, []);

  // -- boot --

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      pushLine("info", "Booting container...");

      try {
        await initTranspiler();
      } catch (err) {
        pushLine("stderr", `Failed to initialize transpiler: ${err}`);
        return;
      }

      const c = boot({
        cwd: "/",
        autoInstall: true,
        onConsole: (_method: string, args: unknown[]) => {
          const text = args
            .map((a: unknown) =>
              typeof a === "string" ? a : JSON.stringify(a)
            )
            .join(" ");
          pushLine("stdout", text);
        },
      });
      containerRef.current = c;

      for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
        c.writeFile(path, content);
      }

      setIsBooted(true);
      pushLine("info", "Container booted. React project loaded.");
      pushLine("info", "Try: npm install lucide-react");
      pushLine(
        "info",
        "Then import icons in any .jsx file and save to see them live."
      );
      refreshFiles();
      setSelectedFile("/src/App.jsx");
      setFileContent(VIRTUAL_FILES["/src/App.jsx"]);

      const html = await assembleHtml(c, "/");
      setHtmlSrc(html);
    })();
  }, [pushLine, refreshFiles]);

  // -- listen for route changes from the iframe --

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

  // -- actions --

  const navigateTo = useCallback(
    async (path: string) => {
      setCurrentPath(path);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, path];
      });
      setHistoryIdx((prev) => prev + 1);
      await rebuildPreview(path);
    },
    [historyIdx, rebuildPreview]
  );

  const goBack = useCallback(async () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    await rebuildPreview(path);
  }, [history, historyIdx, rebuildPreview]);

  const goForward = useCallback(async () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    await rebuildPreview(path);
  }, [history, historyIdx, rebuildPreview]);

  const refresh = useCallback(async () => {
    await rebuildPreview(currentPath);
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
    async (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
      await rebuildPreview(currentPath);
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
      const trimmed = cmd.trim();
      if (/^(npm|pnpm)\s+(install|i|add|uninstall|remove|rm)\b/.test(trimmed)) {
        await rebuildPreview(currentPath);
      }
    },
    [pushLine, refreshFiles, rebuildPreview, currentPath]
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
