# @run0/jiki

## 0.0.1-beta.5

### Patch Changes

- Hook-based plugin system with onResolve, onLoad, onTransform, onCommand, onInstall, and onBoot hooks. Resource limits and sandboxing for untrusted code. Performance metrics tracking. Network request interceptor for mocking fetch(). Heuristic TypeScript type checker. Browser bundle generator. IndexedDB persistence with fire-and-forget writes. Worker thread isolation. jiki-ui React component library with CodeEditor, Terminal, BrowserWindow, FileExplorer, AIChatPanel, and MobileTabBar.

## 0.0.1-beta.4

### Patch Changes

- Shell with command parsing, pipes, logical operators, redirects, glob expansion, brace expansion, background jobs, history navigation, and tab completion. Container API providing the main `boot()` entrypoint for runtime orchestration. Dev server infrastructure with Vite (HMR, ESM), Next.js (Pages/App Router, API routes), SvelteKit, and Remix framework support. Service worker bridge for preview rendering. Error parsing with fix suggestions.

## 0.0.1-beta.3

### Patch Changes

- Package management with npm registry client, semver dependency resolution, tarball extraction, and package caching. pnpm content-addressable store layout. Lockfile-aware installation from package-lock.json. Monorepo workspace discovery and linking with support for workspace: protocol.

## 0.0.1-beta.2

### Patch Changes

- Module system with CommonJS kernel and Node.js-style module resolver. esbuild-wasm transpiler for TypeScript and JSX with lazy WASM loading. ESM-to-CJS code transforms. Builtin module registration. 24 Node.js polyfills including fs, crypto, http, net, os, zlib, child_process, and more.

## 0.0.1-beta.1

### Patch Changes

- Initial release with in-memory virtual filesystem (MemFS), POSIX-like API for directory operations, symlinks, file watching, and snapshot serialization. Includes core Node.js polyfills for path, events, process, stream, assert, util, url, and querystring.
