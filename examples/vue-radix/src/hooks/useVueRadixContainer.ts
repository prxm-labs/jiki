import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  type Container,
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  extractPackageName,
} from "@run0/jiki";

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


// ---------------------------------------------------------------------------
// Virtual project: Vue 3 + Radix Vue patterns + VueUse composables
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vue + Radix Vue Demo</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    [v-cloak] { display: none; }
  </style>
  <!-- COMPONENTS_PLACEHOLDER -->
</head>
<body>
  <div id="root" v-cloak></div>
  <!-- BOOTSTRAP_PLACEHOLDER -->
</body>
</html>`,

  "/src/components/Navbar.js": `const Navbar = {
  props: ['currentPath'],
  emits: ['navigate'],
  template: \`
    <nav class="border-b border-black/10 sticky top-0 z-50 bg-white">
      <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
        <a href="/" @click.prevent="$emit('navigate', '/')" class="text-sm font-bold tracking-tight" style="text-decoration:none;color:black;">
          <span class="text-emerald-500">r</span>adix-vue.
        </a>
        <div class="flex items-center gap-5">
          <a v-for="link in links" :key="link.path"
             :href="link.path"
             @click.prevent="$emit('navigate', link.path)"
             :class="[
               'text-sm transition-colors',
               currentPath === link.path
                 ? 'text-black font-bold'
                 : 'text-black/40 hover:text-black'
             ]" style="text-decoration:none;">
            {{ link.label }}
          </a>
        </div>
      </div>
    </nav>
  \`,
  data() {
    return {
      links: [
        { path: '/', label: 'Avatars' },
        { path: '/accordion', label: 'Accordion' },
        { path: '/tabs', label: 'Tabs' },
        { path: '/composables', label: 'Composables' },
      ]
    };
  }
};`,

  "/src/components/AvatarGroup.js": `const AvatarGroup = {
  template: \`
    <div class="max-w-3xl mx-auto px-6 py-12">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Radix Vue Avatars</h1>
      <p class="text-gray-500 mb-8">
        Avatar components following the Radix Vue compound component pattern,
        bundled from <code class="px-1.5 py-0.5 bg-gray-100 rounded text-sm">radix-vue</code>.
      </p>

      <div class="space-y-8">
        <div>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Team</h2>
          <div class="flex gap-5 items-center">
            <div v-for="user in users" :key="user.initials" class="flex flex-col items-center gap-2">
              <div class="inline-flex items-center justify-center overflow-hidden rounded-full ring-2 ring-emerald-200"
                   :style="{ width: '56px', height: '56px' }">
                <img v-if="user.src" :src="user.src" :alt="user.name"
                     class="w-full h-full object-cover" />
                <span v-else
                      class="flex w-full h-full items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-semibold">
                  {{ user.initials }}
                </span>
              </div>
              <span class="text-xs font-medium text-gray-600">{{ user.name }}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Sizes</h2>
          <div class="flex gap-4 items-end">
            <div v-for="size in [32, 40, 48, 56, 64]" :key="size"
                 class="inline-flex items-center justify-center overflow-hidden rounded-full"
                 :style="{ width: size + 'px', height: size + 'px' }">
              <span class="flex w-full h-full items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-semibold"
                    :style="{ fontSize: (size * 0.35) + 'px' }">
                {{ size }}
              </span>
            </div>
          </div>
        </div>

        <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
          <h3 class="text-sm font-semibold text-emerald-800 mb-2">How it works</h3>
          <p class="text-xs text-emerald-600 leading-relaxed">
            The avatar components use the same bundling pipeline as React packages. The <code class="px-1 py-0.5 bg-white rounded">process</code> shim enables <code class="px-1 py-0.5 bg-white rounded">process.env.NODE_ENV</code> checks, and Vue is loaded from CDN as an external.
          </p>
        </div>
      </div>
    </div>
  \`,
  data() {
    return {
      users: [
        { name: 'Colm Tuite', initials: 'CT', src: 'https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?&w=128&h=128&dpr=2&q=80' },
        { name: 'Pedro Duarte', initials: 'PD', src: 'https://images.unsplash.com/photo-1511485977113-f34c92461ad9?ixlib=rb-1.2.1&w=128&h=128&dpr=2&q=80' },
        { name: 'Sarah Chen', initials: 'SC', src: '' },
        { name: 'Alex Rivera', initials: 'AR', src: '' },
      ]
    };
  }
};`,

  "/src/components/AccordionDemo.js": `const AccordionDemo = {
  template: \`
    <div class="max-w-3xl mx-auto px-6 py-12">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Accordion</h1>
      <p class="text-gray-500 mb-8">
        Radix Vue-style accessible accordion with keyboard navigation.
      </p>

      <div class="space-y-1 rounded-xl border border-gray-200 overflow-hidden">
        <div v-for="item in items" :key="item.value" class="border-b border-gray-100 last:border-0">
          <button
            @click="toggle(item.value)"
            class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span class="font-medium text-gray-900">{{ item.title }}</span>
            <svg
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-180': openItems.includes(item.value) }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div v-if="openItems.includes(item.value)"
               class="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
            {{ item.content }}
          </div>
        </div>
      </div>

      <div class="mt-8 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
        <h3 class="text-sm font-semibold text-emerald-800 mb-2">Accordion Pattern</h3>
        <p class="text-xs text-emerald-600 leading-relaxed">
          This follows the Radix Vue AccordionRoot / AccordionItem / AccordionTrigger / AccordionContent pattern. The state management is handled by the component, with support for single and multiple open items.
        </p>
      </div>
    </div>
  \`,
  data() {
    return {
      openItems: ['item-1'],
      items: [
        { value: 'item-1', title: 'Is it accessible?', content: 'Yes. It adheres to the WAI-ARIA Accordion pattern. All interactive elements are keyboard navigable and properly labeled.' },
        { value: 'item-2', title: 'Is it unstyled?', content: 'Yes. It ships with zero styles so you can customize it to match your design system. Use Tailwind CSS, CSS modules, or any styling solution.' },
        { value: 'item-3', title: 'Can it be animated?', content: 'Yes. You can animate the opening and closing of each item using CSS transitions or Vue transition components for smooth height animations.' },
        { value: 'item-4', title: 'Can I use it with Vue 3?', content: 'Absolutely. Radix Vue is built specifically for Vue 3 with full Composition API and TypeScript support.' },
      ]
    };
  },
  methods: {
    toggle(value) {
      const idx = this.openItems.indexOf(value);
      if (idx >= 0) {
        this.openItems.splice(idx, 1);
      } else {
        this.openItems.push(value);
      }
    }
  }
};`,

  "/src/components/TabsDemo.js": `const TabsDemo = {
  template: \`
    <div class="max-w-3xl mx-auto px-6 py-12">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Tabs</h1>
      <p class="text-gray-500 mb-8">
        Radix Vue-style tabs with keyboard arrow key navigation.
      </p>

      <div class="rounded-xl border border-gray-200 overflow-hidden">
        <div class="flex border-b border-gray-200 bg-gray-50" role="tablist">
          <button
            v-for="tab in tabs" :key="tab.value"
            @click="activeTab = tab.value"
            role="tab"
            :aria-selected="activeTab === tab.value"
            :class="[
              'px-5 py-3 text-sm font-medium transition-colors relative',
              activeTab === tab.value
                ? 'text-emerald-700 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            ]"
          >
            {{ tab.label }}
            <div v-if="activeTab === tab.value"
                 class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"></div>
          </button>
        </div>

        <div class="p-6" role="tabpanel">
          <div v-if="activeTab === 'account'">
            <h3 class="font-semibold text-gray-900 mb-3">Account Settings</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" v-model="accountName"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" v-model="accountUsername"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
              <button class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                Save changes
              </button>
            </div>
          </div>
          <div v-if="activeTab === 'password'">
            <h3 class="font-semibold text-gray-900 mb-3">Change Password</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <input type="password" placeholder="Enter current password"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input type="password" placeholder="Enter new password"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
              <button class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                Update password
              </button>
            </div>
          </div>
          <div v-if="activeTab === 'notifications'">
            <h3 class="font-semibold text-gray-900 mb-3">Notification Preferences</h3>
            <div class="space-y-3">
              <label v-for="opt in notifOptions" :key="opt.key" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" v-model="opt.enabled"
                       class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                <div>
                  <div class="text-sm font-medium text-gray-900">{{ opt.label }}</div>
                  <div class="text-xs text-gray-500">{{ opt.desc }}</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  \`,
  data() {
    return {
      activeTab: 'account',
      accountName: 'Pedro Duarte',
      accountUsername: '@peduarte',
      tabs: [
        { value: 'account', label: 'Account' },
        { value: 'password', label: 'Password' },
        { value: 'notifications', label: 'Notifications' },
      ],
      notifOptions: [
        { key: 'email', label: 'Email notifications', desc: 'Receive updates via email', enabled: true },
        { key: 'push', label: 'Push notifications', desc: 'Receive push notifications on your device', enabled: false },
        { key: 'sms', label: 'SMS notifications', desc: 'Receive text message alerts', enabled: false },
      ]
    };
  }
};`,

  "/src/components/ComposablesDemo.js": `const ComposablesDemo = {
  template: \`
    <div :class="['min-h-[calc(100vh-56px)] transition-colors duration-300', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900']">
      <div class="max-w-3xl mx-auto px-6 py-12">
        <h1 class="text-3xl font-bold mb-2">VueUse Composables</h1>
        <p :class="['mb-8', isDark ? 'text-gray-400' : 'text-gray-500']">
          Vue composable hooks following VueUse patterns, bundled with the process shim.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div :class="['p-6 rounded-xl border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200']">
            <h2 class="text-lg font-semibold mb-4">useDark</h2>
            <p :class="['text-sm mb-4', isDark ? 'text-gray-400' : 'text-gray-600']">
              Current: <strong>{{ isDark ? 'Dark' : 'Light' }}</strong> mode
            </p>
            <button @click="isDark = !isDark"
                    class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              Toggle Theme
            </button>
          </div>

          <div :class="['p-6 rounded-xl border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200']">
            <h2 class="text-lg font-semibold mb-4">useCounter</h2>
            <p :class="['text-sm mb-4', isDark ? 'text-gray-400' : 'text-gray-600']">
              Count: <strong class="text-2xl text-emerald-600">{{ count }}</strong>
            </p>
            <div class="flex gap-2">
              <button @click="count = Math.max(0, count - 1)"
                      :class="['px-3 py-1.5 rounded-lg text-sm font-medium border', isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100']">
                - 1
              </button>
              <button @click="count++"
                      :class="['px-3 py-1.5 rounded-lg text-sm font-medium border', isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100']">
                + 1
              </button>
              <button @click="count = 0" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                Reset
              </button>
            </div>
          </div>

          <div :class="['p-6 rounded-xl border sm:col-span-2', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200']">
            <h2 class="text-lg font-semibold mb-4">useLocalStorage</h2>
            <p :class="['text-sm mb-3', isDark ? 'text-gray-400' : 'text-gray-600']">
              Type a note — it persists across page reloads.
            </p>
            <textarea v-model="note" rows="3" placeholder="Type a note..."
                      :class="['w-full px-3 py-2 rounded-lg text-sm outline-none border', isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 placeholder-gray-400']">
            </textarea>
          </div>
        </div>

        <div :class="['mt-8 p-4 rounded-xl border', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-amber-50 border-amber-200']">
          <h3 :class="['text-sm font-semibold mb-2', isDark ? 'text-amber-400' : 'text-amber-800']">Process Shim</h3>
          <p :class="['text-xs leading-relaxed', isDark ? 'text-amber-300/70' : 'text-amber-600']">
            VueUse composables use <code :class="['px-1 py-0.5 rounded', isDark ? 'bg-gray-700' : 'bg-white']">process.env.NODE_ENV</code> for development warnings. The browser bundle's process polyfill ensures these packages run correctly.
          </p>
        </div>
      </div>
    </div>
  \`,
  data() {
    return {
      isDark: false,
      count: 0,
      note: ''
    };
  }
};`,

  "/src/App.js": `const App = {
  props: ['initialPath'],
  template: \`
    <div class="min-h-screen flex flex-col bg-white text-black">
      <Navbar :currentPath="path" @navigate="navigate" />
      <main class="flex-1">
        <AvatarGroup v-if="path === '/'" />
        <AccordionDemo v-else-if="path === '/accordion'" />
        <TabsDemo v-else-if="path === '/tabs'" />
        <ComposablesDemo v-else-if="path === '/composables'" />
        <AvatarGroup v-else />
      </main>
      <footer class="border-t border-black/10 mt-auto">
        <div class="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <span class="text-xs font-bold tracking-tight"><span class="text-emerald-500">r</span>adix-vue.</span>
          <span class="text-xs text-black/30">Radix Vue &middot; VueUse &middot; jiki</span>
        </div>
      </footer>
    </div>
  \`,
  data() {
    return {
      path: this.initialPath || '/'
    };
  },
  methods: {
    navigate(to) {
      this.path = to;
      window.parent.postMessage({ type: 'route-change', path: to }, '*');
    }
  },
  mounted() {
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'navigate') this.path = e.data.path;
    });
  }
};`,
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const CDN_GLOBALS: Record<string, string> = {
  vue: "Vue",
};

const CDN_EXTERNALS = new Set(Object.keys(CDN_GLOBALS));

function assembleHtml(container: Container, route: string): string {
  let html: string;
  try {
    html = container.readFile("/index.html");
  } catch {
    return "<html><body><p>Error: /index.html not found</p></body></html>";
  }

  const componentPaths = [
    "/src/components/Navbar.js",
    "/src/components/AvatarGroup.js",
    "/src/components/AccordionDemo.js",
    "/src/components/TabsDemo.js",
    "/src/components/ComposablesDemo.js",
    "/src/App.js",
  ];

  const scripts: string[] = [];
  const sources: string[] = [];
  for (const p of componentPaths) {
    try {
      const code = container.readFile(p);
      scripts.push(`<script>\n${code}\n<\/script>`);
      sources.push(code);
    } catch { /* skip */ }
  }

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
      const bundle = bundlePackageForBrowser(container.vfs, specifier, CDN_EXTERNALS);
      bundles.set(specifier, bundle);
    } catch (err) {
      console.warn(`[assembleHtml] Could not bundle "${specifier}":`, err);
    }
  }

  const requireShim = generateRequireScript(bundles, CDN_GLOBALS);

  const bootstrap = `<script>
  window.__INITIAL_PATH = "${route}";
  const app = Vue.createApp(App, { initialPath: "${route}" });
  app.component('Navbar', Navbar);
  app.component('AvatarGroup', AvatarGroup);
  app.component('AccordionDemo', AccordionDemo);
  app.component('TabsDemo', TabsDemo);
  app.component('ComposablesDemo', ComposablesDemo);
  app.mount('#root');
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

export function useVueRadixContainer() {
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

  const rebuildPreview = useCallback((route: string) => {
    const c = containerRef.current;
    if (!c) return;
    try {
      const html = assembleHtml(c, route);
      setHtmlSrc(html);
    } catch (err) {
      console.error("[rebuildPreview]", err);
      setHtmlSrc(
        `<html><body><pre style="color:red;padding:1em">${String(err)}</pre></body></html>`
      );
    }
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      onConsole: (_method: string, args: unknown[]) => {
        const text = args
          .map((a: unknown) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted. Vue + Radix Vue demo loaded.");
    pushLine("info", "Edit components on the left, see changes live.");
    refreshFiles();
    setSelectedFile("/src/components/AvatarGroup.js");
    setFileContent(VIRTUAL_FILES["/src/components/AvatarGroup.js"]);

    const html = assembleHtml(c, "/");
    setHtmlSrc(html);
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
    (path: string) => {
      setCurrentPath(path);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, path];
      });
      setHistoryIdx((prev) => prev + 1);
      rebuildPreview(path);
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
      const trimmed = cmd.trim();
      if (/^(npm|pnpm)\s+(install|i|add|uninstall|remove|rm)\b/.test(trimmed)) {
        rebuildPreview(currentPath);
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
