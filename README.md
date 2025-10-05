<p align="center">
  <img src="apps/website/public/favicon.svg" alt="Jiki" width="120" />
</p>

<p align="center">
  <strong>A full Node.js runtime that runs entirely in your browser.</strong><br/>
  Write files. Install npm packages. Run shell commands. Start dev servers. No backend required.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/jiki"><img src="https://img.shields.io/npm/v/jiki.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/jiki"><img src="https://img.shields.io/npm/dm/jiki.svg" alt="npm downloads" /></a>
  <a href="https://github.com/vorillaz/web-containers-lite/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/jiki.svg" alt="license" /></a>
  <a href="https://jiki.sh">Website</a>
  <a href="https://jiki.sh/docs">Docs</a>
</p>

---

## jiki: Node.js in the browser with filesystem, npm, shell, and dev servers

```ts
import { boot } from "jiki";

const container = boot();
container.writeFile("/index.js", 'console.log("Hello from the browser!")');
await container.run("node index.js");
// → Hello from the browser!
```

## Why jiki?

Build interactive coding experiences without spinning up servers or managing infrastructure. jiki gives you a sandboxed Node.js environment with a virtual filesystem, a real package manager, and a Unix-like shell running client-side..

## Features

- **Virtual Filesystem** — In-memory FS with directories, symlinks, watchers, and persistence
- **Package Manager** — Install packages from npm with full dependency resolution and caching
- **Shell** — Pipes, globs, background jobs, tab completion
- **Dev Servers** — Vite, Next.js, SvelteKit, and Remix with HMR
- **TypeScript & JSX** — First-class transpilation via esbuild-wasm
- **Sandboxing** — Resource limits for memory, files, and network access
- **Snapshots** — Serialize and restore entire container state
- **Plugin System** — Extend with `onResolve`, `onLoad`, `onTransform`, and more

## Use Cases

- Interactive coding tutorials with real code execution
- Documentation with runnable code snippets
- Browser-based IDEs with editor, terminal, and preview
- AI coding assistants with sandboxed file access
- Online playgrounds for React, Vue, Svelte, and more

## Quick Start

```bash
npm install jiki
```

```ts
import { boot } from "jiki";

const container = boot();

// Install packages
await container.run("npm install react react-dom");

// Write files
container.writeFile("/App.jsx", `
  export default function App() {
    return <h1>Hello Jiki</h1>;
  }
`);

// Start a dev server
await container.run("npx vite");
```

## Packages

| Package | Description |
|---------|-------------|
| [`jiki`](./packages/jiki) | Core runtime — filesystem, shell, package manager, dev servers |
| [`jiki-ui`](./packages/jiki-ui) | React UI components — CodeEditor, Terminal, BrowserWindow, FileExplorer |

## Examples

The [`examples/`](./examples) directory contains 30+ ready-to-run projects including React, Next.js, Astro, SvelteKit, Remix, shell scripting, pnpm workspaces, and more.

## License

MIT
