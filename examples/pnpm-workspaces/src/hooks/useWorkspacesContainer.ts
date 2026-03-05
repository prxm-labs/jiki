import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  discoverWorkspaces,
  linkWorkspaces,
  isWorkspaceProtocol,
  type Container,
  type WorkspacePackage,
} from "jiki";

export type { TerminalLine, FileEntry } from "jiki-ui";
import type { TerminalLine, FileEntry } from "jiki-ui";

// ---------------------------------------------------------------------------
// Virtual monorepo: a realistic pnpm workspace with shared packages
// ---------------------------------------------------------------------------

const MONOREPO_FILES: Record<string, string> = {
  // ── Root config ──────────────────────────────────────────────────────
  "/package.json": JSON.stringify(
    {
      name: "my-monorepo",
      private: true,
      version: "1.0.0",
      scripts: {
        "build:all": "node scripts/build-all.js",
        test: "node packages/utils/test.js && node packages/logger/test.js && node apps/cli/test.js",
      },
    },
    null,
    2
  ),

  "/pnpm-workspace.yaml": `packages:
  - 'packages/*'
  - 'apps/*'
`,

  // ── @monorepo/utils — shared utility library ─────────────────────────
  "/packages/utils/package.json": JSON.stringify(
    {
      name: "@monorepo/utils",
      version: "1.2.0",
      main: "index.js",
    },
    null,
    2
  ),

  "/packages/utils/index.js": `/**
 * Shared utility functions used across the monorepo.
 */

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

module.exports = { slugify, capitalize, formatDate, deepMerge };
`,

  "/packages/utils/test.js": `const { slugify, capitalize, formatDate, deepMerge } = require('@monorepo/utils');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log('[PASS]', label);
    passed++;
  } else {
    console.log('[FAIL]', label, '— expected', JSON.stringify(expected), 'got', JSON.stringify(actual));
    failed++;
  }
}

assert('slugify', slugify('Hello World!'), 'hello-world');
assert('slugify special chars', slugify('foo & bar'), 'foo-bar');
assert('capitalize', capitalize('hello'), 'Hello');
assert('capitalize empty', capitalize(''), '');
assert('formatDate', formatDate('2025-06-15T10:30:00Z'), '2025-06-15');
assert('deepMerge', deepMerge({ a: 1, b: { x: 1 } }, { b: { y: 2 }, c: 3 }), { a: 1, b: { x: 1, y: 2 }, c: 3 });

console.log('');
console.log(\`@monorepo/utils: \${passed} passed, \${failed} failed\`);
`,

  // ── @monorepo/logger — structured logging package ────────────────────
  "/packages/logger/package.json": JSON.stringify(
    {
      name: "@monorepo/logger",
      version: "0.3.0",
      main: "index.js",
      dependencies: {
        "@monorepo/utils": "workspace:*",
      },
    },
    null,
    2
  ),

  "/packages/logger/index.js": `const { formatDate } = require('@monorepo/utils');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function createLogger(name, opts = {}) {
  const minLevel = LEVELS[opts.level || 'info'];

  function log(level, message, data) {
    if (LEVELS[level] < minLevel) return;
    const entry = {
      timestamp: formatDate(new Date()),
      level: level.toUpperCase(),
      logger: name,
      message,
    };
    if (data) entry.data = data;
    console.log(JSON.stringify(entry));
  }

  return {
    debug: (msg, data) => log('debug', msg, data),
    info:  (msg, data) => log('info', msg, data),
    warn:  (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
  };
}

module.exports = { createLogger, LEVELS };
`,

  "/packages/logger/test.js": `const { createLogger } = require('@monorepo/logger');

console.log('Testing @monorepo/logger...');

const log = createLogger('test-suite', { level: 'debug' });

log.debug('this is a debug message');
log.info('application started', { port: 3000 });
log.warn('deprecation notice', { feature: 'oldApi' });
log.error('something went wrong', { code: 'ERR_TIMEOUT' });

console.log('');
console.log('@monorepo/logger: all log levels working');
`,

  // ── @monorepo/cli — the "app" that consumes both packages ────────────
  "/apps/cli/package.json": JSON.stringify(
    {
      name: "@monorepo/cli",
      version: "0.1.0",
      main: "index.js",
      dependencies: {
        "@monorepo/utils": "workspace:*",
        "@monorepo/logger": "workspace:*",
      },
    },
    null,
    2
  ),

  "/apps/cli/index.js": `const { slugify, capitalize, deepMerge } = require('@monorepo/utils');
const { createLogger } = require('@monorepo/logger');

const log = createLogger('@monorepo/cli');

log.info('CLI starting');

// Use shared utils
const title = 'My Awesome Project';
const slug = slugify(title);
log.info('Generated slug', { title, slug });

const displayName = capitalize(slug.split('-')[0]);
log.info('Display name', { displayName });

// Merge default + user config
const defaults = { output: './dist', minify: true, sourcemap: false };
const userConfig = { output: './build', sourcemap: true };
const config = deepMerge(defaults, userConfig);
log.info('Merged config', config);

console.log('');
console.log('=== CLI Output ===');
console.log('Project:', title);
console.log('Slug:', slug);
console.log('Config:', JSON.stringify(config, null, 2));
`,

  "/apps/cli/test.js": `const { slugify, capitalize } = require('@monorepo/utils');
const { createLogger } = require('@monorepo/logger');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log('[PASS]', label);
    passed++;
  } else {
    console.log('[FAIL]', label, '— expected', JSON.stringify(expected), 'got', JSON.stringify(actual));
    failed++;
  }
}

// Integration: CLI uses both packages together
const log = createLogger('integration-test');
log.info('running integration tests');

assert('slugify from CLI context', slugify('Integration Test'), 'integration-test');
assert('capitalize from CLI context', capitalize('test'), 'Test');
assert('logger is a function', typeof createLogger, 'function');

console.log('');
console.log(\`@monorepo/cli: \${passed} passed, \${failed} failed\`);
`,

  // ── Build script ─────────────────────────────────────────────────────
  "/scripts/build-all.js": `const { createLogger } = require('@monorepo/logger');

const log = createLogger('build');

const packages = ['@monorepo/utils', '@monorepo/logger', '@monorepo/cli'];

log.info('Starting monorepo build');
for (const pkg of packages) {
  log.info(\`Building \${pkg}...\`);
}
log.info('All packages built successfully', { count: packages.length });
`,

  // ── Root README ──────────────────────────────────────────────────────
  "/README.md": `# My Monorepo

A pnpm workspace monorepo with shared packages.

## Structure

\`\`\`
packages/
  utils/    — Shared utility functions (@monorepo/utils)
  logger/   — Structured logging (@monorepo/logger)
apps/
  cli/      — CLI app consuming both packages (@monorepo/cli)
\`\`\`

## Commands

- \`node apps/cli/index.js\` — Run the CLI app
- \`node packages/utils/test.js\` — Test utils package
- \`node packages/logger/test.js\` — Test logger package
- \`node apps/cli/test.js\` — Test CLI integration
- \`pnpm run test\` — Run all tests
- \`pnpm run build:all\` — Build all packages
`,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

export function useWorkspacesContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspacePackage[]>([]);

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
          .filter((n) => !n.startsWith(".") && n !== "node_modules")
          .sort((a, b) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fullA).isDirectory();
            const bDir = c.vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fullPath =
              dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
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

  const bootContainer = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      packageManager: "pnpm",
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    // Write all monorepo files
    for (const [path, content] of Object.entries(MONOREPO_FILES)) {
      c.writeFile(path, content);
    }

    // Discover and link workspaces — the core feature this demo shows
    pushLine("info", "Discovering pnpm workspaces...");
    const ws = discoverWorkspaces(c.vfs, "/");
    setWorkspaces(ws);

    for (const pkg of ws) {
      pushLine("info", `  Found: ${pkg.name}@${pkg.version} → ${pkg.path}`);
    }

    pushLine("info", "Linking workspace packages into node_modules...");
    linkWorkspaces(c.vfs, "/", ws);

    // Also link within each package that has workspace deps
    for (const pkg of ws) {
      try {
        const pkgJson = JSON.parse(c.vfs.readFileSync(`${pkg.path}/package.json`, "utf8"));
        const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
        const localDeps = Object.entries(deps || {}).filter(([, v]) =>
          isWorkspaceProtocol(v as string)
        );
        if (localDeps.length > 0) {
          linkWorkspaces(c.vfs, pkg.path, ws);
          pushLine(
            "info",
            `  Linked ${localDeps.map(([n]) => n).join(", ")} into ${pkg.path}/node_modules`
          );
        }
      } catch {
        // skip
      }
    }

    pushLine("info", "");
    pushLine("info", "Workspace setup complete! Try these commands:");
    pushLine("info", "  node apps/cli/index.js       — Run the CLI app");
    pushLine("info", "  pnpm run test                — Run all tests");
    pushLine("info", "  pnpm run build:all           — Build all packages");

    setIsBooted(true);
    refreshFiles();
    setSelectedFile("/apps/cli/index.js");
    setFileContent(MONOREPO_FILES["/apps/cli/index.js"]);
  }, [pushLine, refreshFiles]);

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      pushLine("command", `$ ${cmd}`);
      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
        if (result.exitCode !== 0) {
          pushLine("info", `Process exited with code ${result.exitCode}`);
        }
      } catch (err) {
        pushLine("stderr", String(err));
      }
      refreshFiles();
    },
    [pushLine, refreshFiles]
  );

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
    },
    [refreshFiles, pushLine]
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  useEffect(() => {
    bootContainer();
  }, [bootContainer]);

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    workspaces,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
  };
}
