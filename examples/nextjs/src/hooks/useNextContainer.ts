import { useState, useCallback, useRef, useEffect } from "react";
import {
  MemFS,
  NextDevServer,
  PackageManager,
  PackageCache,
  ServerBridge,
  getServerBridge,
  type HMRUpdate,
} from "@run0/jiki";

import type { TerminalLine } from '@run0/jiki-ui';
export type { TerminalLine };

export interface HMREvent {
  id: number;
  type: HMRUpdate["type"];
  path: string;
  timestamp: number;
}

import type { FileEntry } from '@run0/jiki-ui';
export type { FileEntry };

// ---------------------------------------------------------------------------
// Virtual project files — an App Router Next.js project
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "my-next-app",
      version: "0.1.0",
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: {
        next: "^14.0.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
    },
    null,
    2
  ),

  "/tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "es5",
        lib: ["dom", "dom.iterable", "esnext"],
        jsx: "preserve",
        module: "esnext",
        moduleResolution: "bundler",
        paths: { "@/*": ["./*"] },
      },
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
    null,
    2
  ),

  "/next.config.js": `/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
};`,

  "/app/globals.css": `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }`,

  "/app/layout.tsx": `export default function RootLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-black antialiased flex flex-col">
      <nav className="border-b border-black/10 sticky top-0 z-50 bg-white">
        <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
          <a href="/" className="text-sm font-bold tracking-tight">next.</a>
          <div className="flex items-center gap-5">
            <a href="/" className="text-sm text-black/40 hover:text-black transition-colors">Home</a>
            <a href="/about" className="text-sm text-black/40 hover:text-black transition-colors">About</a>
            <a href="/dashboard" className="text-sm text-black/40 hover:text-black transition-colors">Dashboard</a>
            <a href="/typescript" className="text-sm text-black/40 hover:text-black transition-colors">TypeScript</a>
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/10 mt-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs font-bold tracking-tight">next.</span>
          <span className="text-xs text-black/30">Next.js 14 &middot; Tailwind &middot; jiki</span>
        </div>
      </footer>
    </div>
  );
}`,

  // ── Home Page ──

  "/app/page.tsx": `export default function Home() {
  return (
    <div>
      <section className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Next.js 14 &middot; App Router</p>
        <h1 className="text-5xl font-black leading-[1.1] tracking-tight mb-4">
          Full-stack React.<br/>In the browser.
        </h1>
        <p className="text-base text-black/50 leading-relaxed max-w-md mb-10">
          A complete Next.js application with App Router, HMR, CSS Modules, and API routes — running entirely in a jiki virtual filesystem.
        </p>
        <div className="flex gap-3">
          <a href="/about" className="px-4 py-2 bg-black text-white text-sm font-bold inline-block">Learn more</a>
          <a href="/dashboard" className="px-4 py-2 border-2 border-black text-sm font-bold inline-block">Dashboard</a>
        </div>
      </section>

      <section className="border-t border-black/10">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-8">
            {[
              { title: 'App Router', desc: 'File-based routing with layouts, nested routes, and dynamic segments.' },
              { title: 'HMR', desc: 'Edit a file and see changes instantly without a full reload.' },
              { title: 'CSS Modules', desc: 'Scoped styling with .module.css files and hashed class names.' },
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

  // ── About Page ──

  "/app/about/page.tsx": `export default function About() {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">About</p>
      <h1 className="text-4xl font-black leading-[1.1] tracking-tight mb-4">How it works.</h1>
      <p className="text-base text-black/50 leading-relaxed max-w-md mb-12">
        No server, no Node.js process. Everything runs client-side using a virtual filesystem and the NextDevServer.
      </p>

      <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Architecture</h2>
      <ol className="space-y-3 mb-12">
        {[
          { title: 'Virtual Filesystem', desc: 'All project files live in an in-memory MemFS' },
          { title: 'NextDevServer', desc: 'Routes requests, resolves pages, transforms code with esbuild-wasm' },
          { title: 'HMR via postMessage', desc: 'File changes trigger HMR events delivered to the preview iframe' },
          { title: 'React Refresh', desc: 'Components hot-reload while preserving state' },
        ].map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-xs font-black text-black/20 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <span className="text-sm font-bold">{item.title}.</span>
              <span className="text-sm text-black/40"> {item.desc}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t border-black/10 pt-8">
        <p className="text-sm"><span className="font-bold">Try it:</span> <span className="text-black/50">edit any file in the explorer, press</span> <kbd className="text-xs font-mono bg-black/5 px-1.5 py-0.5">Ctrl+S</kbd> <span className="text-black/50">to save. HMR updates the preview instantly.</span></p>
      </div>
    </div>
  );
}`,

  // ── Dashboard Page (interactive state) ──

  "/app/dashboard/page.tsx": `export default function Dashboard() {
  const [count, setCount] = React.useState(0);
  const [time, setTime] = React.useState(new Date().toLocaleTimeString());

  React.useEffect(() => {
    const interval = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Dashboard</p>
          <h1 className="text-4xl font-black tracking-tight">Live state.</h1>
        </div>
        <span className="text-xs font-mono text-black/30">{time}</span>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-10 border-b border-black/10 pb-10">
        {[
          { label: 'Page Views', value: '12,847' },
          { label: 'Active Users', value: '3,429' },
          { label: 'Bounce Rate', value: '24.3%' },
        ].map((s, i) => (
          <div key={i}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs text-black/30 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Counter</h2>
        <p className="text-xs text-black/40 mb-4">Uses useState. Edit and save — HMR preserves the value.</p>
        <div className="flex items-center gap-4">
          <button onClick={() => setCount((c) => c - 1)} className="w-9 h-9 border-2 border-black text-lg font-bold flex items-center justify-center bg-white cursor-pointer">&minus;</button>
          <span className="text-4xl font-black tabular-nums min-w-[60px] text-center">{count}</span>
          <button onClick={() => setCount((c) => c + 1)} className="w-9 h-9 border-2 border-black bg-black text-white text-lg font-bold flex items-center justify-center cursor-pointer">+</button>
        </div>
      </div>
    </div>
  );
}`,

  // ── API Route ──

  "/app/api/hello/route.ts": `export async function GET() {
  return Response.json({
    message: 'Hello from the API!',
    timestamp: new Date().toISOString(),
    runtime: 'jiki',
  });
}

export async function POST(request) {
  const body = await request.json();
  return Response.json({
    echo: body,
    received: true,
  });
}`,

  // ── CSS Module example ──

  "/app/styles.module.css": `.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: white;
}

.card {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: white;
  transition: all 0.2s;
}

.card:hover {
  border-color: #8b5cf6;
  box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.1);
}`,

  // ── TypeScript Demo Page ──

  "/app/typescript/page.tsx": `interface Feature {
  id: number;
  title: string;
  description: string;
  status: 'stable' | 'beta' | 'experimental';
}

function useFeatures(): Feature[] {
  return [
    { id: 1, title: 'TypeScript Support', description: 'Full TSX transpilation via esbuild-wasm.', status: 'stable' },
    { id: 2, title: 'App Router', description: 'Nested layouts, route groups, dynamic routes.', status: 'stable' },
    { id: 3, title: 'NPM Packages', description: 'Install packages from npm and use them.', status: 'beta' },
    { id: 4, title: 'API Routes', description: 'Server-side handlers in the virtual runtime.', status: 'stable' },
    { id: 5, title: 'HMR', description: 'Hot Module Replacement with React Refresh.', status: 'stable' },
  ];
}

export default function TypeScriptPage() {
  const features = useFeatures();
  const [filter, setFilter] = React.useState<Feature['status'] | 'all'>('all');
  const filtered = filter === 'all' ? features : features.filter(f => f.status === filter);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">TypeScript</p>
      <h1 className="text-4xl font-black tracking-tight mb-2">Typed components.</h1>
      <p className="text-sm text-black/40 mb-8">
        Interfaces, generics, and typed hooks — all transpiled in the browser via esbuild-wasm.
      </p>

      <div className="flex gap-2 mb-6">
        {(['all', 'stable', 'beta', 'experimental'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={\`px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors \${
              filter === s ? 'bg-black text-white' : 'text-black/30 hover:text-black'
            }\`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(f => (
          <div key={f.id} className="flex items-baseline justify-between border-b border-black/5 pb-3">
            <div>
              <span className="text-sm font-bold">{f.title}</span>
              <span className="text-sm text-black/40 ml-2">{f.description}</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/20">{f.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}`,

  "/public/robots.txt": `User-agent: *
Allow: /`,
};

// Pages Router file set (used when toggling to Pages Router mode)
const PAGES_ROUTER_FILES: Record<string, string> = {
  "/pages/_app.tsx": `export default function App({ Component, pageProps }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased flex flex-col">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="text-lg font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            NextApp
          </a>
          <div className="flex items-center gap-1">
            <a href="/" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">Home</a>
            <a href="/about" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">About</a>
          </div>
        </div>
      </nav>
      <main className="flex-1"><Component {...pageProps} /></main>
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
          Built with <span className="font-semibold text-violet-600">jiki</span> — Pages Router mode
        </div>
      </footer>
    </div>
  );
}`,

  "/pages/index.tsx": `export default function Home() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-center">
      <h1 className="text-4xl font-extrabold mb-4">Pages Router Mode</h1>
      <p className="text-lg text-gray-600 mb-8">This demo is running with the classic Next.js Pages Router.</p>
      <a href="/about" className="px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors">
        About Page
      </a>
    </div>
  );
}`,

  "/pages/about.tsx": `export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-4">About (Pages Router)</h1>
      <p className="text-gray-600 leading-relaxed">
        This page uses the traditional <code className="px-1 py-0.5 bg-gray-100 rounded text-sm">/pages</code> directory.
        Toggle to App Router to see the newer layout-based architecture.
      </p>
    </div>
  );
}`,

  "/pages/api/hello.ts": `export default function handler(req, res) {
  res.status(200).json({ message: 'Hello from Pages Router API!', method: req.method });
}`,

  "/styles/globals.css": VIRTUAL_FILES["/app/globals.css"],
};

// ---------------------------------------------------------------------------
// HTML assembly — reads MemFS files and builds a self-contained page
// that works in an srcdoc iframe (no service worker needed).
// ---------------------------------------------------------------------------

interface PageInfo {
  route: string;
  filePath: string;
  fnName: string;
  code: string;
}

function discoverAppPages(
  vfs: MemFS,
  dirPath: string,
  routePrefix: string
): PageInfo[] {
  const pages: PageInfo[] = [];
  try {
    const entries = vfs.readdirSync(dirPath) as string[];
    for (const entry of entries) {
      const fullPath = dirPath === "/" ? `/${entry}` : `${dirPath}/${entry}`;
      const stat = vfs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (entry === "api" || entry.startsWith("_")) continue;
        pages.push(...discoverAppPages(vfs, fullPath, `${routePrefix}/${entry}`));
      } else if (/^page\.(tsx?|jsx?)$/.test(entry)) {
        const route = routePrefix || "/";
        const code = vfs.readFileSync(fullPath, "utf-8") as string;
        const exportMatch = code.match(/export\s+default\s+function\s+(\w+)/);
        const anyMatch = code.match(/function\s+(\w+)/);
        const fnName =
          exportMatch?.[1] ||
          anyMatch?.[1] ||
          `Page_${route.replace(/[^a-zA-Z0-9]/g, "_")}`;
        pages.push({ route, filePath: fullPath, fnName, code });
      }
    }
  } catch {
    /* dir may not exist */
  }
  return pages;
}

function discoverPagesRouterPages(
  vfs: MemFS,
  dirPath: string,
  routePrefix: string
): PageInfo[] {
  const pages: PageInfo[] = [];
  try {
    const entries = vfs.readdirSync(dirPath) as string[];
    for (const entry of entries) {
      const fullPath = dirPath === "/" ? `/${entry}` : `${dirPath}/${entry}`;
      const stat = vfs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (entry === "api") continue;
        pages.push(...discoverPagesRouterPages(vfs, fullPath, `${routePrefix}/${entry}`));
      } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.startsWith("_")) {
        const name = entry.replace(/\.(tsx?|jsx?)$/, "");
        const route = name === "index" ? (routePrefix || "/") : `${routePrefix}/${name}`;
        const code = vfs.readFileSync(fullPath, "utf-8") as string;
        const exportMatch = code.match(/export\s+default\s+function\s+(\w+)/);
        const anyMatch = code.match(/function\s+(\w+)/);
        const fnName =
          exportMatch?.[1] ||
          anyMatch?.[1] ||
          `Page_${route.replace(/[^a-zA-Z0-9]/g, "_")}`;
        pages.push({ route, filePath: fullPath, fnName, code });
      }
    }
  } catch {
    /* dir may not exist */
  }
  return pages;
}

function stripForBrowser(code: string): string {
  return code
    .replace(/^'use client';\s*/m, "")
    .replace(/^\s*import\s+.*?;\s*$/gm, "")
    .replace(/^\s*export\s+const\s+metadata\s*=[\s\S]*?;\s*$/m, "")
    .replace(/export\s+default\s+function\s+/g, "function ")
    // Strip TypeScript syntax so Babel only needs to handle JSX
    .replace(/^\s*interface\s+\w+\s*\{[^}]*\}/gm, "")
    .replace(/^\s*type\s+\w+\s*=[^;]*;/gm, "")
    .replace(/\s+as\s+const\b/g, "")
    .replace(/(const|let|var)\s+(\w+)\s*:\s*\w+(?:\[[^\]]*\])?\s*=/g, "$1 $2 =")
    .replace(/\)\s*:\s*\w+(?:\[[^\]]*\])?\s*\{/g, ") {")
    .replace(/(\{[^}]+\})\s*:\s*\{[^}]+\}/g, "$1")
    .replace(/(\.\w+)<[^>]+>\(/g, "$1(");
}

function assembleHtml(vfs: MemFS, route: string, mode: RouterMode = "app"): string {
  let globalCss = "";
  try {
    const cssPath = mode === "app" ? "/app/globals.css" : "/styles/globals.css";
    globalCss = vfs.readFileSync(cssPath, "utf-8") as string;
  } catch {
    try {
      globalCss = vfs.readFileSync("/app/globals.css", "utf-8") as string;
    } catch {
      /* no CSS */
    }
  }

  // Read layout (App Router) or _app wrapper (Pages Router)
  let layoutCode = "";
  let layoutFnName = "RootLayout";

  if (mode === "pages") {
    try {
      const raw = vfs.readFileSync("/pages/_app.tsx", "utf-8") as string;
      const m =
        raw.match(/export\s+default\s+function\s+(\w+)/) ||
        raw.match(/function\s+(\w+)/);
      if (m) layoutFnName = m[1];
      layoutCode = stripForBrowser(raw);
    } catch {
      /* no _app */
    }
  } else {
    try {
      const raw = vfs.readFileSync("/app/layout.tsx", "utf-8") as string;
      const m =
        raw.match(/export\s+default\s+function\s+(\w+)/) ||
        raw.match(/function\s+(\w+)/);
      if (m) layoutFnName = m[1];
      layoutCode = stripForBrowser(raw);
    } catch {
      /* no layout */
    }
  }

  // Discover all pages
  const pages = mode === "pages"
    ? discoverPagesRouterPages(vfs, "/pages", "")
    : discoverAppPages(vfs, "/app", "");

  // Build Babel scripts for all components
  const babelType = 'text/babel" data-presets="react,typescript';
  const scripts: string[] = [];
  if (layoutCode) {
    scripts.push(`<script type="${babelType}">\n${layoutCode}\n<\/script>`);
  }
  for (const page of pages) {
    scripts.push(
      `<script type="${babelType}">\n${stripForBrowser(page.code)}\n<\/script>`
    );
  }

  // Build route map for the client-side router
  const routeEntries = pages
    .map((p) => `    '${p.route}': ${p.fnName}`)
    .join(",\n");

  const escRoute = route.replace(/'/g, "\\'");

  const bootstrap = `<script type="${babelType}">
  function NextRouter() {
    const [path, setPath] = React.useState('${escRoute}');

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

    React.useEffect(() => {
      const handler = (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          e.preventDefault();
          navigate(href);
        }
      };
      document.addEventListener('click', handler, true);
      return () => document.removeEventListener('click', handler, true);
    }, []);

    const routes = {
${routeEntries}
    };

    const Page = routes[path] || (() => (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
        <p style={{ color: '#666', marginTop: 8 }}>Page not found: {path}</p>
        <a href="/" style={{ color: '#7c3aed', marginTop: 16, display: 'inline-block' }}>Go home</a>
      </div>
    ));

    ${
      layoutCode
        ? mode === "pages"
          ? `return <${layoutFnName} Component={Page} pageProps={{}} />;`
          : `return <${layoutFnName}><Page /></${layoutFnName}>;`
        : `return <Page />;`
    }
  }

  try {
    ReactDOM.createRoot(document.getElementById('__next')).render(
      React.createElement(NextRouter)
    );
    window.parent.postMessage({ type: 'preview-ready', route: '${escRoute}' }, '*');
  } catch(e) {
    window.parent.postMessage({ type: 'iframe-error', error: e.stack || e.message }, '*');
  }
<\/script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Next.js App</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script>

    window.onerror = function(msg, src, line, col, err) {
      var text = err ? (err.stack || err.message) : String(msg);
      var d = document.getElementById('__next');
      if (d) d.innerHTML = '<pre style="color:red;padding:1rem;font-size:13px;white-space:pre-wrap">' +
        text.replace(/</g, '&lt;') + '<\\/pre>';
      window.parent.postMessage({ type: 'iframe-error', error: text }, '*');
    };
    window.addEventListener('unhandledrejection', function(e) {
      var text = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'Unhandled rejection';
      window.parent.postMessage({ type: 'iframe-error', error: text }, '*');
    });
  <\/script>
  <style>
${globalCss}
  </style>
</head>
<body>
  <div id="__next"></div>
  ${scripts.join("\n  ")}
  ${bootstrap}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;
let hmrId = 0;

export type RouterMode = "app" | "pages";

export function useNextContainer() {
  const vfsRef = useRef<MemFS | null>(null);
  const serverRef = useRef<NextDevServer | null>(null);
  const bridgeRef = useRef<ServerBridge | null>(null);
  const pkgCacheRef = useRef(new PackageCache());
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
  const [hmrEvents, setHmrEvents] = useState<HMREvent[]>([]);
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [routerMode, setRouterMode] = useState<RouterMode>("app");
  const [installing, setInstalling] = useState(false);
  const [hmrFlash, setHmrFlash] = useState(false);

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const pushHMREvent = useCallback((update: HMRUpdate) => {
    setHmrFlash(true);
    setTimeout(() => setHmrFlash(false), 600);
    setHmrEvents((prev) => [
      ...prev.slice(-49),
      {
        id: ++hmrId,
        type: update.type,
        path: update.path,
        timestamp: update.timestamp || Date.now(),
      },
    ]);
  }, []);

  const refreshFiles = useCallback(() => {
    const vfs = vfsRef.current;
    if (!vfs) return;
    const buildTree = (dirPath: string): FileEntry[] => {
      try {
        const entries = vfs.readdirSync(dirPath) as string[];
        return entries
          .filter((n: string) => !n.startsWith("."))
          .sort((a: string, b: string) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = vfs.statSync(fullA).isDirectory();
            const bDir = vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name: string) => {
            const fullPath =
              dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = vfs.statSync(fullPath).isDirectory();
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

  const rebuildPreview = useCallback((route: string, mode?: RouterMode) => {
    const vfs = vfsRef.current;
    if (!vfs) return;
    // Note: assembleHtml is used for the srcdoc fallback because it produces a
    // self-contained HTML string with all scripts inlined via CDN + Babel.
    // NextDevServer.handleRequest() returns HTML with relative URLs to server
    // resources (/_next/shims/, /_npm/, etc.) which require an active Service
    // Worker bridge to resolve — they would 404 in a plain srcdoc iframe.
    setHtmlSrc(assembleHtml(vfs, route, mode ?? routerMode));
  }, [routerMode]);

  // ── Boot ──

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const vfs = new MemFS();
    vfsRef.current = vfs;

    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      const dir = path.substring(0, path.lastIndexOf("/"));
      if (dir && dir !== "/") vfs.mkdirSync(dir, { recursive: true });
      vfs.writeFileSync(path, content);
    }

    const server = new NextDevServer(vfs, {
      port: 3000,
      root: "/",
      preferAppRouter: true,
      env: { NEXT_PUBLIC_APP_NAME: "NextApp Demo" },
    });
    serverRef.current = server;

    server.on("hmr-update", (update: HMRUpdate) => {
      pushHMREvent(update);
      pushLine("info", `[HMR] ${update.type}: ${update.path}`);
    });

    server.start();

    // Try Service Worker bridge for real HTTP URLs, fall back to srcdoc
    (async () => {
      try {
        const bridge = getServerBridge();
        bridgeRef.current = bridge;
        await bridge.initServiceWorker();
        bridge.registerServer(server, 3000);
        const url = bridge.getServerUrl(3000);
        setPreviewUrl(url);
        pushLine("info", "Service Worker bridge active — real HTTP preview");
      } catch {
        pushLine("info", "Service Worker not available — using srcdoc preview");
        setHtmlSrc(assembleHtml(vfs, "/"));
      }
    })();

    pushLine("info", "Next.js dev server started on port 3000");
    pushLine("info", "App Router detected: /app directory");
    pushLine("info", "HMR enabled — edit files and save to see live updates.");
    refreshFiles();
    setSelectedFile("/app/page.tsx");
    setFileContent(VIRTUAL_FILES["/app/page.tsx"]);
    setIsBooted(true);
  }, [pushLine, pushHMREvent, refreshFiles, rebuildPreview]);

  // Listen for messages from the iframe (route changes + error forwarding)
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
      if (e.data?.type === "iframe-error") {
        pushLine("stderr", `[Preview] ${e.data.error}`);
      }
      if (e.data?.type === "preview-ready") {
        pushLine("info", `[Preview] Rendered route: ${e.data.route}`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [historyIdx, pushLine]);

  // ── Navigation ──

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

  // ── File operations ──

  const selectFile = useCallback(
    (path: string) => {
      const vfs = vfsRef.current;
      if (!vfs) return;
      try {
        const content = vfs.readFileSync(path, "utf-8") as string;
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
      const vfs = vfsRef.current;
      if (!vfs) return;
      vfs.writeFileSync(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
      rebuildPreview(currentPath);
    },
    [refreshFiles, pushLine, rebuildPreview, currentPath]
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  const clearHMRLog = useCallback(() => {
    setHmrEvents([]);
  }, []);

  // ── Router Mode Toggle ──

  const toggleRouterMode = useCallback(
    (mode: RouterMode) => {
      const vfs = vfsRef.current;
      if (!vfs || mode === routerMode) return;

      const oldServer = serverRef.current;
      if (oldServer) oldServer.stop();

      if (mode === "pages") {
        // Remove /app dir, write /pages files
        try {
          const purge = (dir: string) => {
            try {
              for (const e of vfs.readdirSync(dir) as string[]) {
                const p = `${dir}/${e}`;
                if (vfs.statSync(p).isDirectory()) { purge(p); vfs.rmdirSync(p); }
                else vfs.unlinkSync(p);
              }
            } catch { /* ok */ }
          };
          purge("/app");
          vfs.rmdirSync("/app");
        } catch { /* ok */ }

        for (const [path, content] of Object.entries(PAGES_ROUTER_FILES)) {
          const dir = path.substring(0, path.lastIndexOf("/"));
          if (dir && dir !== "/") vfs.mkdirSync(dir, { recursive: true });
          vfs.writeFileSync(path, content);
        }
      } else {
        // Remove /pages dir, write /app files
        try {
          const purge = (dir: string) => {
            try {
              for (const e of vfs.readdirSync(dir) as string[]) {
                const p = `${dir}/${e}`;
                if (vfs.statSync(p).isDirectory()) { purge(p); vfs.rmdirSync(p); }
                else vfs.unlinkSync(p);
              }
            } catch { /* ok */ }
          };
          purge("/pages");
          vfs.rmdirSync("/pages");
        } catch { /* ok */ }

        for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
          if (!path.startsWith("/app")) continue;
          const dir = path.substring(0, path.lastIndexOf("/"));
          if (dir && dir !== "/") vfs.mkdirSync(dir, { recursive: true });
          vfs.writeFileSync(path, content);
        }
      }

      const server = new NextDevServer(vfs, {
        port: 3000,
        root: "/",
        preferAppRouter: mode === "app",
        env: { NEXT_PUBLIC_APP_NAME: "NextApp Demo" },
      });
      serverRef.current = server;

      server.on("hmr-update", (update: HMRUpdate) => {
        pushHMREvent(update);
        pushLine("info", `[HMR] ${update.type}: ${update.path}`);
      });
      server.start();

      if (bridgeRef.current) {
        bridgeRef.current.unregisterServer(3000);
        bridgeRef.current.registerServer(server, 3000);
      }

      setRouterMode(mode);
      pushLine(
        "info",
        `Switched to ${mode === "app" ? "App" : "Pages"} Router`
      );
      refreshFiles();
      setCurrentPath("/");
      rebuildPreview("/", mode);
    },
    [routerMode, pushLine, pushHMREvent, refreshFiles, rebuildPreview]
  );

  // ── Package Installation ──

  const installPackage = useCallback(
    async (packageName: string) => {
      const vfs = vfsRef.current;
      if (!vfs || installing) return;

      setInstalling(true);
      pushLine("command", `npm install ${packageName}`);

      try {
        // Share a package cache across installs for faster repeat downloads
        const pm = new PackageManager(vfs, { cache: pkgCacheRef.current });
        const result = await pm.install([packageName], {
          save: true,
          onProgress: (msg: string) => pushLine("stdout", msg),
        });

        pushLine(
          "info",
          `Installed ${result.added.length} package(s): ${result.added.join(", ")}`
        );

        serverRef.current?.invalidatePackageCache();

        // Auto-generate a demo page for the installed package
        const demoRoute = `/${packageName.replace(/[^a-zA-Z0-9]/g, "-")}`;
        const demoDir =
          routerMode === "app"
            ? `/app${demoRoute}`
            : `/pages`;
        const demoFile =
          routerMode === "app"
            ? `${demoDir}/page.tsx`
            : `/pages${demoRoute}.tsx`;

        vfs.mkdirSync(demoDir, { recursive: true });

        const safeName = packageName.replace(/[^a-zA-Z0-9]/g, "_");
        const componentName = safeName.charAt(0).toUpperCase() + safeName.slice(1) + "Demo";
        const demoCode = `import * as ${safeName} from '${packageName}';

export default function ${componentName}() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-4">${packageName} Demo</h1>
      <p className="text-gray-600 mb-6">
        Package <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono">${packageName}</code> is installed and ready to use.
      </p>
      <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
        <pre className="text-sm font-mono text-gray-700 overflow-auto">{JSON.stringify(Object.keys(${safeName}), null, 2)}</pre>
      </div>
    </div>
  );
}`;

        vfs.writeFileSync(demoFile, demoCode);
        pushLine("info", `Created demo page: ${demoFile}`);

        refreshFiles();
        navigateTo(demoRoute);
      } catch (err) {
        pushLine(
          "stderr",
          `Install failed: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setInstalling(false);
      }
    },
    [installing, pushLine, refreshFiles, navigateTo, routerMode]
  );

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    htmlSrc,
    previewUrl,
    currentPath,
    hmrEvents,
    hmrFlash,
    routerMode,
    installing,
    canGoBack: historyIdx > 0,
    canGoForward: historyIdx < history.length - 1,
    navigateTo,
    goBack,
    goForward,
    refresh,
    selectFile,
    saveFile,
    clearTerminal,
    clearHMRLog,
    toggleRouterMode,
    installPackage,
  };
}
