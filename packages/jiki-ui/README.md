<p align="center">
  <img src="../../apps/website/public/favicon.svg" alt="Jiki" width="120" />
</p>
<h1 align="center">jiki-ui</h1>

React UI components for [jiki](https://jiki.sh) — the browser-based Node.js runtime.

## Install

```bash
npm install @run0/jiki-ui
```

Requires `react@^19.0.0` as a peer dependency.

## Components

- **CodeEditor** — syntax-highlighted editor with Shiki, tab support, and save shortcuts
- **Terminal** — command input with history navigation and output display
- **BrowserWindow** — iframe preview with navigation controls and URL bar
- **FileExplorer** — hierarchical directory tree with selection highlighting
- **AIChatPanel** — chat interface with code blocks, streaming, and element inspection
- **MobileTabBar** — responsive mobile layout with panel switching
- **PanelToggle** — visibility toggle for editor panels

## Usage

```tsx
import { CodeEditor, Terminal, BrowserWindow } from "@run0/jiki-ui";
```

## Documentation

- [Website](https://jiki.sh)
- [Docs](https://jiki.sh/docs)

## License

MIT
