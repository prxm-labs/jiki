<div align="center">
  <a href="https://jiki.sh">
    <img src="../../apps/website/public/favicon.svg" alt="Jiki" width="120" />
  </a>

<a href="https://jiki.sh"><img alt="jiki logo" src="https://img.shields.io/badge/MADE%20For%20the%20browser-000000.svg?style=for-the-badge"></a>
<a href="https://www.npmjs.com/package/@run0/jiki-ui"><img alt="NPM version" src="https://img.shields.io/npm/v/@run0/jiki-ui.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://github.com/prxm-labs/jiki/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@run0/jiki-ui.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://jiki.sh/docs/ui"><img alt="jiki logo" src="https://img.shields.io/badge/docs-000000.svg?style=for-the-badge"></a>

</div>

---

Ready-made React UI components for jiki containers. Code editor, terminal, file explorer, browser preview, and more. Drop them in and get a polished IDE experience with zero configuration.

## A few lines is all it takes

```tsx
import { CodeEditor, Terminal, FileExplorer } from "@run0/jiki-ui";

<FileExplorer files={files} onSelect={setActiveFile} accent="cyan" />
<CodeEditor value={code} language="typescript" accent="cyan" />
<Terminal lines={output} accent="cyan" />
```

## Components

- **CodeEditor** — Syntax-highlighted code editor with Shiki
- **Terminal** — Styled terminal output with ANSI support
- **FileExplorer** — Collapsible file tree with icons
- **BrowserWindow** — Browser chrome frame with URL bar
- **AIChatPanel** — Chat interface for AI-assisted workflows
- **PanelToggle** — Resizable panel layout controls
- **MobileTabBar** — Responsive bottom navigation tabs

## Learn more

- [Website](https://jiki.sh)
- [Documentation](https://jiki.sh/docs/ui)
- [API Reference](https://jiki.sh/docs/ui/code-editor)

## License

MIT
