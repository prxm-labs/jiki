import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  type Container,
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  extractPackageName,
  preprocessImports,
  initTranspiler,
  transpile,
} from "@run0/jiki";

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


// ---------------------------------------------------------------------------
// Virtual project: React + Radix UI + react-use hooks
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Radix + Hooks Demo</title>
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
    { path: '/', label: 'Avatars' },
    { path: '/hooks', label: 'Hooks' },
    { path: '/combined', label: 'Combined' },
  ];

  return (
    <nav className="border-b border-black/10 sticky top-0 z-50 bg-white">
      <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
        <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/'); }} className="text-sm font-bold tracking-tight text-black no-underline">
          <span className="text-violet-500">r</span>adix.
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

  "/src/pages/Avatars.jsx": `import { Avatar } from 'radix-ui';

function Avatars() {
  const users = [
    { name: 'Colm Tuite', initials: 'CT', src: 'https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?&w=128&h=128&dpr=2&q=80' },
    { name: 'Pedro Duarte', initials: 'PD', src: 'https://images.unsplash.com/photo-1511485977113-f34c92461ad9?ixlib=rb-1.2.1&w=128&h=128&dpr=2&q=80' },
    { name: 'Sarah Johnson', initials: 'SJ', src: '' },
    { name: 'Alex Rivera', initials: 'AR', src: '' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Radix UI Avatars</h1>
      <p className="text-gray-500 mb-8">
        Compound components from <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm">radix-ui</code>, bundled from the virtual filesystem.
      </p>

      <div className="space-y-8">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Team Members</h2>
          <div className="flex gap-5 items-center">
            {users.map((user) => (
              <div key={user.initials} className="flex flex-col items-center gap-2">
                <Avatar.Root className="inline-flex size-[56px] select-none items-center justify-center overflow-hidden rounded-full bg-violet-100 ring-2 ring-violet-200">
                  {user.src && (
                    <Avatar.Image
                      className="size-full rounded-[inherit] object-cover"
                      src={user.src}
                      alt={user.name}
                    />
                  )}
                  <Avatar.Fallback
                    className="flex size-full items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-semibold"
                    delayMs={600}
                  >
                    {user.initials}
                  </Avatar.Fallback>
                </Avatar.Root>
                <span className="text-xs font-medium text-gray-600">{user.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Sizes</h2>
          <div className="flex gap-4 items-end">
            {[32, 40, 48, 56, 64].map((size) => (
              <Avatar.Root
                key={size}
                className="inline-flex select-none items-center justify-center overflow-hidden rounded-full bg-violet-100"
                style={{ width: size, height: size }}
              >
                <Avatar.Fallback className="flex size-full items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-semibold" style={{ fontSize: size * 0.35 }}>
                  {size}
                </Avatar.Fallback>
              </Avatar.Root>
            ))}
          </div>
        </div>

        <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
          <h3 className="text-sm font-semibold text-violet-800 mb-2">How it works</h3>
          <p className="text-xs text-violet-600 leading-relaxed">
            The <code className="px-1 py-0.5 bg-white rounded">radix-ui</code> package is bundled from the virtual filesystem using <code className="px-1 py-0.5 bg-white rounded">bundlePackageForBrowser()</code>. The process shim provides <code className="px-1 py-0.5 bg-white rounded">process.env.NODE_ENV</code> for conditional exports, and the jsx-runtime shim provides <code className="px-1 py-0.5 bg-white rounded">jsx()</code> / <code className="px-1 py-0.5 bg-white rounded">jsxs()</code> functions.
          </p>
        </div>
      </div>
    </div>
  );
}`,

  "/src/pages/Hooks.jsx": `import { useToggle, useCounter, usePrevious } from 'react-use';

function Hooks() {
  const [isDark, toggleDark] = useToggle(false);
  const [count, { inc, dec, reset }] = useCounter(0, 99, 0);
  const prevCount = usePrevious(count);

  return (
    <div className={\`min-h-[calc(100vh-56px)] transition-colors duration-300 \${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}\`}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">react-use Hooks</h1>
        <p className={\`mb-8 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
          Custom hooks from <code className={\`px-1.5 py-0.5 rounded text-sm \${isDark ? 'bg-gray-800' : 'bg-gray-100'}\`}>react-use</code>, bundled with the process shim.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className={\`p-6 rounded-xl border \${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}\`}>
            <h2 className="text-lg font-semibold mb-4">useToggle</h2>
            <p className={\`text-sm mb-4 \${isDark ? 'text-gray-400' : 'text-gray-600'}\`}>
              Current: <strong>{isDark ? 'Dark' : 'Light'}</strong> mode
            </p>
            <button
              onClick={toggleDark}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              Toggle Theme
            </button>
          </div>

          <div className={\`p-6 rounded-xl border \${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}\`}>
            <h2 className="text-lg font-semibold mb-4">useCounter</h2>
            <p className={\`text-sm mb-1 \${isDark ? 'text-gray-400' : 'text-gray-600'}\`}>
              Count: <strong className="text-2xl text-violet-600">{count}</strong>
            </p>
            <p className={\`text-xs mb-4 \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>
              Previous: {prevCount !== undefined ? prevCount : 'n/a'} (via usePrevious)
            </p>
            <div className="flex gap-2">
              <button onClick={() => dec()} className={\`px-3 py-1.5 rounded-lg text-sm font-medium border \${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}\`}>
                - 1
              </button>
              <button onClick={() => inc()} className={\`px-3 py-1.5 rounded-lg text-sm font-medium border \${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}\`}>
                + 1
              </button>
              <button onClick={reset} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className={\`mt-8 p-4 rounded-xl border \${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-amber-50 border-amber-200'}\`}>
          <h3 className={\`text-sm font-semibold mb-2 \${isDark ? 'text-amber-400' : 'text-amber-800'}\`}>Process Shim in Action</h3>
          <p className={\`text-xs leading-relaxed \${isDark ? 'text-amber-300/70' : 'text-amber-600'}\`}>
            The <code className={\`px-1 py-0.5 rounded \${isDark ? 'bg-gray-700' : 'bg-white'}\`}>react-use</code> hooks use <code className={\`px-1 py-0.5 rounded \${isDark ? 'bg-gray-700' : 'bg-white'}\`}>process.env.NODE_ENV</code> internally for dev-only warnings. The browser-bundle require shim provides a process polyfill so these packages work without errors.
          </p>
        </div>
      </div>
    </div>
  );
}`,

  "/src/pages/Combined.jsx": `import { Avatar } from 'radix-ui';
import { useToggle, useCounter } from 'react-use';

function Combined() {
  const [showAvatars, toggleAvatars] = useToggle(true);
  const [likes, { inc: addLike }] = useCounter(0);

  const team = [
    { name: 'Emma', initials: 'EM', color: 'from-pink-500 to-rose-600' },
    { name: 'Liam', initials: 'LI', color: 'from-blue-500 to-indigo-600' },
    { name: 'Olivia', initials: 'OL', color: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Combined Demo</h1>
      <p className="text-gray-500 mb-8">
        Radix UI components and react-use hooks working together.
      </p>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleAvatars}
            className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${
              showAvatars
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }\`}
          >
            {showAvatars ? 'Hide Team' : 'Show Team'}
          </button>
          <button
            onClick={() => addLike()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100 transition-colors"
          >
            \u2764\uFE0F {likes} {likes === 1 ? 'like' : 'likes'}
          </button>
        </div>

        {showAvatars && (
          <div className="grid grid-cols-3 gap-4">
            {team.map((member) => (
              <div key={member.initials} className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
                <Avatar.Root className="inline-flex size-[72px] select-none items-center justify-center overflow-hidden rounded-full">
                  <Avatar.Fallback className={\`flex size-full items-center justify-center bg-gradient-to-br \${member.color} text-white text-xl font-bold\`}>
                    {member.initials}
                  </Avatar.Fallback>
                </Avatar.Root>
                <span className="font-medium text-gray-900">{member.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-200">
          <h3 className="text-sm font-semibold text-violet-800 mb-2">What this demonstrates</h3>
          <ul className="text-xs text-violet-600 space-y-1">
            <li>\u2022 <strong>radix-ui</strong> Avatar compound components (Root, Image, Fallback)</li>
            <li>\u2022 <strong>react-use</strong> useToggle for show/hide state</li>
            <li>\u2022 <strong>react-use</strong> useCounter for the like button</li>
            <li>\u2022 <strong>process shim</strong> for NODE_ENV-conditional code in bundled packages</li>
            <li>\u2022 <strong>jsx-runtime shim</strong> for packages using automatic JSX transform</li>
          </ul>
        </div>
      </div>
    </div>
  );
}`,

  "/package.json": `{
  "name": "radix-hooks-demo",
  "dependencies": {
    "radix-ui": "1.0.0",
    "react-use": "17.0.0"
  }
}`,

  "/node_modules/radix-ui/package.json": `{
  "name": "radix-ui",
  "version": "1.0.0",
  "main": "index.js"
}`,

  "/node_modules/radix-ui/index.js": `'use strict';
var jsx = require('react/jsx-runtime');
var React = require('react');

if (process.env.NODE_ENV !== 'production') {
  console.warn('[radix-ui] Running in development mode');
}

function AvatarRoot(props) {
  return jsx.jsx('span', {
    className: props.className,
    style: props.style,
    children: props.children
  });
}

function AvatarImage(props) {
  var ref = React.useState(false);
  var loaded = ref[0];
  var setLoaded = ref[1];
  var ref2 = React.useState(false);
  var errored = ref2[0];
  var setErrored = ref2[1];

  React.useEffect(function() {
    if (!props.src) { setErrored(true); return; }
    var img = new Image();
    img.src = props.src;
    img.onload = function() { setLoaded(true); };
    img.onerror = function() { setErrored(true); };
  }, [props.src]);

  if (!loaded || errored) return null;

  return jsx.jsx('img', {
    className: props.className,
    src: props.src,
    alt: props.alt,
    style: { width: '100%', height: '100%', objectFit: 'cover' }
  });
}

function AvatarFallback(props) {
  var ref = React.useState(false);
  var show = ref[0];
  var setShow = ref[1];
  var delay = props.delayMs || 0;

  React.useEffect(function() {
    var timer = setTimeout(function() { setShow(true); }, delay);
    return function() { clearTimeout(timer); };
  }, [delay]);

  if (!show) return null;

  return jsx.jsx('span', {
    className: props.className,
    children: props.children
  });
}

exports.Avatar = {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback
};
`,

  "/node_modules/react-use/package.json": `{
  "name": "react-use",
  "version": "17.0.0",
  "main": "index.js"
}`,

  "/node_modules/react-use/index.js": `'use strict';
var React = require('react');

if (process.env.NODE_ENV !== 'production') {
  console.warn('[react-use] Running in development mode');
}

function useToggle(initial) {
  var ref = React.useState(!!initial);
  var state = ref[0];
  var setState = ref[1];
  var toggle = React.useCallback(function(next) {
    setState(function(prev) {
      return typeof next === 'boolean' ? next : !prev;
    });
  }, []);
  return [state, toggle];
}

function useCounter(initial, max, min) {
  var ref = React.useState(initial || 0);
  var count = ref[0];
  var setCount = ref[1];
  var initialValue = initial || 0;
  var actions = React.useMemo(function() {
    return {
      inc: function(delta) {
        setCount(function(c) {
          var next = c + (delta || 1);
          return max !== undefined ? Math.min(next, max) : next;
        });
      },
      dec: function(delta) {
        setCount(function(c) {
          var next = c - (delta || 1);
          return min !== undefined ? Math.max(next, min) : next;
        });
      },
      set: function(v) { setCount(v); },
      reset: function() { setCount(initialValue); }
    };
  }, [max, min, initialValue]);
  return [count, actions];
}

function usePrevious(value) {
  var ref = React.useRef();
  React.useEffect(function() {
    ref.current = value;
  });
  return ref.current;
}

exports.useToggle = useToggle;
exports.useCounter = useCounter;
exports.usePrevious = usePrevious;
`,

  "/src/App.jsx": `function App() {
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
    case '/hooks':    Page = Hooks;    break;
    case '/combined': Page = Combined; break;
    default:          Page = Avatars;  break;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Navbar currentPath={path} onNavigate={navigate} />
      <main className="flex-1"><Page /></main>
      <footer className="border-t border-black/10 mt-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs font-bold tracking-tight"><span className="text-violet-500">r</span>adix.</span>
          <span className="text-xs text-black/30">Radix UI &middot; react-use &middot; jiki</span>
        </div>
      </footer>
    </div>
  );
}`,
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const CDN_GLOBALS: Record<string, string> = {
  react: "React",
  "react-dom": "ReactDOM",
  "react-dom/client": "ReactDOM",
};

const CDN_EXTERNALS = new Set(Object.keys(CDN_GLOBALS));

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
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
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

async function assembleHtml(
  container: Container,
  route: string
): Promise<string> {
  let html: string;
  try {
    html = container.readFile("/index.html");
  } catch {
    return "<html><body><p>Error: /index.html not found</p></body></html>";
  }

  const componentPaths = sortComponentPaths(
    discoverComponents(container, "/src")
  );

  const sources: string[] = [];
  const transpileJobs: Array<{ code: string; path: string }> = [];
  for (const p of componentPaths) {
    try {
      const code = container.readFile(p);
      sources.push(code);
      transpileJobs.push({ code, path: p });
    } catch {
      /* skip */
    }
  }

  const transpiled = await Promise.all(
    transpileJobs.map(({ code, path }) => transpileComponent(code, path))
  );
  const scripts = transpiled.map((js) => `<script>\n${js}\n<\/script>`);

  const bareImports = scanBareImports(sources);
  for (const specifier of [...bareImports]) {
    const pkg = extractPackageName(specifier);
    if (CDN_EXTERNALS.has(pkg) || CDN_EXTERNALS.has(specifier)) {
      bareImports.delete(specifier);
    }
  }

  const bundles = new Map();
  for (const specifier of bareImports) {
    try {
      const bundle = bundlePackageForBrowser(
        container.vfs,
        specifier,
        CDN_EXTERNALS
      );
      bundles.set(specifier, bundle);
    } catch (err) {
      console.warn(`[assembleHtml] Could not bundle "${specifier}":`, err);
    }
  }

  const requireShim = generateRequireScript(bundles, CDN_GLOBALS);

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

export function useReactRadixContainer() {
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

  const rebuildPreview = useCallback(async (route: string) => {
    const c = containerRef.current;
    if (!c) return;
    try {
      const html = await assembleHtml(c, route);
      setHtmlSrc(html);
    } catch (err) {
      console.error("[rebuildPreview]", err);
      setHtmlSrc(
        `<html><body><pre style="color:red;padding:1em">${String(
          err
        )}</pre></body></html>`
      );
    }
  }, []);

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
      pushLine("info", "Container booted. Radix + Hooks demo loaded.");
      pushLine("info", "radix-ui and react-use are pre-installed.");
      pushLine("info", "Edit files and save to see changes live.");
      refreshFiles();
      setSelectedFile("/src/pages/Avatars.jsx");
      setFileContent(VIRTUAL_FILES["/src/pages/Avatars.jsx"]);

      const html = await assembleHtml(c, "/");
      setHtmlSrc(html);
    })();
  }, [pushLine, refreshFiles]);

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
