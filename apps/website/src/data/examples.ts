export interface Example {
  slug: string;
  title: string;
  description: string;
  category: ExampleCategory;
  icons?: string[];
}

export type ExampleCategory =
  | "agentic"
  | "frameworks"
  | "servers"
  | "testing"
  | "tools"
  | "runtime";

export const categoryLabels: Record<ExampleCategory, string> = {
  agentic: "Agentic Development",
  frameworks: "Frameworks",
  servers: "Servers",
  testing: "Testing",
  tools: "Tools",
  runtime: "Runtime",
};

export const examples: Example[] = [
  {
    slug: "claude-coding",
    title: "Claude Coding",
    description:
      "Generate a React apllication with Claude, streaming responses and live preview",
    category: "agentic",
    icons: ["claude", "react", "tailwind"],
  },
  {
    slug: "mistral-coding",
    title: "Mistral Coding",
    description:
      "Create a marketing website with Codestral, streaming code with live updates",
    category: "agentic",
    icons: ["mistral", "react", "tailwind"],
  },
  {
    slug: "openai-coding",
    title: "OpenAI Coding",
    description: "Use Astro with React, powered by OpenAI GPT-5.4 Mini",
    category: "agentic",
    icons: ["openai", "astro", "react", "tailwind"],
  },
  {
    slug: "react",
    title: "React",
    description:
      "Multi-page React app with JSX, Tailwind CSS, and client-side routing",
    category: "frameworks",
    icons: ["react", "tailwind"],
  },
  {
    slug: "vue",
    title: "Vue",
    description:
      "Vue 3 app with Composition API, reactive state, and Tailwind CSS",
    category: "frameworks",
    icons: ["vue"],
  },
  {
    slug: "svelte",
    title: "Svelte",
    description:
      "Svelte app with reactive declarations, scoped CSS, and animations",
    category: "frameworks",
    icons: ["svelte"],
  },
  {
    slug: "nextjs",
    title: "Next.js",
    description:
      "Next.js 14 with App Router, HMR, TypeScript, and file-based routing",
    category: "frameworks",
    icons: ["nextjs"],
  },
  {
    slug: "nuxt",
    title: "Nuxt",
    description:
      "Nuxt with auto-imports, file-based routing, and server API routes",
    category: "frameworks",
    icons: ["nuxt", "vue"],
  },
  {
    slug: "astro",
    title: "Astro",
    description:
      "Astro site with Markdown, component islands, and static generation",
    category: "frameworks",
    icons: ["astro", "react", "vue", "mdx"],
  },
  {
    slug: "vite",
    title: "Vite",
    description: "Vite + React + TypeScript with fast HMR and Tailwind CSS",
    category: "frameworks",
    icons: ["vite", "react", "typescript"],
  },
  {
    slug: "react-radix",
    title: "React + Radix",
    description:
      "React with Radix UI accessible compound components and npm bundling",
    category: "frameworks",
    icons: ["react"],
  },
  {
    slug: "vue-radix",
    title: "Vue + Radix",
    description:
      "Vue with Radix Vue headless components and VueUse composables",
    category: "frameworks",
    icons: ["vue"],
  },
  {
    slug: "express",
    title: "Express",
    description:
      "Express.js REST API with middleware chains and interactive API explorer",
    category: "servers",
    icons: ["nodejs"],
  },
  {
    slug: "hono",
    title: "Hono",
    description:
      "Hono web server with logger, CORS middleware, and request context API",
    category: "servers",
    icons: ["nodejs", "hono", "typescript"],
  },
  {
    slug: "jest",
    title: "Jest",
    description: "Jest test runner with result parsing and pass/fail tracking",
    category: "testing",
    icons: ["jest"],
  },
  {
    slug: "vitest",
    title: "Vitest",
    description:
      "Vitest with ESM-first testing, result aggregation, and formatted output",
    category: "testing",
    icons: ["vitest", "vite"],
  },
  {
    slug: "esbuild-playground",
    title: "esbuild",
    description:
      "esbuild bundler with interactive config, size analysis, and multiple formats",
    category: "tools",
    icons: ["esbuild"],
  },
  {
    slug: "prettier",
    title: "Prettier",
    description:
      "Prettier code formatting with configurable rules and before/after diffs",
    category: "tools",
    icons: ["prettier"],
  },
  {
    slug: "typescript",
    title: "TypeScript",
    description:
      "Compile and run TypeScript — interfaces, types, and module imports",
    category: "tools",
    icons: ["typescript"],
  },
  {
    slug: "node",
    title: "Node.js",
    description:
      "Node.js with built-in modules, CommonJS require, and ESM support",
    category: "runtime",
    icons: ["nodejs"],
  },
  {
    slug: "shell-scripting",
    title: "Shell Scripting",
    description:
      "Shell commands, pipes, file manipulation, and text processing",
    category: "runtime",
    icons: ["terminal"],
  },
  {
    slug: "crypto",
    title: "Crypto",
    description:
      "SHA-256 hashing, HMAC signatures, and secure random generation",
    category: "runtime",
    icons: ["nodejs"],
  },
  {
    slug: "npm-scripts",
    title: "npm Scripts",
    description:
      "Install packages and execute package.json scripts with real-time progress",
    category: "runtime",
    icons: ["npm"],
  },
  {
    slug: "pnpm-scripts",
    title: "pnpm Scripts",
    description: "Efficient package management and script execution with pnpm",
    category: "runtime",
    icons: ["pnpm"],
  },
  {
    slug: "error-overlay",
    title: "Error Overlay",
    description:
      "Catch runtime errors with formatted stack traces and full-screen overlay",
    category: "tools",
    icons: ["react"],
  },
  {
    slug: "interactive-tutorial",
    title: "Interactive Tutorial",
    description:
      "7 guided coding lessons with automated validation and progress tracking",
    category: "tools",
    icons: ["terminal"],
  },
  {
    slug: "plugin-system",
    title: "Plugin System",
    description:
      "Build plugins with virtual modules, CSS stubbing, and code transforms",
    category: "tools",
    icons: ["terminal"],
  },
  {
    slug: "persistence",
    title: "Persistence",
    description:
      "Persist filesystem across refreshes with IndexedDB and automatic saves",
    category: "runtime",
    icons: ["terminal"],
  },
  {
    slug: "sandbox",
    title: "Sandbox",
    description:
      "Run untrusted code safely with file limits, memory caps, and access controls",
    category: "runtime",
    icons: ["terminal"],
  },
  {
    slug: "pnpm-workspaces",
    title: "pnpm Workspaces",
    description:
      "Monorepo workspace discovery, symlink linking, and cross-package imports",
    category: "runtime",
    icons: ["pnpm", "terminal"],
  },
];
