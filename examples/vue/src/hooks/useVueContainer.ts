import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


// ---------------------------------------------------------------------------
// Virtual project files -- a multi-page Vue 3 + Tailwind app
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Vue App</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"><\/script>
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

  "/src/components/Navbar.js": `const Navbar = {
  props: ['currentPath'],
  emits: ['navigate'],
  template: \`
    <nav class="border-b border-black/10 sticky top-0 z-50 bg-white">
      <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
        <a href="/" @click.prevent="$emit('navigate', '/')" class="text-sm font-bold tracking-tight no-underline text-black">
          <span class="text-emerald-500">v</span>ue.
        </a>
        <div class="flex items-center gap-5">
          <a
            v-for="link in links"
            :key="link.path"
            :href="link.path"
            @click.prevent="$emit('navigate', link.path)"
            :class="[
              'text-sm no-underline transition-colors',
              currentPath === link.path
                ? 'text-black font-bold'
                : 'text-black/40 hover:text-black'
            ]"
          >
            {{ link.label }}
          </a>
        </div>
      </div>
    </nav>
  \`,
  data() {
    return {
      links: [
        { path: '/', label: 'Home' },
        { path: '/about', label: 'About' },
        { path: '/contact', label: 'Contact' },
      ]
    };
  }
};`,

  "/src/components/Footer.js": `const Footer = {
  template: \`
    <footer class="border-t border-black/10 mt-auto">
      <div class="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
        <span class="text-xs font-bold tracking-tight"><span class="text-emerald-500">v</span>ue.</span>
        <span class="text-xs text-black/30">Vue 3 &middot; Tailwind &middot; jiki</span>
      </div>
    </footer>
  \`
};`,

  "/src/pages/Home.js": `const Home = {
  template: \`
    <div>
      <section class="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Vue 3</p>
        <h1 class="text-5xl font-black leading-tight tracking-tight mb-4">
          Reactive UI.<br/><span class="text-emerald-500">No build step.</span>
        </h1>
        <p class="text-base text-black/50 leading-relaxed max-w-md mb-10">
          A multi-page Vue application with Composition API and Tailwind CSS — running entirely in a jiki virtual filesystem.
        </p>
        <div class="flex gap-3">
          <div class="px-4 py-2 bg-black text-white text-sm font-bold">Get started</div>
          <div class="px-4 py-2 border-2 border-black text-sm font-bold">View source</div>
        </div>
      </section>

      <section class="border-t border-black/10">
        <div class="max-w-2xl mx-auto px-6 py-10">
          <div class="grid grid-cols-3 gap-8">
            <div v-for="(f, i) in features" :key="i">
              <h3 class="text-sm font-bold mb-1">{{ f.title }}</h3>
              <p class="text-xs text-black/40 leading-relaxed">{{ f.desc }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  \`,
  data() {
    return {
      features: [
        { title: 'Instant Boot', desc: 'Container starts in milliseconds. No server required.' },
        { title: 'Virtual FS', desc: 'Full POSIX-like filesystem running in memory.' },
        { title: 'Reactivity', desc: 'Vue 3 reactive state with template-driven rendering.' },
      ]
    };
  }
};`,

  "/src/pages/About.js": `const About = {
  template: \`
    <div class="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">About</p>
      <h1 class="text-4xl font-black leading-tight tracking-tight mb-4">How it works.</h1>
      <p class="text-base text-black/50 leading-relaxed max-w-md mb-12">
        A jiki container boots a virtual filesystem, registers Vue components, and renders them inside a sandboxed iframe.
      </p>

      <div class="space-y-6">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-widest mb-4">Stack</h2>
          <div class="space-y-3">
            <div v-for="(item, i) in details" :key="i" class="flex items-baseline justify-between border-b border-black/5 pb-3">
              <span class="text-sm font-bold">{{ item.value }}</span>
              <span class="text-xs text-black/30 font-mono">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <div class="pt-4">
          <h2 class="text-sm font-bold uppercase tracking-widest mb-4">Pipeline</h2>
          <ol class="space-y-3">
            <li v-for="(step, i) in steps" :key="i" class="flex gap-3">
              <span class="text-xs font-black text-emerald-500 mt-0.5">{{ String(i + 1).padStart(2, '0') }}</span>
              <div>
                <span class="text-sm font-bold">{{ step.title }}.</span>
                <span class="text-sm text-black/40"> {{ step.desc }}</span>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  \`,
  data() {
    return {
      details: [
        { label: 'Runtime', value: 'jiki v0.1.0' },
        { label: 'Framework', value: 'Vue 3' },
        { label: 'Styling', value: 'Tailwind CSS' },
        { label: 'Filesystem', value: 'In-memory MemFS' },
      ],
      steps: [
        { title: 'Boot container', desc: 'Initialize jiki with boot()' },
        { title: 'Write files', desc: 'Vue components stored in virtual FS' },
        { title: 'Register', desc: 'Components registered globally on Vue app' },
        { title: 'Assemble', desc: 'Scripts injected into HTML document' },
        { title: 'Render', desc: 'Sandboxed iframe displays the result' },
      ]
    };
  }
};`,

  "/src/pages/Contact.js": `const Contact = {
  template: \`
    <div class="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <div class="max-w-sm mx-auto">
        <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4 text-center">Contact</p>
        <h1 class="text-3xl font-black tracking-tight mb-2 text-center">Get in touch.</h1>
        <p class="text-sm text-black/40 text-center mb-8">Form running inside the virtual container.</p>

        <div v-if="submitted" class="border-2 border-black p-6 text-center">
          <p class="text-sm font-bold">Sent.</p>
          <p class="text-xs text-black/40 mt-1">Thanks for reaching out (this is a demo).</p>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-black/40 mb-1.5">Name</label>
            <input type="text" required placeholder="Your name" class="w-full px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-black/40 mb-1.5">Email</label>
            <input type="email" required placeholder="you@example.com" class="w-full px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-black/40 mb-1.5">Message</label>
            <textarea required rows="4" placeholder="How can we help?" class="w-full px-3 py-2 border-2 border-black/10 text-sm focus:border-black outline-none transition-colors resize-none"></textarea>
          </div>
          <button type="submit" class="w-full py-2.5 bg-black text-white text-sm font-bold hover:bg-black/80 transition-colors">
            Send Message
          </button>
        </form>
      </div>
    </div>
  \`,
  data() {
    return { submitted: false };
  },
  methods: {
    handleSubmit() {
      this.submitted = true;
      setTimeout(() => { this.submitted = false; }, 3000);
    }
  }
};`,

  "/src/App.js": `const App = {
  template: \`
    <div class="min-h-screen flex flex-col bg-white text-black">
      <Navbar :current-path="path" @navigate="navigate" />
      <main class="flex-1">
        <component :is="currentPage" />
      </main>
      <Footer />
    </div>
  \`,
  data() {
    return {
      path: window.__INITIAL_PATH || '/'
    };
  },
  computed: {
    currentPage() {
      switch (this.path) {
        case '/about':   return 'About';
        case '/contact': return 'Contact';
        default:         return 'Home';
      }
    }
  },
  methods: {
    navigate(to) {
      this.path = to;
      window.parent.postMessage({ type: 'route-change', path: to }, '*');
    }
  },
  mounted() {
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'navigate') {
        this.path = e.data.path;
      }
    });
  }
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
    "/src/components/Navbar.js",
    "/src/components/Footer.js",
    "/src/pages/Home.js",
    "/src/pages/About.js",
    "/src/pages/Contact.js",
    "/src/App.js",
  ];

  const scripts: string[] = [];
  for (const p of componentPaths) {
    try {
      const code = container.readFile(p);
      scripts.push(`<script>\n${code}\n<\/script>`);
    } catch {
      /* skip missing files */
    }
  }

  const bootstrap = `<script>
  window.__INITIAL_PATH = "${route}";
  const app = Vue.createApp(App);
  app.component('Navbar', Navbar);
  app.component('Footer', Footer);
  app.component('Home', Home);
  app.component('About', About);
  app.component('Contact', Contact);
  app.mount('#root');
<\/script>`;

  html = html.replace("<!-- COMPONENTS_PLACEHOLDER -->", scripts.join("\n"));
  html = html.replace("<!-- BOOTSTRAP_PLACEHOLDER -->", bootstrap);
  return html;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

export function useVueContainer() {
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

  const rebuildPreview = useCallback((route: string) => {
    const c = containerRef.current;
    if (!c) return;
    setHtmlSrc(assembleHtml(c, route));
  }, []);

  // -- boot --

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
    pushLine("info", "Container booted. Vue project loaded.");
    pushLine(
      "info",
      "Try: ls, cat /src/App.js, or edit files and hit Refresh."
    );
    refreshFiles();
    setSelectedFile("/src/App.js");
    setFileContent(VIRTUAL_FILES["/src/App.js"]);
    setHtmlSrc(assembleHtml(c, "/"));
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
