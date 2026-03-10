import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


// ---------------------------------------------------------------------------
// Virtual project files — a Nuxt 3-style Vue app
//
// Nuxt conventions demonstrated:
//   - /pages/         → file-based routing (index, about, blog/index, blog/[id])
//   - /layouts/       → layout system (default layout wraps all pages)
//   - /composables/   → auto-imported composables (useCounter, usePosts)
//   - /server/api/    → server routes (simulated with in-memory data)
//   - /middleware/     → route middleware (auth guard demo)
//   - /plugins/       → app plugins (toast notification system)
//   - nuxt.config.ts  → config file
//   - app.vue         → root component
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": `{
  "name": "nuxt-app",
  "private": true,
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview"
  },
  "dependencies": {
    "nuxt": "^3.14.0",
    "vue": "^3.5.0"
  }
}`,

  "/nuxt.config.ts": `export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [],
  app: {
    head: {
      title: 'Nuxt App',
      meta: [
        { name: 'description', content: 'A Nuxt 3 app running inside jiki' }
      ]
    }
  }
});`,

  "/app.vue": `<script setup>
const route = useRoute();
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>`,

  "/layouts/default.js": `const DefaultLayout = {
  props: ['currentPath'],
  emits: ['navigate'],
  template: \`
    <div class="min-h-screen flex flex-col bg-white text-black">
      <nav class="border-b border-black/10 sticky top-0 z-50 bg-white">
        <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
          <a href="/" @click.prevent="$emit('navigate', '/')" class="text-sm font-bold tracking-tight" style="text-decoration:none;color:black;">
            <span class="text-green-500">n</span>uxt.
          </a>
          <div class="flex items-center gap-5">
            <a v-for="link in links" :key="link.path" :href="link.path"
               @click.prevent="$emit('navigate', link.path)"
               :class="[
                 'text-sm transition-colors',
                 currentPath === link.path
                   ? 'text-black font-bold'
                   : 'text-black/40 hover:text-black'
               ]" style="text-decoration:none;">{{ link.label }}</a>
          </div>
        </div>
      </nav>
      <main class="flex-1"><slot /></main>
      <footer class="border-t border-black/10 mt-auto">
        <div class="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <span class="text-xs font-bold tracking-tight"><span class="text-green-500">n</span>uxt.</span>
          <span class="text-xs text-black/30">Nuxt 3 &middot; Vue 3 &middot; jiki</span>
        </div>
      </footer>
    </div>
  \`,
  data() {
    return {
      links: [
        { path: '/', label: 'Home' },
        { path: '/about', label: 'About' },
        { path: '/blog', label: 'Blog' },
        { path: '/dashboard', label: 'Dashboard' },
      ]
    };
  }
};`,

  // ---- Composables ----

  "/composables/useCounter.js": `const useCounter = () => {
  const count = Vue.ref(0);
  const increment = () => count.value++;
  const decrement = () => count.value--;
  const reset = () => count.value = 0;
  return { count, increment, decrement, reset };
};`,

  "/composables/usePosts.js": `const usePosts = () => {
  const posts = Vue.ref([
    { id: 1, title: 'Getting Started with Nuxt 3', excerpt: 'Learn how to build modern web apps with Nuxt 3 and the Composition API.', date: '2025-12-01', author: 'Vue Team', tags: ['nuxt', 'vue'] },
    { id: 2, title: 'File-Based Routing', excerpt: 'Discover how Nuxt automatically generates routes from your pages directory.', date: '2025-11-15', author: 'Nuxt Core', tags: ['routing', 'pages'] },
    { id: 3, title: 'Server Routes & API', excerpt: 'Build full-stack apps with server routes in the /server directory.', date: '2025-11-01', author: 'Full Stack', tags: ['api', 'server'] },
    { id: 4, title: 'Composables & State', excerpt: 'Auto-imported composables make state management simple and powerful.', date: '2025-10-20', author: 'Vue Team', tags: ['composables', 'state'] },
    { id: 5, title: 'Layouts & Middleware', excerpt: 'Wrap pages with layouts and protect routes with middleware.', date: '2025-10-05', author: 'Nuxt Core', tags: ['layouts', 'middleware'] },
  ]);
  const getPost = (id) => posts.value.find(p => p.id === Number(id));
  return { posts, getPost };
};`,

  // ---- Middleware ----

  "/middleware/auth.js": `const authMiddleware = (to) => {
  const isAuthenticated = false;
  if (to.startsWith('/dashboard') && !isAuthenticated) {
    return { redirect: '/', message: 'Please log in to access the dashboard.' };
  }
  return null;
};`,

  // ---- Server API ----

  "/server/api/posts.js": `const apiPosts = {
  data: [
    { id: 1, title: 'Getting Started with Nuxt 3', views: 1240 },
    { id: 2, title: 'File-Based Routing', views: 890 },
    { id: 3, title: 'Server Routes & API', views: 2100 },
    { id: 4, title: 'Composables & State', views: 760 },
    { id: 5, title: 'Layouts & Middleware', views: 450 },
  ],
  handler() {
    return { status: 200, body: this.data };
  }
};`,

  "/server/api/stats.js": `const apiStats = {
  handler() {
    return {
      status: 200,
      body: {
        totalPages: 5,
        totalPosts: 5,
        composables: 2,
        middleware: 1,
        serverRoutes: 2,
      }
    };
  }
};`,

  // ---- Plugins ----

  "/plugins/toast.js": `const toastPlugin = {
  install(app) {
    const toasts = Vue.ref([]);
    let nextId = 0;
    app.config.globalProperties.$toast = {
      show(message, type) {
        type = type || 'info';
        const id = nextId++;
        toasts.value.push({ id, message, type });
        setTimeout(() => {
          toasts.value = toasts.value.filter(t => t.id !== id);
        }, 3000);
      }
    };
    app.provide('toasts', toasts);
  }
};`,

  // ---- Pages ----

  "/pages/index.js": `const PageIndex = {
  template: \`
    <div>
      <section class="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Nuxt 3</p>
        <h1 class="text-5xl font-black leading-tight tracking-tight mb-4">
          Full-stack Vue.<br/><span class="text-green-500">Convention-driven.</span>
        </h1>
        <p class="text-base text-black/50 leading-relaxed max-w-md mb-10">
          File-based routing, layouts, composables, middleware, and server API routes — all running in a virtual container.
        </p>
        <div class="flex gap-3">
          <button @click="$emit('navigate', '/blog')" class="px-4 py-2 bg-black text-white text-sm font-bold cursor-pointer border-none">Explore blog</button>
          <button @click="$emit('navigate', '/about')" class="px-4 py-2 border-2 border-black text-sm font-bold cursor-pointer bg-white">About</button>
        </div>
      </section>

      <section class="border-t border-black/10">
        <div class="max-w-2xl mx-auto px-6 py-10">
          <div class="grid grid-cols-3 gap-8">
            <div v-for="(f, i) in features" :key="i">
              <h3 class="text-sm font-bold mb-1">{{ f.title }}</h3>
              <p class="text-xs text-black/40 leading-relaxed">{{ f.desc }}</p>
              <span class="text-[10px] font-mono text-green-500 mt-1 inline-block">{{ f.dir }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  \`,
  emits: ['navigate'],
  data() {
    return {
      features: [
        { title: 'Routing', desc: 'Pages in /pages/ auto-generate routes.', dir: '/pages/' },
        { title: 'Layouts', desc: 'Shared wrappers via /layouts/.', dir: '/layouts/' },
        { title: 'Composables', desc: 'Auto-imported reactive utilities.', dir: '/composables/' },
        { title: 'Middleware', desc: 'Route guards before navigation.', dir: '/middleware/' },
        { title: 'Server API', desc: 'Endpoints in /server/api/.', dir: '/server/api/' },
        { title: 'Plugins', desc: 'App-wide globals and services.', dir: '/plugins/' },
      ]
    };
  }
};`,

  "/pages/about.js": `const PageAbout = {
  template: \`
    <div class="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">About</p>
      <h1 class="text-4xl font-black leading-tight tracking-tight mb-4">Nuxt conventions.</h1>
      <p class="text-base text-black/50 leading-relaxed max-w-md mb-12">
        Nuxt 3 running inside a jiki virtual container. Everything stored in an in-memory filesystem.
      </p>

      <div class="space-y-6">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-widest mb-4">How it works</h2>
          <ol class="space-y-3">
            <li v-for="(step, i) in steps" :key="i" class="flex gap-3">
              <span class="text-xs font-black text-green-500 mt-0.5">{{ String(i + 1).padStart(2, '0') }}</span>
              <div>
                <span class="text-sm font-bold">{{ step.title }}.</span>
                <span class="text-sm text-black/40"> {{ step.desc }}</span>
              </div>
            </li>
          </ol>
        </div>

        <div class="border-t border-black/10 pt-6">
          <h2 class="text-sm font-bold uppercase tracking-widest mb-4">Counter composable</h2>
          <p class="text-xs text-black/40 mb-4">From /composables/useCounter.js</p>
          <div class="flex items-center gap-4">
            <button @click="decrement" class="w-9 h-9 border-2 border-black text-lg font-bold flex items-center justify-center bg-white cursor-pointer">&minus;</button>
            <span class="text-4xl font-black tabular-nums min-w-[60px] text-center">{{ count }}</span>
            <button @click="increment" class="w-9 h-9 border-2 border-black bg-black text-white text-lg font-bold flex items-center justify-center cursor-pointer">+</button>
            <button @click="reset" class="text-xs font-bold uppercase tracking-widest text-black/30 hover:text-black cursor-pointer bg-transparent border-none ml-2">Reset</button>
          </div>
        </div>
      </div>
    </div>
  \`,
  data() {
    return {
      count: 0,
      steps: [
        { title: '/pages/ define routes', desc: 'File-based routing auto-generates from directory structure' },
        { title: '/layouts/ wrap pages', desc: 'Default layout applies to every page automatically' },
        { title: '/composables/ are auto-imported', desc: 'Reactive utility functions available everywhere' },
        { title: '/middleware/ guards routes', desc: 'Runs before navigation to protect pages' },
        { title: '/server/api/ provides data', desc: 'Server endpoints return JSON responses' },
      ]
    };
  },
  methods: {
    increment() { this.count++; },
    decrement() { this.count--; },
    reset() { this.count = 0; },
  }
};`,

  "/pages/blog/index.js": `const PageBlogIndex = {
  emits: ['navigate'],
  template: \`
    <div class="max-w-2xl mx-auto px-6 pt-16 pb-20">
      <p class="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Blog</p>
      <h1 class="text-4xl font-black tracking-tight mb-2">Posts.</h1>
      <p class="text-sm text-black/40 mb-8">From <code class="text-xs font-mono bg-black/5 px-1.5 py-0.5">/composables/usePosts.js</code></p>

      <div class="space-y-0">
        <article v-for="post in posts" :key="post.id"
                 @click="$emit('navigate', '/blog/' + post.id)"
                 class="flex items-baseline justify-between border-b border-black/5 py-4 cursor-pointer group">
          <div>
            <h2 class="text-sm font-bold group-hover:text-green-500 transition-colors">{{ post.title }}</h2>
            <p class="text-xs text-black/40 mt-0.5">{{ post.excerpt }}</p>
          </div>
          <span class="text-[10px] text-black/20 font-mono flex-shrink-0 ml-4">{{ post.date }}</span>
        </article>
      </div>
    </div>
  \`,
  data() {
    const { posts } = usePosts();
    return { posts: posts.value };
  }
};`,

  "/pages/blog/[id].js": `const PageBlogDetail = {
  props: ['routeParam'],
  emits: ['navigate'],
  template: \`
    <div class="max-w-3xl mx-auto px-6 py-16">
      <div class="inline-block text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-200 mb-4">
        /pages/blog/[id].js &mdash; id={{ routeParam }}
      </div>

      <button @click="$emit('navigate', '/blog')"
              class="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Blog
      </button>

      <div v-if="post">
        <div class="flex items-center gap-2 mb-3">
          <span v-for="tag in post.tags" :key="tag"
                class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
            {{ tag }}
          </span>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 mb-3">{{ post.title }}</h1>
        <div class="flex items-center gap-3 text-sm text-gray-400 mb-8">
          <span>{{ post.author }}</span>
          <span>&middot;</span>
          <span>{{ post.date }}</span>
        </div>
        <div class="prose prose-gray max-w-none">
          <p class="text-gray-600 leading-relaxed mb-4">{{ post.excerpt }}</p>
          <div class="bg-gray-50 rounded-lg border border-gray-200 p-6 my-6">
            <h3 class="font-semibold text-gray-900 mb-2">Dynamic Route Parameters</h3>
            <p class="text-sm text-gray-600 mb-3">
              This page demonstrates Nuxt's dynamic routing with <code class="px-1 py-0.5 bg-white rounded text-xs border">[id]</code> parameter syntax.
              The route parameter is extracted and used to look up the post via the <code class="px-1 py-0.5 bg-white rounded text-xs border">usePosts</code> composable.
            </p>
            <div class="font-mono text-xs bg-white rounded p-3 border border-gray-200">
              <div class="text-gray-400">// Route: /blog/<span class="text-green-600">{{ routeParam }}</span></div>
              <div class="text-gray-700">const post = getPost(<span class="text-green-600">{{ routeParam }}</span>);</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-16">
        <div class="text-4xl mb-4">\\u{1F50D}</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Post Not Found</h2>
        <p class="text-gray-500 mb-4">No blog post with id "{{ routeParam }}" exists.</p>
        <button @click="$emit('navigate', '/blog')"
                class="text-sm text-green-600 hover:text-green-700 font-medium">
          View all posts
        </button>
      </div>
    </div>
  \`,
  data() {
    const { getPost } = usePosts();
    return { post: getPost(this.routeParam) };
  }
};`,

  "/pages/dashboard.js": `const PageDashboard = {
  template: \`
    <div class="max-w-5xl mx-auto px-6 py-16">
      <div class="inline-block text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-200 mb-4">
        /pages/dashboard.js
      </div>

      <div v-if="blocked" class="text-center py-16">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
          <span class="text-3xl">\\u{1F512}</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
        <p class="text-gray-500 mb-2">{{ blockedMessage }}</p>
        <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 max-w-md mx-auto text-left">
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Middleware Demo</h3>
          <p class="text-xs text-gray-500 leading-relaxed">
            This page is protected by <code class="px-1 py-0.5 bg-white rounded border">/middleware/auth.js</code>.
            The middleware checks authentication before allowing navigation.
            Since <code class="px-1 py-0.5 bg-white rounded border">isAuthenticated</code> is <code class="px-1 py-0.5 bg-white rounded border">false</code>,
            the route is blocked.
          </p>
        </div>
      </div>

      <div v-else>
        <h1 class="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="(s, i) in stats" :key="i" class="p-4 bg-white rounded-xl border border-gray-200">
            <div class="text-2xl font-bold text-green-600">{{ s.value }}</div>
            <div class="text-sm text-gray-500">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>
  \`,
  data() {
    const result = authMiddleware('/dashboard');
    return {
      blocked: !!result,
      blockedMessage: result ? result.message : '',
      stats: [
        { label: 'Pages', value: 5 },
        { label: 'Posts', value: 5 },
        { label: 'Composables', value: 2 },
        { label: 'API Routes', value: 2 },
      ]
    };
  }
};`,
};

// ---------------------------------------------------------------------------
// Route resolution (Nuxt file-based routing)
// ---------------------------------------------------------------------------

interface RouteMatch {
  component: string;
  param?: string;
}

function resolveRoute(path: string): RouteMatch {
  if (path === "/" || path === "") return { component: "PageIndex" };
  if (path === "/about") return { component: "PageAbout" };
  if (path === "/blog") return { component: "PageBlogIndex" };
  if (path === "/dashboard") return { component: "PageDashboard" };

  const blogMatch = path.match(/^\/blog\/(.+)$/);
  if (blogMatch) return { component: "PageBlogDetail", param: blogMatch[1] };

  return { component: "PageIndex" };
}

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

  const scriptOrder = [
    "/composables/useCounter.js",
    "/composables/usePosts.js",
    "/middleware/auth.js",
    "/server/api/posts.js",
    "/server/api/stats.js",
    "/plugins/toast.js",
    "/layouts/default.js",
    "/pages/index.js",
    "/pages/about.js",
    "/pages/blog/index.js",
    "/pages/blog/[id].js",
    "/pages/dashboard.js",
  ];

  const scripts: string[] = [];
  for (const p of scriptOrder) {
    try {
      const code = container.readFile(p);
      scripts.push(`<script>\n${code}\n<\/script>`);
    } catch {
      /* skip missing files */
    }
  }

  const resolved = resolveRoute(route);

  const bootstrap = `<script>
  window.__INITIAL_PATH = "${route}";
  window.__ROUTE_PARAM = "${resolved.param || ""}";

  const App = {
    template: \`
      <DefaultLayout :current-path="path" @navigate="navigate">
        <component :is="currentPage" :route-param="routeParam" @navigate="navigate" />
      </DefaultLayout>
    \`,
    data() {
      return {
        path: window.__INITIAL_PATH || '/',
        routeParam: window.__ROUTE_PARAM || ''
      };
    },
    computed: {
      currentPage() {
        if (this.path === '/about') return 'PageAbout';
        if (this.path === '/blog') return 'PageBlogIndex';
        if (this.path === '/dashboard') return 'PageDashboard';
        if (this.path.startsWith('/blog/')) return 'PageBlogDetail';
        return 'PageIndex';
      }
    },
    methods: {
      navigate(to) {
        this.path = to;
        const match = to.match(/^\\/blog\\/(.+)$/);
        this.routeParam = match ? match[1] : '';
        window.parent.postMessage({ type: 'route-change', path: to }, '*');
      }
    },
    mounted() {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'navigate') {
          this.path = e.data.path;
          const match = e.data.path.match(/^\\/blog\\/(.+)$/);
          this.routeParam = match ? match[1] : '';
        }
      });
    }
  };

  const app = Vue.createApp(App);
  app.component('DefaultLayout', DefaultLayout);
  app.component('PageIndex', PageIndex);
  app.component('PageAbout', PageAbout);
  app.component('PageBlogIndex', PageBlogIndex);
  app.component('PageBlogDetail', PageBlogDetail);
  app.component('PageDashboard', PageDashboard);
  toastPlugin.install(app);
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

export function useNuxtContainer() {
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
            const fp = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = c.vfs.statSync(fp).isDirectory();
            return { name, path: fp, isDir, children: isDir ? buildTree(fp) : undefined };
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

  // -- index.html template --

  const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuxt App</title>
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
</html>`;

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

    c.writeFile("/index.html", INDEX_HTML);
    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted. Nuxt 3 project loaded.");
    pushLine("info", "Conventions: /pages/, /layouts/, /composables/, /middleware/, /server/api/");
    pushLine("info", "Try: ls pages, cat composables/useCounter.js");
    refreshFiles();
    setSelectedFile("/pages/index.js");
    setFileContent(VIRTUAL_FILES["/pages/index.js"]);
    setHtmlSrc(assembleHtml(c, "/"));
  }, [pushLine, refreshFiles, INDEX_HTML]);

  // -- listen for route changes from iframe --

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "route-change" && typeof e.data.path === "string") {
        const newPath = e.data.path;
        setCurrentPath(newPath);
        setHistory((prev) => [...prev.slice(0, historyIdx + 1), newPath]);
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
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), path]);
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx, rebuildPreview],
  );

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const p = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(p);
    rebuildPreview(p);
  }, [history, historyIdx, rebuildPreview]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const p = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(p);
    rebuildPreview(p);
  }, [history, historyIdx, rebuildPreview]);

  const refresh = useCallback(() => {
    rebuildPreview(currentPath);
  }, [currentPath, rebuildPreview]);

  const selectFile = useCallback(
    (path: string) => {
      const c = containerRef.current;
      if (!c) return;
      try {
        setSelectedFile(path);
        setFileContent(c.readFile(path));
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
      rebuildPreview(currentPath);
    },
    [refreshFiles, pushLine, rebuildPreview, currentPath],
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
        if (result.exitCode !== 0) pushLine("info", `Exit code ${result.exitCode}`);
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
