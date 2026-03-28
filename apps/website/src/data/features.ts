export interface Feature {
  number: string;
  label: string;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    number: "01",
    label: "VIRTUAL FILESYSTEM",
    title: "In-memory file system.",
    description:
      "Complete Node.js-compatible filesystem with directories, symlinks, file watching, and snapshot serialization.",
  },
  {
    number: "02",
    label: "PACKAGE MANAGER",
    title: "npm & pnpm built in.",
    description:
      "Fetch and install packages from the npm registry. Handles dependency resolution, semver ranges, and caching.",
  },
  {
    number: "03",
    label: "TRANSPILER",
    title: "TypeScript & JSX.",
    description:
      "Powered by esbuild-wasm for TypeScript, JSX, and ESM transpilation directly in the browser.",
  },
  {
    number: "04",
    label: "SHELL",
    title: "Full shell environment.",
    description:
      "Pipes, logical operators, built-in commands (ls, cat, cd, mkdir, rm, echo), and extensible command registration.",
  },
  {
    number: "05",
    label: "DEV SERVER",
    title: "HTTP server with HMR.",
    description:
      "Serves files and handles routes inside the browser via Service Workers. Supports hot module replacement.",
  },
  {
    number: "06",
    label: "FRAMEWORKS",
    title: "React, Vue, Next.js & more.",
    description:
      "Works with React, Vue, Svelte, Astro, Next.js, Nuxt, Vite, Express, and Hono.",
  },
  {
    number: "07",
    label: "SNAPSHOTS",
    title: "Serialize & restore.",
    description:
      "Save the entire container state (filesystem, packages, environment) and restore it on next boot.",
  },
  {
    number: "08",
    label: "NODE.JS POLYFILLS",
    title: "Comprehensive API coverage.",
    description:
      "Polyfills for fs, path, process, http, crypto, stream, child_process, events, and others.",
  },
  {
    number: "09",
    label: "UI COMPONENTS",
    title: "Ready-made editor & terminal.",
    description:
      "CodeEditor with Shiki syntax highlighting, Terminal, BrowserWindow, and FileExplorer components.",
  },
];
