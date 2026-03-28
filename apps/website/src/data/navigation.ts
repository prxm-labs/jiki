export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/* ── Header navigation ──────────────────────────────────────────── */
export const headerNav: NavItem[] = [
  { label: "DOCS", href: "/docs/getting-started/introduction" },
  { label: "EXAMPLES", href: "/examples" },
  { label: "CHANGELOG", href: "/changelog" },
];

/* ── Footer navigation ──────────────────────────────────────────── */
export const footerProductLinks: NavItem[] = [
  { label: "Documentation", href: "/docs/getting-started/introduction" },
  { label: "Examples", href: "/examples" },
  { label: "Changelog", href: "/changelog" },
  { label: "Roadmap", href: "/roadmap" },
];

export const footerResourceLinks: NavItem[] = [
  { label: "GitHub", href: "https://github.com", external: true },
  { label: "npm", href: "https://www.npmjs.com/package/jiki", external: true },
];

/* ── Docs sidebar navigation ────────────────────────────────────── */
export const docsNav: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        label: "Introduction to jiki",
        href: "/docs/getting-started/introduction",
      },
      { label: "Installation", href: "/docs/getting-started/installation" },
      { label: "Quick Start", href: "/docs/getting-started/quick-start" },
      { label: "Limitations", href: "/docs/getting-started/limitations" },
      { label: "llm.txt", href: "/llm.txt", external: true },
    ],
  },

  {
    title: "Core Concepts",
    items: [
      {
        label: "Virtual Filesystem",
        href: "/docs/core-concepts/virtual-filesystem",
      },
      { label: "Kernel", href: "/docs/core-concepts/kernel" },
      { label: "Shell", href: "/docs/core-concepts/shell" },
      { label: "Package Manager", href: "/docs/core-concepts/package-manager" },
      { label: "Transpiler", href: "/docs/core-concepts/transpiler" },
      { label: "Dev Server", href: "/docs/core-concepts/dev-server" },
      { label: "Plugins", href: "/docs/core-concepts/plugins" },
      { label: "Persistence", href: "/docs/core-concepts/persistence" },
      { label: "Package Cache", href: "/docs/core-concepts/package-cache" },
      {
        label: "Worker Isolation",
        href: "/docs/core-concepts/worker-isolation",
      },
    ],
  },
  {
    title: "AI",
    items: [
      { label: "AI Overview", href: "/docs/ai/overview" },
      {
        label: "Building an AI Coding Assistant",
        href: "/docs/ai/building-ai-assistant",
      },
      { label: "Using jiki with AI Tools", href: "/docs/ai/ai-tools" },
      { label: "Provider Setup", href: "/docs/ai/provider-setup" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { label: "boot()", href: "/docs/api/boot" },
      { label: "Container", href: "/docs/api/container" },
      { label: "MemFS", href: "/docs/api/memfs" },
      { label: "Shell", href: "/docs/api/shell" },
      { label: "Transpiler", href: "/docs/api/transpiler" },
      { label: "DevServer", href: "/docs/api/dev-server" },
      { label: "ServerBridge", href: "/docs/api/server-bridge" },
      { label: "Errors", href: "/docs/api/errors" },
      { label: "Plugins", href: "/docs/api/plugins" },
      { label: "Persistence", href: "/docs/api/persistence" },
      { label: "ViteDevServer", href: "/docs/api/vite-dev-server" },
      { label: "SvelteKitDevServer", href: "/docs/api/sveltekit-dev-server" },
      { label: "RemixDevServer", href: "/docs/api/remix-dev-server" },
      { label: "Metrics", href: "/docs/api/metrics" },
      { label: "NetworkInterceptor", href: "/docs/api/network" },
      { label: "Workspaces", href: "/docs/api/workspaces" },
      { label: "TypeChecker", href: "/docs/api/type-checker" },
    ],
  },
  {
    title: "Guides",
    items: [
      { label: "React App", href: "/docs/guides/react-app" },
      { label: "Next.js App", href: "/docs/guides/nextjs-app" },
      { label: "Vue App", href: "/docs/guides/vue-app" },
      { label: "Building a Vite App", href: "/docs/guides/vite-app" },
      { label: "Testing", href: "/docs/guides/testing" },
      { label: "Writing Plugins", href: "/docs/guides/plugins" },
    ],
  },
];
