import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  boot,
  type Container,
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  extractPackageName,
  preprocessImports,
} from "@run0/jiki";
import type { ChatMessage, FileEntry } from "@run0/jiki-ui";
import {
  saveMessage,
  loadRecentMessages,
  loadMessagesBefore,
  clearAllMessages,
  getLastAssistantCode,
} from "../lib/chat-persistence";
import { streamChatCompletion } from "../lib/openai-stream";
import { extractNamedFiles } from "../lib/code-extractor";
import { getApiKey, clearApiKey } from "../components/ApiKeyModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Frontmatter {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Virtual project files — Astro site with layout, 2 pages, React island
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": `{
  "name": "astro-openai-demo",
  "type": "module",
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/react": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}`,

  "/astro.config.mjs": `import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
});`,

  "/src/layouts/BaseLayout.astro": `---
const { pageTitle } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{pageTitle}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-white text-black">
  <Navbar />
  <main>
    <slot />
  </main>
  <Footer />
</body>
</html>`,

  "/src/components/Navbar.astro": `<nav class="border-b border-black/10">
  <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
    <a href="/" class="text-sm font-bold tracking-tight no-underline text-black">astro.</a>
    <div class="flex gap-6">
      <a href="/" class="text-sm text-black/50 hover:text-black no-underline">Home</a>
      <a href="/about" class="text-sm text-black/50 hover:text-black no-underline">About</a>
    </div>
  </div>
</nav>`,

  "/src/components/Footer.astro": `<footer class="border-t border-black/10 mt-16">
  <div class="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
    <span class="text-xs font-bold tracking-tight">astro.</span>
    <span class="text-xs text-black/30">Astro + React &middot; jiki</span>
  </div>
</footer>`,

  "/src/components/Counter.tsx": `const { useState } = React;

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
      <button
        onClick={() => setCount(c => c - 1)}
        style={{ width: 36, height: 36, border: '2px solid black', background: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}
      >
        &minus;
      </button>
      <span style={{ fontSize: '28px', fontWeight: 900, fontVariantNumeric: 'tabular-nums', minWidth: '48px', textAlign: 'center' }}>
        {count}
      </span>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ width: 36, height: 36, border: '2px solid black', background: 'black', color: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}
      >
        +
      </button>
    </div>
  );
}`,

  "/src/pages/index.astro": `---
layout: ../layouts/BaseLayout.astro
pageTitle: Home
---
<section class="max-w-2xl mx-auto px-6 pt-16 pb-20">
  <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">The web framework</p>
  <h1 class="text-5xl font-black leading-[1.1] tracking-tight mb-4">
    Content-driven.<br/>Zero JavaScript.
  </h1>
  <p class="text-base text-black/50 leading-relaxed max-w-md mb-10">
    Ship static HTML by default. Hydrate React components only where you need interactivity.
  </p>

  <div class="mb-12">
    <p class="text-xs uppercase tracking-widest text-black/30 mb-3">React island</p>
    <Counter client:load />
  </div>

  <div class="border-t border-black/10 pt-10">
    <div class="grid grid-cols-3 gap-8">
      <div>
        <h3 class="text-sm font-bold mb-1">Islands</h3>
        <p class="text-xs text-black/40 leading-relaxed">Only hydrate interactive parts. Everything else is pure HTML.</p>
      </div>
      <div>
        <h3 class="text-sm font-bold mb-1">React</h3>
        <p class="text-xs text-black/40 leading-relaxed">Use React components as interactive islands with client: directives.</p>
      </div>
      <div>
        <h3 class="text-sm font-bold mb-1">Zero JS</h3>
        <p class="text-xs text-black/40 leading-relaxed">Pages ship no JavaScript. You opt in where you need it.</p>
      </div>
    </div>
  </div>
</section>`,

  "/src/pages/about.astro": `---
layout: ../layouts/BaseLayout.astro
pageTitle: About
---
<section class="max-w-2xl mx-auto px-6 pt-16 pb-20">
  <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">About</p>
  <h1 class="text-4xl font-black leading-[1.1] tracking-tight mb-4">
    Built for the modern web.
  </h1>
  <p class="text-base text-black/50 leading-relaxed max-w-md mb-12">
    Real .astro pages with frontmatter, layouts, slots, and React islands. All running in the browser via jiki.
  </p>

  <div class="space-y-6">
    <div>
      <h2 class="text-sm font-bold uppercase tracking-widest mb-4">Stack</h2>
      <div class="space-y-3">
        <div class="flex items-baseline justify-between border-b border-black/5 pb-3">
          <span class="text-sm font-bold">Astro</span>
          <span class="text-xs text-black/30 font-mono">5.x</span>
        </div>
        <div class="flex items-baseline justify-between border-b border-black/5 pb-3">
          <span class="text-sm font-bold">React</span>
          <span class="text-xs text-black/30 font-mono">19.x</span>
        </div>
        <div class="flex items-baseline justify-between">
          <span class="text-sm font-bold">Tailwind CSS</span>
          <span class="text-xs text-black/30 font-mono">4.x</span>
        </div>
      </div>
    </div>

    <div class="pt-4">
      <h2 class="text-sm font-bold uppercase tracking-widest mb-4">How islands work</h2>
      <ol class="space-y-3">
        <li class="flex gap-3">
          <span class="text-xs font-black text-black/20 mt-0.5">01</span>
          <div>
            <span class="text-sm font-bold">Static HTML first.</span>
            <span class="text-sm text-black/40"> Pages render to HTML with no JS.</span>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="text-xs font-black text-black/20 mt-0.5">02</span>
          <div>
            <span class="text-sm font-bold">Add React islands.</span>
            <span class="text-sm text-black/40"> Mark components with client:load to hydrate.</span>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="text-xs font-black text-black/20 mt-0.5">03</span>
          <div>
            <span class="text-sm font-bold">Partial hydration.</span>
            <span class="text-sm text-black/40"> Only islands ship JavaScript.</span>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="text-xs font-black text-black/20 mt-0.5">04</span>
          <div>
            <span class="text-sm font-bold">Ship less.</span>
            <span class="text-sm text-black/40"> Dramatically less JS than a traditional SPA.</span>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`,
};

// ---------------------------------------------------------------------------
// Astro rendering engine
// ---------------------------------------------------------------------------

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const fm: Frontmatter = {};
  if (!raw.startsWith("---")) return { frontmatter: fm, body: raw };
  const end = raw.indexOf("---", 3);
  if (end === -1) return { frontmatter: fm, body: raw };
  const fmBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 3).trim();

  for (const line of fmBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    fm[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
  }

  return { frontmatter: fm, body };
}

function resolveComponent(container: Container, name: string): string {
  try {
    const raw = container.readFile(`/src/components/${name}.astro`);
    const { body } = parseFrontmatter(raw);
    return body;
  } catch {
    return `<!-- Component ${name} not found -->`;
  }
}

function inlineComponents(container: Container, html: string): string {
  const regex = /<([A-Z]\w+)\s*\/>/g;
  let match: RegExpExecArray | null;
  const names = new Set<string>();

  while ((match = regex.exec(html)) !== null) {
    const name = match[1];
    // Skip islands (have client: directive)
    if (html.includes(`<${name} client:`)) continue;
    names.add(name);
  }

  for (const name of names) {
    const tag = new RegExp(`<${name}\\s*/>`, "g");
    const body = resolveComponent(container, name);
    html = html.replace(tag, body);
  }

  return html;
}

function detectIslandFramework(container: Container, name: string): "react" | null {
  for (const ext of [".tsx", ".jsx"]) {
    try { container.readFile(`/src/components/${name}${ext}`); return "react"; }
    catch { /* */ }
  }
  return null;
}

interface IslandDef { id: number; componentName: string; hydration: string; }

function wrapHydration(mode: string, elementId: string): string {
  if (mode === "visible") {
    return `
    if ('IntersectionObserver' in window) {
      var el = document.getElementById('${elementId}');
      if (el) { el.style.minHeight='1px'; var obs = new IntersectionObserver(function(entries) { if (entries[0].isIntersecting) { obs.disconnect(); __mount__(); } }, { threshold:0, rootMargin:'200px 0px' }); obs.observe(el); }
      else { __mount__(); }
    } else { __mount__(); }`;
  }
  if (mode === "idle") {
    return `
    if ('requestIdleCallback' in window) { requestIdleCallback(function() { __mount__(); }); }
    else { setTimeout(function() { __mount__(); }, 200); }`;
  }
  return "__mount__();";
}

function processIslands(container: Container, html: string): string {
  const islands: IslandDef[] = [];
  let islandId = 0;

  const islandRegex = /<(\w+)\s+client:(load|visible|idle)\s*\/>/g;
  html = html.replace(islandRegex, (_m, name: string, hydration: string) => {
    const fw = detectIslandFramework(container, name);
    if (!fw) return `<!-- Island ${name} not found -->`;
    const id = islandId++;
    islands.push({ id, componentName: name, hydration });
    return `<div id="astro-island-${id}"></div>`;
  });

  if (islands.length === 0) return html;

  const cdnExternals = new Set(["react", "react-dom"]);
  const cdnGlobals: Record<string, string> = {
    "react": "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM",
  };

  let cdnScripts =
    '<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>\n' +
    '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>\n' +
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n';

  const islandSources: string[] = [];
  let mountScripts = "";

  for (const island of islands) {
    let source: string;
    try { source = container.readFile(`/src/components/${island.componentName}.tsx`); }
    catch {
      try { source = container.readFile(`/src/components/${island.componentName}.jsx`); }
      catch { mountScripts += `<!-- Could not read ${island.componentName} -->`; continue; }
    }

    islandSources.push(source);
    const processed = preprocessImports(source).replace(/^export\s+default\s+/gm, "").trim();
    const mountId = `astro-island-${island.id}`;

    mountScripts += `<script type="text/babel">
(function() {
  function __mount__() {
    var el = document.getElementById('${mountId}');
    if (!el) return;
    ${processed}
    var root = ReactDOM.createRoot(el);
    root.render(React.createElement(${island.componentName}));
  }
  ${wrapHydration(island.hydration, mountId)}
})();
<\/script>\n`;
  }

  // Bundle bare imports from island sources
  const bareImports = scanBareImports(islandSources);
  for (const s of [...bareImports]) {
    const pkg = extractPackageName(s);
    if (cdnExternals.has(pkg) || cdnExternals.has(s)) bareImports.delete(s);
  }

  const bundles = new Map();
  for (const specifier of bareImports) {
    try { bundles.set(specifier, bundlePackageForBrowser(container.vfs, specifier, cdnExternals)); }
    catch (err) { console.warn(`[processIslands] Could not bundle "${specifier}":`, err); }
  }

  const requireShim = generateRequireScript(bundles, cdnGlobals);

  // Trigger Babel transform
  mountScripts += `<script>
if (typeof Babel !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { Babel.transformScriptTags(); });
  } else { Babel.transformScriptTags(); }
}
<\/script>\n`;

  html = html.replace("</body>", cdnScripts + requireShim + "\n" + mountScripts + "</body>");
  return html;
}

function resolveRelativePath(from: string, relative: string): string {
  const parts = from.substring(0, from.lastIndexOf("/")).split("/");
  for (const seg of relative.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function applyLayout(
  container: Container, layoutPath: string, content: string, frontmatter: Frontmatter
): string {
  const normalizedPath = layoutPath.startsWith("/")
    ? layoutPath
    : `/src/layouts/${layoutPath.replace(/^\.\.\/layouts\//, "")}`;

  try {
    const rawLayout = container.readFile(normalizedPath);
    const { body: layoutBody } = parseFrontmatter(rawLayout);

    let result = layoutBody;
    result = result.replace(/\{pageTitle\}/g,
      (frontmatter.pageTitle as string) || (frontmatter.title as string) || "");
    result = result.replace(/\{frontmatter\.(\w+)\}/g, (_, key) => {
      const val = frontmatter[key];
      return val !== undefined ? String(val) : "";
    });
    result = result.replace(/<slot\s*\/?>/g, content);
    result = inlineComponents(container, result);

    // Nested layouts
    const innerMatch = result.match(/<(BaseLayout|Layout)\s+([^>]*)>([\s\S]*)<\/\1>/);
    if (innerMatch) {
      const parentPath = `/src/layouts/${innerMatch[1]}.astro`;
      const inner = result.match(new RegExp(`<${innerMatch[1]}[^>]*>([\\s\\S]*)<\\/${innerMatch[1]}>`));
      if (inner) {
        const outer = result.split(inner[0]);
        result = outer[0] + applyLayout(container, parentPath, inner[1], frontmatter) + (outer[1] || "");
      }
    }

    return result;
  } catch { return content; }
}

function wrapFullHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fafafa; }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>${content}</body>
</html>`;
}

function resolveRoute(container: Container, route: string): string | null {
  const clean = route === "/" ? "/" : route.replace(/\/$/, "");
  if (clean === "/") {
    try { container.readFile("/src/pages/index.astro"); return "/src/pages/index.astro"; } catch { /* */ }
  }
  try { container.readFile(`/src/pages${clean}.astro`); return `/src/pages${clean}.astro`; } catch { /* */ }
  try { container.readFile(`/src/pages${clean}/index.astro`); return `/src/pages${clean}/index.astro`; } catch { /* */ }
  return null;
}

function assembleAstroPage(container: Container, route: string): string {
  const pagePath = resolveRoute(container, route);
  if (!pagePath) {
    return wrapFullHtml("404",
      '<div style="max-width:600px;margin:4rem auto;text-align:center;padding:2rem;">' +
      '<h1 style="font-size:4rem;font-weight:800;color:#6366f1;margin-bottom:1rem;">404</h1>' +
      '<p style="color:#666;font-size:1.1rem;">Page not found</p>' +
      '<a href="/" style="display:inline-block;margin-top:1.5rem;padding:0.5rem 1.5rem;background:#6366f1;color:white;border-radius:0.5rem;text-decoration:none;">Go Home</a></div>');
  }

  let raw: string;
  try { raw = container.readFile(pagePath); }
  catch { return wrapFullHtml("Error", "<p>Error reading file</p>"); }

  const { frontmatter, body } = parseFrontmatter(raw);
  let pageContent = body;

  const layoutRef = frontmatter.layout as string | undefined;
  if (layoutRef) {
    const layoutPath = layoutRef.startsWith(".")
      ? resolveRelativePath(pagePath, layoutRef)
      : `/src/layouts/${layoutRef}`;
    pageContent = applyLayout(container, layoutPath, pageContent, frontmatter);
  } else {
    pageContent = wrapFullHtml((frontmatter.pageTitle as string) || "Astro", pageContent);
  }

  pageContent = processIslands(container, pageContent);

  const navScript = `<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  if (href && href.startsWith('/') && !href.startsWith('//')) {
    e.preventDefault();
    window.parent.postMessage({ type: 'route-change', path: href }, '*');
  }
});
<\/script>`;

  pageContent = pageContent.replace("</body>", navScript + "\n</body>");
  return pageContent;
}

// ---------------------------------------------------------------------------
// AI context — gather all editable files for the prompt
// ---------------------------------------------------------------------------

function gatherCurrentCode(container: Container): string {
  const paths = [
    "/src/pages/index.astro",
    "/src/pages/about.astro",
    "/src/layouts/BaseLayout.astro",
    "/src/components/Navbar.astro",
    "/src/components/Footer.astro",
    "/src/components/Counter.tsx",
  ];

  // Also discover any extra pages/components
  try {
    for (const name of container.vfs.readdirSync("/src/pages")) {
      const p = `/src/pages/${name}`;
      if (name.endsWith(".astro") && !paths.includes(p)) paths.push(p);
    }
  } catch { /* */ }
  try {
    for (const name of container.vfs.readdirSync("/src/components")) {
      const p = `/src/components/${name}`;
      if (!paths.includes(p)) paths.push(p);
    }
  } catch { /* */ }

  return paths.map((p) => {
    try {
      const ext = p.endsWith('.tsx') || p.endsWith('.jsx') ? 'tsx' : 'astro';
      return `\`\`\`${ext} filename="${p}"\n${container.readFile(p)}\n\`\`\``;
    } catch { return ''; }
  }).filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let msgId = 0;
function nextId(): string { return `msg_${Date.now()}_${++msgId}`; }

export function useAIChatContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const [isBooted, setIsBooted] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(true);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const refreshFiles = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const buildTree = (dirPath: string): FileEntry[] => {
      try {
        return c.vfs.readdirSync(dirPath)
          .filter((n) => !n.startsWith("."))
          .sort((a, b) => {
            const fA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fA).isDirectory();
            const bDir = c.vfs.statSync(fB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fp = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = c.vfs.statSync(fp).isDirectory();
            return { name, path: fp, isDir, children: isDir ? buildTree(fp) : undefined };
          });
      } catch { return []; }
    };
    setFiles(buildTree("/"));
  }, []);

  const rebuildPreview = useCallback((route: string) => {
    const c = containerRef.current;
    if (!c) return;
    setHtmlSrc(assembleAstroPage(c, route));
  }, []);

  // --- Check API key ---
  useEffect(() => { if (getApiKey()) setNeedsApiKey(false); }, []);

  // --- Boot ---
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      onConsole: (_method: string, args: unknown[]) => {
        console.log("[container]", args.map((a: unknown) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      c.writeFile(path, content);
    }

    (async () => {
      try {
        const lastCode = await getLastAssistantCode();
        if (lastCode) {
          const extracted = extractNamedFiles(lastCode);
          for (const [fp, code] of Object.entries(extracted)) c.writeFile(fp, code);
        }
      } catch { /* */ }

      try {
        const recent = await loadRecentMessages(50);
        if (recent.length > 0) {
          setMessages(recent.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp })));
          setHasMore(recent.length >= 50);
        }
      } catch { /* */ }

      setIsBooted(true);
      refreshFiles();
      setSelectedFile("/src/pages/index.astro");
      setFileContent(c.readFile("/src/pages/index.astro"));
      setHtmlSrc(assembleAstroPage(c, "/"));
    })();
  }, [refreshFiles]);

  // --- Listen for route changes from iframe ---
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "route-change" && typeof e.data.path === "string") {
        const newPath = e.data.path;
        setCurrentPath(newPath);
        rebuildPreview(newPath);
        setHistory((prev) => [...prev.slice(0, historyIdx + 1), newPath]);
        setHistoryIdx((prev) => prev + 1);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [historyIdx, rebuildPreview]);

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    rebuildPreview(path);
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), path]);
    setHistoryIdx((prev) => prev + 1);
  }, [historyIdx, rebuildPreview]);

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const i = historyIdx - 1;
    setHistoryIdx(i); setCurrentPath(history[i]); rebuildPreview(history[i]);
  }, [history, historyIdx, rebuildPreview]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const i = historyIdx + 1;
    setHistoryIdx(i); setCurrentPath(history[i]); rebuildPreview(history[i]);
  }, [history, historyIdx, rebuildPreview]);

  // --- Send message ---
  const sendMessage = useCallback(async (content: string) => {
    const apiKey = getApiKey();
    if (!apiKey || isStreaming) return;
    const c = containerRef.current;
    if (!c) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content, timestamp: Date.now() };
    const assistantMsg: ChatMessage = { id: nextId(), role: "assistant", content: "", timestamp: Date.now(), isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    saveMessage({ id: userMsg.id, role: userMsg.role, content: userMsg.content, timestamp: userMsg.timestamp }).catch(() => {});

    const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const abort = new AbortController();
    abortRef.current = abort;
    let fullText = "";

    await streamChatCompletion(apiKey, apiMessages, {
      onToken: (text) => {
        fullText += text;
        const cur = fullText;
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last && last.id === assistantMsg.id) u[u.length - 1] = { ...last, content: cur };
          return u;
        });
      },
      onComplete: async (finalText) => {
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last && last.id === assistantMsg.id) u[u.length - 1] = { ...last, content: finalText, isStreaming: false };
          return u;
        });
        setIsStreaming(false);
        abortRef.current = null;
        saveMessage({ id: assistantMsg.id, role: "assistant", content: finalText, timestamp: Date.now() }).catch(() => {});

        const extracted = extractNamedFiles(finalText);
        const keys = Object.keys(extracted);
        if (keys.length > 0 && c) {
          for (const [fp, code] of Object.entries(extracted)) c.writeFile(fp, code);
          refreshFiles();
          setSelectedFile(keys[keys.length - 1]);
          setFileContent(extracted[keys[keys.length - 1]]);
          rebuildPreview(currentPath);
        }
      },
      onError: (error) => {
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last && last.id === assistantMsg.id) u[u.length - 1] = { ...last, content: `Error: ${error.message}`, isStreaming: false };
          return u;
        });
        setIsStreaming(false);
        abortRef.current = null;
      },
    }, abort.signal, gatherCurrentCode(c));
  }, [isStreaming, messages, currentPath, refreshFiles, rebuildPreview]);

  const loadMoreMessages = useCallback(async () => {
    if (messages.length === 0) return;
    try {
      const older = await loadMessagesBefore(messages[0].timestamp, 50);
      if (older.length > 0) {
        setMessages((prev) => [...older.map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp })), ...prev]);
      }
      setHasMore(older.length >= 50);
    } catch { setHasMore(false); }
  }, [messages]);

  const refresh = useCallback(() => { rebuildPreview(currentPath); }, [currentPath, rebuildPreview]);
  const resetApiKey = useCallback(() => { clearApiKey(); setNeedsApiKey(true); }, []);
  const handleApiKeySubmit = useCallback((_key: string) => { setNeedsApiKey(false); }, []);

  const selectFile = useCallback((path: string) => {
    const c = containerRef.current;
    if (!c) return;
    try { setSelectedFile(path); setFileContent(c.readFile(path)); } catch { /* */ }
  }, []);

  const saveFile = useCallback((path: string, content: string) => {
    const c = containerRef.current;
    if (!c) return;
    c.writeFile(path, content);
    setFileContent(content);
    refreshFiles();
    rebuildPreview(currentPath);
  }, [refreshFiles, rebuildPreview, currentPath]);

  const filePaths = useMemo(() => {
    const paths: string[] = [];
    const collect = (entries: FileEntry[]) => {
      for (const e of entries) {
        if (e.isDir) { if (e.children) collect(e.children); }
        else paths.push(e.path);
      }
    };
    collect(files);
    return paths;
  }, [files]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    await clearAllMessages().catch(() => {});
    const c = containerRef.current;
    if (c) {
      for (const [p, content] of Object.entries(VIRTUAL_FILES)) c.writeFile(p, content);
      refreshFiles();
      rebuildPreview(currentPath);
    }
  }, [currentPath, refreshFiles, rebuildPreview]);

  return {
    messages, isBooted, isStreaming, htmlSrc, hasMore, needsApiKey,
    files, selectedFile, fileContent, filePaths,
    currentPath, canGoBack: historyIdx > 0, canGoForward: historyIdx < history.length - 1,
    sendMessage, loadMoreMessages, navigateTo, goBack, goForward,
    refresh, resetApiKey, handleApiKeySubmit, clearChat, selectFile, saveFile,
  };
}
