<p align="center">
  <img src="../../apps/website/public/favicon.svg" alt="Jiki" width="120" />
</p>
<h1 align="center">jiki</h1>

A sandboxed Node.js runtime that runs entirely client-side. Filesystem, shell, npm/pnpm, and dev servers — no backend required.

## Install

```bash
npm install @run0/jiki
```

## Usage

```ts
import { boot } from "@run0/jiki";

const container = boot();
container.writeFile("/index.js", 'console.log("Hello from the browser!")');
await container.run("node index.js");
// → Hello from the browser!
```

## Features

- In-memory virtual filesystem with POSIX-like API
- CommonJS kernel with module resolution
- esbuild-wasm transpiler for TypeScript and JSX
- npm/pnpm package manager with workspace support
- Shell with pipes, globs, job control, and tab completion
- Dev servers for Vite, Next.js, SvelteKit, and Remix
- Hook-based plugin system
- IndexedDB persistence
- Sandboxing with resource limits

## Documentation

- [Website](https://jiki.sh)
- [Docs](https://jiki.sh/docs)
- [Examples](../../examples)

## License

MIT
