import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { Container, boot } from "../../src/container";
import {
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  preprocessImports,
  extractPackageName,
} from "../../src/browser-bundle";
import { transformEsmToCjs } from "../../src/code-transform";
import { initTranspiler, transpile } from "../../src/transpiler";
import { MemFS } from "../../src/memfs";

const JSX_OPTIONS = {
  jsx: "transform" as const,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
};

async function transpileComponent(
  code: string,
  filename: string,
): Promise<string> {
  const processed = preprocessImports(code);
  return transpile(processed, filename, JSX_OPTIONS);
}

function installMockPackage(
  vfs: MemFS,
  name: string,
  code: string,
  pkg?: Record<string, unknown>,
) {
  vfs.mkdirSync(`/node_modules/${name}`, { recursive: true });
  vfs.writeFileSync(
    `/node_modules/${name}/package.json`,
    JSON.stringify({ name, version: "1.0.0", main: "index.js", ...pkg }),
  );
  vfs.writeFileSync(`/node_modules/${name}/index.js`, code);
}

describe("External modules: install, compile, and use", () => {
  let container: Container;

  beforeAll(async () => {
    await initTranspiler();
  }, 30_000);

  afterEach(() => {
    container?.destroy();
  });

  function setup(): Container {
    container = boot({ cwd: "/", autoInstall: true });
    return container;
  }

  // ── Installation verification ──────────────────────────────────────

  describe("package installation and bundling", () => {
    it("installs a mock package and bundles it for the browser", () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "test-icons",
        'exports.Star = function() { return "star"; };',
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "test-icons",
        new Set(["react"]),
      );

      expect(bundle.entryPath).toBe("/node_modules/test-icons/index.js");
      expect(bundle.modules.has(bundle.entryPath)).toBe(true);
      expect(bundle.modules.get(bundle.entryPath)).toContain("Star");
    });

    it("generates a require shim that exposes the installed package", () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "my-utils",
        "exports.add = function(a, b) { return a + b; };",
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "my-utils",
        new Set(["react"]),
      );
      const bundles = new Map([["my-utils", bundle]]);
      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      expect(shim).toContain("<script>");
      expect(shim).toContain("window.require");
      expect(shim).toContain("my-utils");
      expect(shim).toContain("add");
    });

    it("bundles multiple packages together", () => {
      const c = setup();

      installMockPackage(c.vfs, "pkg-alpha", 'exports.A = "alpha";');
      installMockPackage(c.vfs, "pkg-beta", 'exports.B = "beta";');

      const externals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      bundles.set(
        "pkg-alpha",
        bundlePackageForBrowser(c.vfs, "pkg-alpha", externals),
      );
      bundles.set(
        "pkg-beta",
        bundlePackageForBrowser(c.vfs, "pkg-beta", externals),
      );

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("pkg-alpha");
      expect(shim).toContain("pkg-beta");
    });

    it("CDN globals (react) are excluded from bundling", () => {
      const c = setup();
      installMockPackage(c.vfs, "widget-lib", 'exports.Widget = "w";');

      const code = `import { Widget } from 'widget-lib';
import React from 'react';
function App() { return <Widget />; }`;

      const bareImports = scanBareImports([code]);
      const cdnExternals = new Set(["react", "react-dom"]);
      for (const ext of cdnExternals) bareImports.delete(ext);

      expect(bareImports.has("react")).toBe(false);
      expect(bareImports.has("widget-lib")).toBe(true);
    });
  });

  // ── JSX transpilation ─────────────────────────────────────────────

  describe("JSX file transpilation", () => {
    it("transpiles JSX to React.createElement calls", async () => {
      const jsx = `function Hello() { return <div className="test">Hello</div>; }`;
      const result = await transpileComponent(jsx, "Hello.jsx");

      expect(result).toContain("React.createElement");
      expect(result).toContain('"div"');
      expect(result).not.toContain("<div");
    });

    it("transpiles Fragments to React.Fragment", async () => {
      const jsx = `function List() { return <><span>A</span><span>B</span></>; }`;
      const result = await transpileComponent(jsx, "List.jsx");

      expect(result).toContain("React.Fragment");
      expect(result).not.toContain("<>");
    });

    it("converts JSX imports to window.require before transpilation", async () => {
      const code = `import { Camera } from 'lucide-react';
function App() { return <Camera size={24} />; }`;
      const result = await transpileComponent(code, "App.jsx");

      expect(result).toContain('window.require("lucide-react")');
      expect(result).toContain("React.createElement");
      expect(result).not.toMatch(/^import\s/m);
      expect(result).not.toContain("<Camera");
    });

    it("handles multiple named imports from a package in JSX", async () => {
      const code = `import { Camera, Heart, Star } from 'lucide-react';
function Icons() {
  return (
    <div>
      <Camera size={32} />
      <Heart size={32} />
      <Star size={32} />
    </div>
  );
}`;
      const result = await transpileComponent(code, "Icons.jsx");

      expect(result).toContain('window.require("lucide-react")');
      expect(result).toContain("React.createElement");
      expect(result).not.toContain("<Camera");
      expect(result).not.toContain("<Heart");
      expect(result).not.toContain("<Star");
    });
  });

  // ── TSX transpilation ─────────────────────────────────────────────

  describe("TSX file transpilation", () => {
    it("strips TypeScript types and compiles JSX", async () => {
      const tsx = `interface Props {
  name: string;
  count: number;
}
function Greeting({ name, count }: Props) {
  return <div>Hello {name}, count: {count}</div>;
}`;
      const result = await transpileComponent(tsx, "Greeting.tsx");

      expect(result).toContain("React.createElement");
      expect(result).not.toContain("interface");
      expect(result).not.toContain(": Props");
      expect(result).not.toContain(": string");
      expect(result).not.toContain("<div>");
    });

    it("handles TSX with imports from external packages", async () => {
      const tsx = `import { Camera } from 'lucide-react';

interface IconProps {
  size: number;
  color: string;
}

function IconDisplay({ size, color }: IconProps) {
  return <Camera size={size} color={color} />;
}`;
      const result = await transpileComponent(tsx, "IconDisplay.tsx");

      expect(result).toContain('window.require("lucide-react")');
      expect(result).toContain("React.createElement");
      expect(result).not.toContain("interface");
      expect(result).not.toContain(": IconProps");
      expect(result).not.toContain("<Camera");
    });

    it("strips type-only imports in TSX", async () => {
      const tsx = `import type { FC } from 'react';
import { Camera } from 'lucide-react';
const App: FC = () => <Camera />;`;
      const result = await transpileComponent(tsx, "App.tsx");

      expect(result).toContain('window.require("lucide-react")');
      expect(result).not.toContain("import type");
      expect(result).not.toContain(": FC");
    });
  });

  // ── TypeScript (TS) transpilation ──────────────────────────────────

  describe("TS file transpilation", () => {
    it("strips types from plain TypeScript", async () => {
      const ts = `import { foo } from 'my-lib';
const x: string = foo();
export default x;`;
      const result = await transpileComponent(ts, "util.ts");

      expect(result).toContain('window.require("my-lib")');
      expect(result).not.toContain(": string");
    });

    it("handles TypeScript enums and interfaces", async () => {
      const ts = `import { Status } from 'status-lib';

interface Config {
  debug: boolean;
  level: number;
}

enum Mode {
  Fast = 'fast',
  Slow = 'slow',
}

function getConfig(): Config {
  return { debug: true, level: 1 };
}`;
      const result = await transpileComponent(ts, "config.ts");

      expect(result).toContain('window.require("status-lib")');
      expect(result).not.toContain("interface Config");
    });
  });

  // ── Plain JS transpilation ─────────────────────────────────────────

  describe("JS file transpilation", () => {
    it("transforms imports in plain JS files", async () => {
      const js = `import { foo } from 'my-pkg';
console.log(foo());`;
      const result = await transpileComponent(js, "main.js");

      expect(result).toContain('window.require("my-pkg")');
      expect(result).not.toMatch(/^import\s/m);
    });

    it("handles default and namespace imports in JS", async () => {
      const code1 = `import MyLib from 'my-lib';
function A() { return MyLib(); }`;
      const code2 = `import * as Icons from 'icon-pack';
function B() { return Icons.Star(); }`;

      const r1 = await transpileComponent(code1, "A.js");
      expect(r1).toContain('window.require("my-lib")');
      expect(r1).toContain("__esModule");
      expect(r1).not.toMatch(/^import\s/m);

      const r2 = await transpileComponent(code2, "B.js");
      expect(r2).toContain('window.require("icon-pack")');
      expect(r2).not.toMatch(/^import\s/m);
    });
  });

  // ── Dynamic imports ────────────────────────────────────────────────

  describe("dynamic imports", () => {
    it("transforms import() to __dynamicImport() via AST", () => {
      const code = 'const mod = import("./foo");';
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).toContain("__dynamicImport");
      expect(result).not.toContain("import(");
    });

    it("transforms dynamic import with a bare specifier", () => {
      const code =
        'async function load() { const m = await import("lodash"); }';
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).toContain('__dynamicImport("lodash")');
    });

    it("does not transform property access .import()", () => {
      const code = 'obj.import("test");';
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).not.toContain("__dynamicImport");
    });

    it("bundles dynamically imported sub-modules", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/dyn-pkg", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/dyn-pkg/package.json",
        JSON.stringify({ name: "dyn-pkg", main: "index.js" }),
      );
      c.vfs.writeFileSync(
        "/node_modules/dyn-pkg/index.js",
        'import("./lazy");\nexport const main = true;',
      );
      c.vfs.writeFileSync(
        "/node_modules/dyn-pkg/lazy.js",
        'export const lazy = "loaded";',
      );

      const bundle = bundlePackageForBrowser(c.vfs, "dyn-pkg", new Set());
      expect(bundle.modules.size).toBe(2);
      expect(bundle.modules.has("/node_modules/dyn-pkg/lazy.js")).toBe(true);
    });

    it("require shim includes __dynamicImport wrapper", () => {
      const c = setup();
      installMockPackage(c.vfs, "dyn-test", "exports.x = 1;");

      const bundle = bundlePackageForBrowser(c.vfs, "dyn-test", new Set());
      const bundles = new Map([["dyn-test", bundle]]);
      const shim = generateRequireScript(bundles, {});

      expect(shim).toContain("window.__dynamicImport");
      expect(shim).toContain("Promise.resolve");
    });
  });

  // ── ESM-to-CJS with JSX (acorn-jsx) ───────────────────────────────

  describe("ESM-to-CJS transformation with JSX content", () => {
    it("transforms ESM containing JSX via AST without falling to regex", () => {
      const code = `import React from 'react';
export default function App() {
  return <div className="app">Hello</div>;
}`;
      const result = transformEsmToCjs(code, "/App.jsx");

      expect(result).toContain("require");
      expect(result).toContain("__esModule");
      expect(result).not.toMatch(/^import\s/m);
      expect(result).not.toMatch(/^export\s/m);
    });

    it("handles JSX with named exports", () => {
      const code = `import { useState } from 'react';
export const Button = () => <button>Click</button>;
export const Link = () => <a href="#">Link</a>;`;
      const result = transformEsmToCjs(code, "/components.jsx");

      expect(result).toContain("require");
      expect(result).toContain("__esModule");
      expect(result).toContain("Button");
      expect(result).toContain("Link");
    });

    it("handles JSX fragments in ESM-to-CJS", () => {
      const code = `export default () => <><span>A</span><span>B</span></>;`;
      const result = transformEsmToCjs(code, "/Frag.jsx");

      expect(result).toContain("__esModule");
      expect(result).not.toMatch(/^export\s/m);
    });

    it("handles import.meta inside JSX files", () => {
      const code = `import React from 'react';
const url = import.meta.url;
export default () => <div>{url}</div>;`;
      const result = transformEsmToCjs(code, "/Meta.jsx");

      expect(result).toContain("import_meta");
      expect(result).not.toContain("import.meta");
    });

    it("handles dynamic imports inside JSX files", () => {
      const code = `import React from 'react';
export default () => {
  const load = () => import('./lazy');
  return <button onClick={load}>Load</button>;
};`;
      const result = transformEsmToCjs(code, "/Dynamic.jsx");

      expect(result).toContain("__dynamicImport");
    });
  });

  // ── End-to-end pipeline ────────────────────────────────────────────

  describe("end-to-end pipeline: install -> transpile -> bundle -> HTML", () => {
    it("full pipeline: install package, import, transpile, bundle, generate HTML", async () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/lucide-react", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/lucide-react/package.json",
        JSON.stringify({
          name: "lucide-react",
          version: "0.400.0",
          main: "dist/cjs/lucide-react.js",
        }),
      );
      c.vfs.mkdirSync("/node_modules/lucide-react/dist/cjs", {
        recursive: true,
      });
      c.vfs.writeFileSync(
        "/node_modules/lucide-react/dist/cjs/lucide-react.js",
        [
          '"use strict";',
          "Object.defineProperty(exports, '__esModule', { value: true });",
          "const React = require('react');",
          "const Camera = (props) => React.createElement('svg', props);",
          "const Heart = (props) => React.createElement('svg', props);",
          "exports.Camera = Camera;",
          "exports.Heart = Heart;",
        ].join("\n"),
      );

      const component = `import { Camera, Heart } from 'lucide-react';
function Icons() {
  return (
    <div>
      <Camera size={32} color="#7c3aed" />
      <Heart size={32} color="red" />
    </div>
  );
}`;

      const transpiled = await transpileComponent(
        component,
        "/src/pages/Icons.jsx",
      );
      expect(transpiled).toContain('window.require("lucide-react")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("<Camera");
      expect(transpiled).not.toContain("<Heart");

      const bareImports = scanBareImports([component]);
      expect(bareImports).toContain("lucide-react");

      const cdnExternals = new Set(["react", "react-dom"]);
      for (const ext of cdnExternals) bareImports.delete(ext);

      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        bundles.set(
          pkgName,
          bundlePackageForBrowser(c.vfs, pkgName, cdnExternals),
        );
      }

      const bundle = bundles.get("lucide-react")!;
      expect(bundle.entryPath).toBe(
        "/node_modules/lucide-react/dist/cjs/lucide-react.js",
      );
      expect(bundle.modules.get(bundle.entryPath)).toContain("Camera");

      const requireShim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      const html = requireShim + "\n" + `<script>\n${transpiled}\n</script>`;
      expect(html).toContain("React.createElement");
      expect(html).toContain("window.require");
      expect(html).toContain("lucide-react");
      expect(html).toContain("window.__dynamicImport");
      expect(html).not.toContain('type="text/babel"');
    });

    it("missing package produces valid HTML with empty require shim", async () => {
      setup();

      const code = `import { Camera } from 'lucide-react';
function Icons() {
  const hasIcons = typeof Camera !== 'undefined';
  if (!hasIcons) return <div>Install lucide-react first</div>;
  return <Camera />;
}`;

      const transpiled = await transpileComponent(code, "Icons.jsx");
      expect(transpiled).toContain('window.require("lucide-react")');
      expect(transpiled).toContain("React.createElement");

      const bareImports = scanBareImports([code]);
      const cdnExternals = new Set(["react", "react-dom"]);
      for (const ext of cdnExternals) bareImports.delete(ext);

      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        try {
          bundles.set(
            pkgName,
            bundlePackageForBrowser(container.vfs, pkgName, cdnExternals),
          );
        } catch {
          /* not installed */
        }
      }
      expect(bundles.size).toBe(0);

      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });
      expect(shim).toContain("window.require");
    });

    it("TSX end-to-end: install, transpile with types, bundle", async () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "my-icons",
        [
          '"use strict";',
          "Object.defineProperty(exports, '__esModule', { value: true });",
          "exports.Star = function(props) { return 'star'; };",
        ].join("\n"),
      );

      const tsx = `import type { FC } from 'react';
import { Star } from 'my-icons';

interface PageProps {
  title: string;
}

const Page: FC<PageProps> = ({ title }) => {
  return (
    <div>
      <h1>{title}</h1>
      <Star size={24} />
    </div>
  );
};

export default Page;`;

      const transpiled = await transpileComponent(tsx, "Page.tsx");
      expect(transpiled).toContain('window.require("my-icons")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("interface");
      expect(transpiled).not.toContain(": FC");
      expect(transpiled).not.toContain("import type");

      const bareImports = scanBareImports([tsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      for (const ext of cdnExternals) bareImports.delete(ext);

      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        bundles.set(
          pkgName,
          bundlePackageForBrowser(c.vfs, pkgName, cdnExternals),
        );
      }
      expect(bundles.has("my-icons")).toBe(true);

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("my-icons");
      expect(shim).toContain("Star");
    });

    it("JS end-to-end: install, transform imports, bundle", async () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "math-utils",
        "exports.add = function(a, b) { return a + b; };",
      );

      const js = `import { add } from 'math-utils';
const result = add(1, 2);
console.log(result);`;

      const transpiled = await transpileComponent(js, "calc.js");
      expect(transpiled).toContain('window.require("math-utils")');
      expect(transpiled).not.toMatch(/^import\s/m);

      const bareImports = scanBareImports([js]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        bundles.set(
          pkgName,
          bundlePackageForBrowser(c.vfs, pkgName, new Set()),
        );
      }

      const shim = generateRequireScript(bundles, {});
      expect(shim).toContain("math-utils");
      expect(shim).toContain("add");
    });

    it("TS end-to-end: install, strip types, transform imports, bundle", async () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "config-lib",
        "exports.getConfig = function() { return { debug: false }; };",
      );

      const ts = `import { getConfig } from 'config-lib';

interface AppConfig {
  debug: boolean;
}

const config: AppConfig = getConfig();
export default config;`;

      const transpiled = await transpileComponent(ts, "setup.ts");
      expect(transpiled).toContain('window.require("config-lib")');
      expect(transpiled).not.toContain("interface AppConfig");
      expect(transpiled).not.toContain(": AppConfig");

      const bareImports = scanBareImports([ts]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        bundles.set(
          pkgName,
          bundlePackageForBrowser(c.vfs, pkgName, new Set()),
        );
      }

      const shim = generateRequireScript(bundles, {});
      expect(shim).toContain("config-lib");
      expect(shim).toContain("getConfig");
    });
  });

  // ── Realistic JSX/TSX component examples ───────────────────────────

  describe("JSX component with hooks, props, and external icons", () => {
    it("transpiles a realistic multi-component JSX page with lucide-react", async () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/lucide-react/dist/cjs", {
        recursive: true,
      });
      c.vfs.writeFileSync(
        "/node_modules/lucide-react/package.json",
        JSON.stringify({
          name: "lucide-react",
          version: "0.400.0",
          main: "dist/cjs/lucide-react.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/lucide-react/dist/cjs/lucide-react.js",
        [
          '"use strict";',
          "Object.defineProperty(exports, '__esModule', { value: true });",
          "const React = require('react');",
          "exports.Camera = (p) => React.createElement('svg', Object.assign({}, p, { 'data-icon': 'camera' }));",
          "exports.Heart = (p) => React.createElement('svg', Object.assign({}, p, { 'data-icon': 'heart' }));",
          "exports.Star = (p) => React.createElement('svg', Object.assign({}, p, { 'data-icon': 'star' }));",
          "exports.Sun = (p) => React.createElement('svg', Object.assign({}, p, { 'data-icon': 'sun' }));",
          "exports.Moon = (p) => React.createElement('svg', Object.assign({}, p, { 'data-icon': 'moon' }));",
        ].join("\n"),
      );

      const jsx = `import { Camera, Heart, Star, Sun, Moon } from 'lucide-react';

function IconGrid() {
  const [size, setSize] = React.useState(32);
  const [color, setColor] = React.useState('#7c3aed');

  const icons = [
    { Icon: Camera, name: 'Camera' },
    { Icon: Heart, name: 'Heart' },
    { Icon: Star, name: 'Star' },
    { Icon: Sun, name: 'Sun' },
    { Icon: Moon, name: 'Moon' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 p-6">
      <div className="col-span-5 flex gap-4 mb-4">
        <input
          type="range"
          min={16}
          max={64}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      {icons.map(({ Icon, name }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon size={size} color={color} />
          <span className="text-sm text-gray-500">{name}</span>
        </div>
      ))}
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/pages/Icons.jsx");

      expect(transpiled).toContain('window.require("lucide-react")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("<div");
      expect(transpiled).not.toContain("<input");
      expect(transpiled).not.toContain("<Icon");
      expect(transpiled).not.toContain("<span");
      expect(transpiled).not.toMatch(/^import\s/m);

      const bareImports = scanBareImports([jsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      for (const ext of cdnExternals) bareImports.delete(ext);
      expect(bareImports.has("lucide-react")).toBe(true);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "lucide-react",
        cdnExternals,
      );
      expect(bundle.modules.get(bundle.entryPath)).toContain("Camera");
      expect(bundle.modules.get(bundle.entryPath)).toContain("Heart");
      expect(bundle.modules.get(bundle.entryPath)).toContain("Star");

      const bundles = new Map([["lucide-react", bundle]]);
      const html =
        generateRequireScript(bundles, {
          react: "React",
          "react-dom": "ReactDOM",
        }) + `\n<script>\n${transpiled}\n</script>`;

      expect(html).toContain("window.require");
      expect(html).toContain("window.__dynamicImport");
      expect(html).toContain("lucide-react");
      expect(html).toContain("React.createElement");
      expect(html).not.toMatch(/<[A-Z]\w+\s/);
    });
  });

  describe("TSX component with generics, hooks, and conditional rendering", () => {
    it("transpiles a realistic TSX page with TypeScript generics and interfaces", async () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "data-grid",
        [
          '"use strict";',
          "Object.defineProperty(exports, '__esModule', { value: true });",
          "const React = require('react');",
          "exports.DataGrid = function DataGrid(props) {",
          "  return React.createElement('table', null,",
          "    React.createElement('tbody', null,",
          "      (props.rows || []).map(function(row, i) {",
          "        return React.createElement('tr', { key: i },",
          "          Object.values(row).map(function(val, j) {",
          "            return React.createElement('td', { key: j }, String(val));",
          "          })",
          "        );",
          "      })",
          "    )",
          "  );",
          "};",
          "exports.Pagination = function Pagination(props) {",
          "  return React.createElement('nav', null,",
          "    React.createElement('span', null, 'Page ' + props.page + ' of ' + props.total)",
          "  );",
          "};",
        ].join("\n"),
      );

      const tsx = `import type { ReactNode } from 'react';
import { DataGrid, Pagination } from 'data-grid';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'editor';
}

interface PageState<T> {
  items: T[];
  page: number;
  total: number;
  loading: boolean;
}

type SortDirection = 'asc' | 'desc';

function UsersPage(): ReactNode {
  const [state, setState] = React.useState<PageState<User>>({
    items: [],
    page: 1,
    total: 1,
    loading: false,
  });
  const [sortDir, setSortDir] = React.useState<SortDirection>('asc');

  const handleSort = (dir: SortDirection) => {
    setSortDir(dir);
  };

  if (state.loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <button onClick={() => handleSort(sortDir === 'asc' ? 'desc' : 'asc')}>
        Sort {sortDir === 'asc' ? '↓' : '↑'}
      </button>
      <DataGrid rows={state.items} />
      <Pagination page={state.page} total={state.total} />
    </div>
  );
}

export default UsersPage;`;

      const transpiled = await transpileComponent(tsx, "/src/pages/Users.tsx");

      expect(transpiled).toContain('window.require("data-grid")');
      expect(transpiled).toContain("React.createElement");

      expect(transpiled).not.toContain("interface User");
      expect(transpiled).not.toContain("interface PageState");
      expect(transpiled).not.toContain("type SortDirection");
      expect(transpiled).not.toContain(": ReactNode");
      expect(transpiled).not.toContain(": SortDirection");
      expect(transpiled).not.toContain("<PageState<User>>");
      expect(transpiled).not.toContain("import type");

      expect(transpiled).not.toContain("<div");
      expect(transpiled).not.toContain("<h1");
      expect(transpiled).not.toContain("<button");
      expect(transpiled).not.toContain("<DataGrid");
      expect(transpiled).not.toContain("<Pagination");
      expect(transpiled).not.toMatch(/^import\s/m);

      const bareImports = scanBareImports([tsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      for (const ext of cdnExternals) bareImports.delete(ext);
      expect(bareImports.has("data-grid")).toBe(true);

      const bundle = bundlePackageForBrowser(c.vfs, "data-grid", cdnExternals);
      expect(bundle.modules.get(bundle.entryPath)).toContain("DataGrid");
      expect(bundle.modules.get(bundle.entryPath)).toContain("Pagination");

      const bundles = new Map([["data-grid", bundle]]);
      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      const html = shim + `\n<script>\n${transpiled}\n</script>`;
      expect(html).toContain("window.require");
      expect(html).toContain("data-grid");
      expect(html).toContain("DataGrid");
      expect(html).toContain("React.createElement");
      expect(html).not.toMatch(/<[A-Z]\w+[\s/>]/);
    });
  });

  // ── React example: lucide-react install + Icons.jsx rendering ────────

  describe("React example: lucide-react install and Icons.jsx parsing", () => {
    const ICONS_JSX = `import { Camera, Heart, Star, Sun, Moon, Zap, Coffee, Music, Globe, Rocket } from 'lucide-react';

function Icons() {
  const [size, setSize] = React.useState(32);
  const [color, setColor] = React.useState('#7c3aed');

  const icons = [
    { Icon: Camera, name: 'Camera' },
    { Icon: Heart, name: 'Heart' },
    { Icon: Star, name: 'Star' },
    { Icon: Sun, name: 'Sun' },
    { Icon: Moon, name: 'Moon' },
    { Icon: Zap, name: 'Zap' },
    { Icon: Coffee, name: 'Coffee' },
    { Icon: Music, name: 'Music' },
    { Icon: Globe, name: 'Globe' },
    { Icon: Rocket, name: 'Rocket' },
  ];

  const hasIcons = typeof Camera !== 'undefined';

  if (!hasIcons) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="text-5xl mb-4">\\uD83D\\uDCE6</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Install lucide-react</h1>
        <p className="text-gray-500 mb-6">
          Run the following command in the terminal to see this page in action:
        </p>
        <div className="inline-block bg-gray-900 text-green-400 font-mono text-sm px-6 py-3 rounded-lg">
          npm install lucide-react
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Icon Gallery</h1>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {icons.map(({ Icon, name }) => (
          <div key={name} className="flex flex-col items-center gap-2 p-4">
            <Icon size={size} color={color} />
            <span className="text-xs">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}`;

    const APP_JSX = `function App() {
  const [path, setPath] = React.useState('/icons');
  let Page = Icons;
  return (
    <div className="min-h-screen">
      <main><Page /></main>
    </div>
  );
}`;

    function installLucideReactMock(vfs: MemFS) {
      vfs.mkdirSync("/node_modules/lucide-react/dist/cjs", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/lucide-react/package.json",
        JSON.stringify({
          name: "lucide-react",
          version: "0.469.0",
          main: "dist/cjs/lucide-react.js",
          module: "dist/esm/lucide-react.js",
          sideEffects: false,
        }),
      );
      const iconNames = [
        "Camera",
        "Heart",
        "Star",
        "Sun",
        "Moon",
        "Zap",
        "Coffee",
        "Music",
        "Globe",
        "Rocket",
      ];
      // Matches the real lucide-react CJS bundle structure which uses
      // template literals (`...${...}`) and modern JS features.
      const cjsLines = [
        '"use strict";',
        "Object.defineProperty(exports, '__esModule', { value: true });",
        "var react = require('react');",
        "",
        "var toKebabCase = function(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); };",
        "var mergeClasses = function() { return [].slice.call(arguments).filter(Boolean).join(' ').trim(); };",
        "",
        "var defaultAttributes = { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };",
        "",
        // Uses template literal and ${} interpolation, matching the real bundle
        "var createLucideIcon = function(iconName, iconNode) {",
        "  var Component = react.forwardRef(",
        "    function(props, ref) {",
        "      var className = props.className; var rest = Object.assign({}, props); delete rest.className;",
        "      return react.createElement('svg', Object.assign({}, defaultAttributes, rest, {",
        "        ref: ref,",
        "        className: mergeClasses(`lucide-${toKebabCase(iconName)}`, className)",
        "      }), iconNode.map(function(n) { return react.createElement(n[0], n[1]); }));",
        "    }",
        "  );",
        "  Component.displayName = `${iconName}`;",
        "  return Component;",
        "};",
        "",
      ];
      for (const name of iconNames) {
        cjsLines.push(
          `var ${name} = createLucideIcon("${name}", [["path", { d: "M0 0", key: "${name.toLowerCase()}" }]]);`,
        );
      }
      cjsLines.push("");
      for (const name of iconNames) {
        cjsLines.push(`exports.${name} = ${name};`);
      }
      cjsLines.push("exports.createLucideIcon = createLucideIcon;");
      vfs.writeFileSync(
        "/node_modules/lucide-react/dist/cjs/lucide-react.js",
        cjsLines.join("\n"),
      );
    }

    const CDN_GLOBALS: Record<string, string> = {
      react: "React",
      "react-dom": "ReactDOM",
      "react-dom/client": "ReactDOM",
    };
    const CDN_EXTERNALS = new Set(Object.keys(CDN_GLOBALS));

    it("full assembleHtml pipeline: Icons.jsx with lucide-react installed", async () => {
      const c = setup();

      c.vfs.writeFileSync("/src/pages/Icons.jsx", ICONS_JSX);
      c.vfs.writeFileSync("/src/App.jsx", APP_JSX);

      installLucideReactMock(c.vfs);

      const sources = [ICONS_JSX, APP_JSX];
      const transpiled = await Promise.all([
        transpileComponent(ICONS_JSX, "/src/pages/Icons.jsx"),
        transpileComponent(APP_JSX, "/src/App.jsx"),
      ]);

      for (const code of transpiled) {
        expect(code).toContain("React.createElement");
        expect(code).not.toMatch(/^import\s/m);
        expect(code).not.toContain("<div");
      }

      const iconsTranspiled = transpiled[0];
      expect(iconsTranspiled).toContain('window.require("lucide-react")');
      expect(iconsTranspiled).not.toContain("<Icon");
      expect(iconsTranspiled).not.toContain("<h1");
      expect(iconsTranspiled).not.toContain("<span");
      expect(iconsTranspiled).not.toContain("<input");

      const bareImports = scanBareImports(sources);
      expect(bareImports.has("lucide-react")).toBe(true);
      for (const ext of CDN_EXTERNALS) bareImports.delete(ext);
      expect(bareImports.size).toBe(1);

      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        const bundle = bundlePackageForBrowser(c.vfs, pkgName, CDN_EXTERNALS);
        bundles.set(pkgName, bundle);
      }

      const lucideBundle = bundles.get("lucide-react")!;
      expect(lucideBundle.entryPath).toBe(
        "/node_modules/lucide-react/dist/cjs/lucide-react.js",
      );
      const bundledCode = lucideBundle.modules.get(lucideBundle.entryPath)!;
      expect(bundledCode).toContain("Camera");
      expect(bundledCode).toContain("Heart");
      expect(bundledCode).toContain("Star");
      expect(bundledCode).toContain("Rocket");
      expect(bundledCode).toContain("require('react')");

      const requireShim = generateRequireScript(bundles, CDN_GLOBALS);

      expect(requireShim).toContain("window.require");
      expect(requireShim).toContain("window.__dynamicImport");
      expect(requireShim).toContain("lucide-react");

      const html = [
        "<!DOCTYPE html><html><head>",
        requireShim,
        ...transpiled.map(js => `<script>\n${js}\n</script>`),
        "</head><body><div id='root'></div>",
        "<script>",
        "var root = ReactDOM.createRoot(document.getElementById('root'));",
        "root.render(React.createElement(App));",
        "</script></body></html>",
      ].join("\n");

      expect(html).toContain("window.require");
      expect(html).toContain("lucide-react");
      expect(html).toContain("React.createElement");
      expect(html).toContain("window.__dynamicImport");

      expect(html).not.toContain("<Camera");
      expect(html).not.toContain("<Icon");
      expect(html).not.toContain('type="text/babel"');

      const importMatches = html.match(/^import\s/gm);
      expect(importMatches).toBeNull();
    });

    it("Icons.jsx without lucide-react installed still produces valid HTML", async () => {
      const c = setup();

      c.vfs.writeFileSync("/src/pages/Icons.jsx", ICONS_JSX);
      c.vfs.writeFileSync("/src/App.jsx", APP_JSX);

      const transpiled = await transpileComponent(
        ICONS_JSX,
        "/src/pages/Icons.jsx",
      );

      expect(transpiled).toContain('window.require("lucide-react")');
      expect(transpiled).toContain("React.createElement");

      const bareImports = scanBareImports([ICONS_JSX]);
      for (const ext of CDN_EXTERNALS) bareImports.delete(ext);

      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImports) {
        try {
          bundles.set(
            pkgName,
            bundlePackageForBrowser(c.vfs, pkgName, CDN_EXTERNALS),
          );
        } catch {
          /* not installed */
        }
      }
      expect(bundles.size).toBe(0);

      const shim = generateRequireScript(bundles, CDN_GLOBALS);
      expect(shim).toContain("window.require");

      const html = shim + `\n<script>\n${transpiled}\n</script>`;
      expect(html).toContain("React.createElement");
      expect(html).not.toContain("<div");
    });

    it("after install, re-running the pipeline picks up the package", async () => {
      const c = setup();

      c.vfs.writeFileSync("/src/pages/Icons.jsx", ICONS_JSX);

      const bareImportsBefore = scanBareImports([ICONS_JSX]);
      for (const ext of CDN_EXTERNALS) bareImportsBefore.delete(ext);
      const bundlesBefore = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImportsBefore) {
        try {
          bundlesBefore.set(
            pkgName,
            bundlePackageForBrowser(c.vfs, pkgName, CDN_EXTERNALS),
          );
        } catch {
          /* expected */
        }
      }
      expect(bundlesBefore.size).toBe(0);

      installLucideReactMock(c.vfs);

      const bareImportsAfter = scanBareImports([ICONS_JSX]);
      for (const ext of CDN_EXTERNALS) bareImportsAfter.delete(ext);
      const bundlesAfter = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const pkgName of bareImportsAfter) {
        bundlesAfter.set(
          pkgName,
          bundlePackageForBrowser(c.vfs, pkgName, CDN_EXTERNALS),
        );
      }
      expect(bundlesAfter.size).toBe(1);
      expect(bundlesAfter.has("lucide-react")).toBe(true);

      const bundle = bundlesAfter.get("lucide-react")!;
      expect(bundle.modules.get(bundle.entryPath)).toContain("Camera");
    });

    it("preserves template literals in bundled CJS code (backticks and ${})", () => {
      const c = setup();

      installLucideReactMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "lucide-react",
        CDN_EXTERNALS,
      );
      const bundles = new Map([["lucide-react", bundle]]);
      const shim = generateRequireScript(bundles, CDN_GLOBALS);

      expect(shim).toContain("createLucideIcon");
      // The template literal must be preserved verbatim in the output script
      expect(shim).toContain("`lucide-${toKebabCase(iconName)}`");
      expect(shim).toContain("`${iconName}`");

      // Must NOT have broken escaping (backslash before backtick)
      expect(shim).not.toContain("\\`lucide-");
      expect(shim).not.toContain("\\${toKebabCase");
      expect(shim).not.toContain("\\${iconName}");
    });
  });

  // ── Subpath imports and complex package structures ──────────────────

  describe("subpath imports (@scope/pkg/subpath)", () => {
    function installBaseUiMock(vfs: MemFS) {
      vfs.mkdirSync("/node_modules/@base-ui/react/checkbox/dist", {
        recursive: true,
      });
      vfs.mkdirSync("/node_modules/@base-ui/react/dialog/dist", {
        recursive: true,
      });
      vfs.mkdirSync("/node_modules/@base-ui/react/shared", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/@base-ui/react/package.json",
        JSON.stringify({
          name: "@base-ui/react",
          version: "1.0.0",
          exports: {
            "./checkbox": {
              require: "./checkbox/dist/index.cjs",
              import: "./checkbox/dist/index.js",
            },
            "./dialog": {
              require: "./dialog/dist/index.cjs",
              import: "./dialog/dist/index.js",
            },
          },
          peerDependencies: { react: ">=18" },
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@base-ui/react/shared/utils.js",
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.useId = function() { return Math.random().toString(36).slice(2); };\n',
      );
      vfs.writeFileSync(
        "/node_modules/@base-ui/react/checkbox/dist/index.cjs",
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n' +
          "var React = require('react');\n" +
          "var utils = require('../../shared/utils');\n" +
          "function CheckboxRoot(props) {\n" +
          "  var id = utils.useId();\n" +
          "  return React.createElement('input', { type: 'checkbox', id: id, checked: props.checked });\n" +
          "}\n" +
          "function CheckboxIndicator(props) {\n" +
          "  return React.createElement('span', null, props.children);\n" +
          "}\n" +
          "exports.Checkbox = { Root: CheckboxRoot, Indicator: CheckboxIndicator };\n",
      );
      vfs.writeFileSync(
        "/node_modules/@base-ui/react/dialog/dist/index.cjs",
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n' +
          "var React = require('react');\n" +
          "var utils = require('../../shared/utils');\n" +
          "function DialogRoot(props) {\n" +
          "  var id = utils.useId();\n" +
          "  return React.createElement('dialog', { id: id, open: props.open }, props.children);\n" +
          "}\n" +
          "exports.Dialog = { Root: DialogRoot };\n",
      );
    }

    it("scanBareImports returns full specifiers for subpath imports", () => {
      const sources = [
        'import { Checkbox } from "@base-ui/react/checkbox";',
        'import { Dialog } from "@base-ui/react/dialog";',
      ];
      const result = scanBareImports(sources);
      expect(result).toContain("@base-ui/react/checkbox");
      expect(result).toContain("@base-ui/react/dialog");
      expect(result.size).toBe(2);
    });

    it("bundlePackageForBrowser resolves subpath entry via exports map", () => {
      const c = setup();
      installBaseUiMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@base-ui/react/checkbox",
        new Set(["react"]),
      );
      expect(bundle.entryPath).toBe(
        "/node_modules/@base-ui/react/checkbox/dist/index.cjs",
      );

      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("Checkbox");
      expect(code).toContain("CheckboxRoot");
      expect(code).toContain("CheckboxIndicator");

      expect(
        bundle.modules.has("/node_modules/@base-ui/react/shared/utils.js"),
      ).toBe(true);
    });

    it("multiple subpath imports share internal modules without duplication in output", () => {
      const c = setup();
      installBaseUiMock(c.vfs);

      const checkboxBundle = bundlePackageForBrowser(
        c.vfs,
        "@base-ui/react/checkbox",
        new Set(["react"]),
      );
      const dialogBundle = bundlePackageForBrowser(
        c.vfs,
        "@base-ui/react/dialog",
        new Set(["react"]),
      );

      expect(
        checkboxBundle.modules.has(
          "/node_modules/@base-ui/react/shared/utils.js",
        ),
      ).toBe(true);
      expect(
        dialogBundle.modules.has(
          "/node_modules/@base-ui/react/shared/utils.js",
        ),
      ).toBe(true);

      const bundles = new Map([
        ["@base-ui/react/checkbox", checkboxBundle],
        ["@base-ui/react/dialog", dialogBundle],
      ]);
      const shim = generateRequireScript(bundles, { react: "React" });

      // shared/utils.js appears as a module path in the __m registry (once, deduplicated)
      // and once in each entry's require() call
      const moduleRegistrations =
        shim.match(/__m\[.*shared\/utils\.js.*\]/g) || [];
      expect(moduleRegistrations.length).toBe(1);
    });

    it("require shim maps full specifier to resolved entry path", () => {
      const c = setup();
      installBaseUiMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@base-ui/react/checkbox",
        new Set(["react"]),
      );
      const bundles = new Map([["@base-ui/react/checkbox", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain('"@base-ui/react/checkbox"');
      expect(shim).toContain(bundle.entryPath);
    });

    it("full pipeline: JSX component with subpath import (compound components)", async () => {
      const c = setup();
      installBaseUiMock(c.vfs);

      const jsx = `import { Checkbox } from '@base-ui/react/checkbox';

function MyForm() {
  const [checked, setChecked] = React.useState(false);
  return (
    <div>
      <Checkbox.Root checked={checked} onChange={() => setChecked(!checked)} />
      <Checkbox.Indicator>{checked ? '✓' : ''}</Checkbox.Indicator>
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/MyForm.jsx");
      expect(transpiled).toContain('window.require("@base-ui/react/checkbox")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("<Checkbox.Root");
      expect(transpiled).not.toContain("<div");

      const bareImports = scanBareImports([jsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      for (const specifier of [...bareImports]) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg) || cdnExternals.has(specifier)) {
          bareImports.delete(specifier);
        }
      }
      expect(bareImports.size).toBe(1);
      expect(bareImports.has("@base-ui/react/checkbox")).toBe(true);

      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("@base-ui/react/checkbox");
      expect(shim).toContain("Checkbox");
      expect(shim).toContain("CheckboxRoot");
      expect(shim).toContain("useId");
    });

    it("multiple subpath imports from same package in one component", async () => {
      const c = setup();
      installBaseUiMock(c.vfs);

      const jsx = `import { Checkbox } from '@base-ui/react/checkbox';
import { Dialog } from '@base-ui/react/dialog';

function App() {
  return (
    <div>
      <Checkbox.Root checked={true} />
      <Dialog.Root open={false}>Hello</Dialog.Root>
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/App.jsx");
      expect(transpiled).toContain('window.require("@base-ui/react/checkbox")');
      expect(transpiled).toContain('window.require("@base-ui/react/dialog")');

      const bareImports = scanBareImports([jsx]);
      expect(bareImports.has("@base-ui/react/checkbox")).toBe(true);
      expect(bareImports.has("@base-ui/react/dialog")).toBe(true);

      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg) || cdnExternals.has(specifier)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }
      expect(bundles.size).toBe(2);

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain('"@base-ui/react/checkbox"');
      expect(shim).toContain('"@base-ui/react/dialog"');
    });
  });

  describe("complex package structures (radix-ui pattern)", () => {
    function installRadixMock(vfs: MemFS) {
      vfs.mkdirSync("/node_modules/radix-ui/dist", { recursive: true });
      vfs.mkdirSync("/node_modules/@radix-ui/react-avatar/dist", {
        recursive: true,
      });
      vfs.mkdirSync("/node_modules/@radix-ui/react-slot/dist", {
        recursive: true,
      });

      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-slot/package.json",
        JSON.stringify({
          name: "@radix-ui/react-slot",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-slot/dist/index.js",
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n' +
          "var React = require('react');\n" +
          "exports.Slot = function Slot(props) { return React.createElement('span', null, props.children); };\n",
      );

      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-avatar/package.json",
        JSON.stringify({
          name: "@radix-ui/react-avatar",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-avatar/dist/index.js",
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n' +
          "var React = require('react');\n" +
          "var SlotMod = require('@radix-ui/react-slot');\n" +
          "exports.Root = function AvatarRoot(props) {\n" +
          "  return React.createElement('span', { className: props.className },\n" +
          "    React.createElement(SlotMod.Slot, null, props.children)\n" +
          "  );\n" +
          "};\n" +
          "exports.Image = function AvatarImage(props) {\n" +
          "  return React.createElement('img', { src: props.src, alt: props.alt });\n" +
          "};\n" +
          "exports.Fallback = function AvatarFallback(props) {\n" +
          "  return React.createElement('span', null, props.children);\n" +
          "};\n",
      );

      vfs.writeFileSync(
        "/node_modules/radix-ui/package.json",
        JSON.stringify({
          name: "radix-ui",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/radix-ui/dist/index.js",
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n' +
          "exports.Avatar = require('@radix-ui/react-avatar');\n",
      );
    }

    it("bundles a meta-package that re-exports from scoped sub-packages", () => {
      const c = setup();
      installRadixMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-ui",
        new Set(["react"]),
      );
      expect(bundle.entryPath).toBe("/node_modules/radix-ui/dist/index.js");

      expect(bundle.modules.has("/node_modules/radix-ui/dist/index.js")).toBe(
        true,
      );
      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/react-avatar/dist/index.js",
        ),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/@radix-ui/react-slot/dist/index.js"),
      ).toBe(true);

      const entryCode = bundle.modules.get(bundle.entryPath)!;
      expect(entryCode).toContain("Avatar");
      expect(entryCode).toContain("@radix-ui/react-avatar");
    });

    it("depMap tracks transitive bare specifier dependencies", () => {
      const c = setup();
      installRadixMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-ui",
        new Set(["react"]),
      );

      expect(bundle.depMap.get("@radix-ui/react-avatar")).toBe(
        "/node_modules/@radix-ui/react-avatar/dist/index.js",
      );
      expect(bundle.depMap.get("@radix-ui/react-slot")).toBe(
        "/node_modules/@radix-ui/react-slot/dist/index.js",
      );
    });

    it("generated require shim includes transitive deps in __pkg", () => {
      const c = setup();
      installRadixMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-ui",
        new Set(["react"]),
      );
      const bundles = new Map([["radix-ui", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain('"@radix-ui/react-avatar"');
      expect(shim).toContain('"@radix-ui/react-slot"');
    });

    it("full pipeline: JSX with radix-ui Avatar compound component", async () => {
      const c = setup();
      installRadixMock(c.vfs);

      const jsx = `import { Avatar } from "radix-ui";

function UserCard({ user }) {
  return (
    <div className="user-card">
      <Avatar.Root className="inline-flex size-[45px] select-none items-center justify-center overflow-hidden rounded-full bg-blackA1 align-middle">
        <Avatar.Image src={user.avatar} alt={user.name} />
        <Avatar.Fallback>{user.name[0]}</Avatar.Fallback>
      </Avatar.Root>
      <span>{user.name}</span>
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/UserCard.jsx");
      expect(transpiled).toContain('window.require("radix-ui")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("<Avatar.Root");
      expect(transpiled).not.toContain("<div");

      const bareImports = scanBareImports([jsx]);
      expect(bareImports.has("radix-ui")).toBe(true);

      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg) || cdnExternals.has(specifier)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }
      expect(bundles.size).toBe(1);

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("radix-ui");
      expect(shim).toContain("Avatar");
      expect(shim).toContain("@radix-ui/react-avatar");
      expect(shim).toContain("@radix-ui/react-slot");
      expect(shim).toContain("AvatarRoot");
    });
  });

  describe("ESM-to-CJS with JSX content from npm packages", () => {
    it("transforms an npm package that ships JSX source (not pre-compiled)", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/raw-jsx-pkg", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/raw-jsx-pkg/package.json",
        JSON.stringify({
          name: "raw-jsx-pkg",
          version: "1.0.0",
          main: "index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/raw-jsx-pkg/index.js",
        `import React from 'react';
export const Badge = ({ children, color }) => (
  <span style={{ backgroundColor: color, padding: '2px 8px', borderRadius: '4px' }}>
    {children}
  </span>
);
export const Tag = ({ label }) => <Badge color="#eee">{label}</Badge>;`,
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "raw-jsx-pkg",
        new Set(["react"]),
      );

      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("require");
      expect(code).toContain("__esModule");
      expect(code).toContain("Badge");
      expect(code).toContain("Tag");
      expect(code).not.toMatch(/^import\s/m);
      expect(code).not.toMatch(/^export\s/m);
    });

    it("bundles a package with JSX in internal sub-modules", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/jsx-deep/lib", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/jsx-deep/package.json",
        JSON.stringify({
          name: "jsx-deep",
          version: "1.0.0",
          main: "index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/jsx-deep/index.js",
        `export { Button } from './lib/button';
export { Card } from './lib/card';`,
      );
      c.vfs.writeFileSync(
        "/node_modules/jsx-deep/lib/button.js",
        `import React from 'react';
export const Button = ({ onClick, children }) => (
  <button className="btn" onClick={onClick}>{children}</button>
);`,
      );
      c.vfs.writeFileSync(
        "/node_modules/jsx-deep/lib/card.js",
        `import React from 'react';
export const Card = ({ title, children }) => (
  <div className="card">
    <h3>{title}</h3>
    <div>{children}</div>
  </div>
);`,
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "jsx-deep",
        new Set(["react"]),
      );

      expect(bundle.modules.size).toBe(3);
      expect(bundle.modules.has("/node_modules/jsx-deep/lib/button.js")).toBe(
        true,
      );
      expect(bundle.modules.has("/node_modules/jsx-deep/lib/card.js")).toBe(
        true,
      );

      for (const [, code] of bundle.modules) {
        expect(code).not.toMatch(/^import\s/m);
        expect(code).not.toMatch(/^export\s/m);
      }
    });
  });

  // ── process shim in require script ──────────────────────────────────

  describe("process shim in generated require script", () => {
    it("includes process.env.NODE_ENV in the IIFE scope", () => {
      const c = setup();

      installMockPackage(c.vfs, "simple-pkg", 'exports.hello = "world";');

      const bundle = bundlePackageForBrowser(c.vfs, "simple-pkg", new Set());
      const bundles = new Map([["simple-pkg", bundle]]);
      const shim = generateRequireScript(bundles, {});

      expect(shim).toContain("var process");
      expect(shim).toContain("NODE_ENV");
      expect(shim).toContain('"production"');
    });

    it("bundled module using process.env.NODE_ENV conditional does not throw", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/env-switch/cjs", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/env-switch/package.json",
        JSON.stringify({
          name: "env-switch",
          version: "1.0.0",
          main: "index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/env-switch/index.js",
        'if (process.env.NODE_ENV === "production") {\n' +
          '  module.exports = require("./cjs/prod.js");\n' +
          "} else {\n" +
          '  module.exports = require("./cjs/dev.js");\n' +
          "}\n",
      );
      c.vfs.writeFileSync(
        "/node_modules/env-switch/cjs/prod.js",
        'exports.mode = "production"; exports.value = 42;',
      );
      c.vfs.writeFileSync(
        "/node_modules/env-switch/cjs/dev.js",
        'exports.mode = "development"; exports.value = 0;',
      );

      const bundle = bundlePackageForBrowser(c.vfs, "env-switch", new Set());
      expect(bundle.modules.has("/node_modules/env-switch/index.js")).toBe(
        true,
      );
      expect(bundle.modules.has("/node_modules/env-switch/cjs/prod.js")).toBe(
        true,
      );
      expect(bundle.modules.has("/node_modules/env-switch/cjs/dev.js")).toBe(
        true,
      );

      const bundles = new Map([["env-switch", bundle]]);
      const shim = generateRequireScript(bundles, {});

      expect(shim).toContain("process.env.NODE_ENV");
      expect(shim).toContain("var process");
      expect(shim).not.toContain("process is not defined");
    });

    it("use-sync-external-store pattern: process.env.NODE_ENV selects prod build", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/use-sync-external-store/shim/cjs", {
        recursive: true,
      });
      c.vfs.writeFileSync(
        "/node_modules/use-sync-external-store/package.json",
        JSON.stringify({
          name: "use-sync-external-store",
          version: "1.2.0",
          main: "index.js",
          exports: {
            ".": { default: "./index.js" },
            "./shim": { default: "./shim/index.js" },
          },
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/use-sync-external-store/index.js",
        'exports.useSyncExternalStore = function() { return "main"; };',
      );
      c.vfs.writeFileSync(
        "/node_modules/use-sync-external-store/shim/index.js",
        '"use strict";\n' +
          'if (process.env.NODE_ENV === "production") {\n' +
          '  module.exports = require("./cjs/use-sync-external-store-shim.production.min.js");\n' +
          "} else {\n" +
          '  module.exports = require("./cjs/use-sync-external-store-shim.development.js");\n' +
          "}\n",
      );
      c.vfs.writeFileSync(
        "/node_modules/use-sync-external-store/shim/cjs/use-sync-external-store-shim.production.min.js",
        '"use strict";\n' +
          "var React = require('react');\n" +
          'exports.useSyncExternalStore = function(sub, getSnap) { return "prod-shim"; };\n',
      );
      c.vfs.writeFileSync(
        "/node_modules/use-sync-external-store/shim/cjs/use-sync-external-store-shim.development.js",
        '"use strict";\n' +
          "var React = require('react');\n" +
          'exports.useSyncExternalStore = function(sub, getSnap) { return "dev-shim"; };\n',
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "use-sync-external-store/shim",
        new Set(["react"]),
      );

      expect(
        bundle.modules.has(
          "/node_modules/use-sync-external-store/shim/index.js",
        ),
      ).toBe(true);

      const bundles = new Map([["use-sync-external-store/shim", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain("var process");
      expect(shim).toContain("process.env.NODE_ENV");
    });
  });

  // ── react/jsx-runtime shim in require script ───────────────────────

  describe("react/jsx-runtime shim in generated require script", () => {
    it("includes jsx-runtime shim when react is in globals", () => {
      const c = setup();

      installMockPackage(c.vfs, "simple-pkg", 'exports.hello = "world";');

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "simple-pkg",
        new Set(["react"]),
      );
      const bundles = new Map([["simple-pkg", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain("__jsx_runtime__");
      expect(shim).toContain("react/jsx-runtime");
      expect(shim).toContain("react/jsx-dev-runtime");
      expect(shim).toContain("exports.jsx");
      expect(shim).toContain("exports.jsxs");
      expect(shim).toContain("exports.Fragment");
    });

    it("does not include jsx-runtime shim when react is not in globals", () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "util-pkg",
        "exports.add = function(a, b) { return a + b; };",
      );

      const bundle = bundlePackageForBrowser(c.vfs, "util-pkg", new Set());
      const bundles = new Map([["util-pkg", bundle]]);
      const shim = generateRequireScript(bundles, {});

      expect(shim).not.toContain("__jsx_runtime__");
      expect(shim).not.toContain("react/jsx-runtime");
    });

    it("maps react/jsx-runtime to the shim module in __pkg", () => {
      const c = setup();

      installMockPackage(
        c.vfs,
        "my-comp",
        '"use strict";\nvar jsx = require("react/jsx-runtime");\n' +
          "exports.Comp = function() { return jsx.jsx('div', { children: 'hello' }); };\n",
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "my-comp",
        new Set(["react"]),
      );
      const bundles = new Map([["my-comp", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain('"react/jsx-runtime":"__jsx_runtime__"');
      expect(shim).toContain('"react/jsx-dev-runtime":"__jsx_runtime__"');
    });

    it("bundled package requiring react/jsx-runtime resolves through the shim", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/jsx-comp", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/jsx-comp/package.json",
        JSON.stringify({
          name: "jsx-comp",
          version: "1.0.0",
          main: "index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/jsx-comp/index.js",
        '"use strict";\n' +
          'var _jsxRuntime = require("react/jsx-runtime");\n' +
          "exports.Button = function Button(props) {\n" +
          '  return (0, _jsxRuntime.jsx)("button", { children: props.label });\n' +
          "};\n",
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "jsx-comp",
        new Set(["react"]),
      );
      const bundles = new Map([["jsx-comp", bundle]]);
      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      expect(shim).toContain("jsx-comp");
      expect(shim).toContain("__jsx_runtime__");
      expect(shim).toContain("React.createElement");
    });

    it("bundled package requiring react/jsx-dev-runtime also resolves", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/dev-comp", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/dev-comp/package.json",
        JSON.stringify({
          name: "dev-comp",
          version: "1.0.0",
          main: "index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/dev-comp/index.js",
        '"use strict";\n' +
          'var _jsxDev = require("react/jsx-dev-runtime");\n' +
          "exports.Badge = function Badge(props) {\n" +
          '  return (0, _jsxDev.jsxDEV)("span", { children: props.text });\n' +
          "};\n",
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "dev-comp",
        new Set(["react"]),
      );
      const bundles = new Map([["dev-comp", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain('"react/jsx-dev-runtime":"__jsx_runtime__"');
      expect(shim).toContain("exports.jsxDEV");
    });
  });

  // ── Realistic Radix UI with use-sync-external-store + jsx-runtime ──

  describe("realistic Radix UI with process shim and jsx-runtime", () => {
    function installRealisticRadixMock(vfs: MemFS) {
      // use-sync-external-store with process.env.NODE_ENV conditional
      vfs.mkdirSync("/node_modules/use-sync-external-store/shim/cjs", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/use-sync-external-store/package.json",
        JSON.stringify({
          name: "use-sync-external-store",
          version: "1.2.0",
          main: "index.js",
          exports: {
            ".": { default: "./index.js" },
            "./shim": { default: "./shim/index.js" },
          },
        }),
      );
      vfs.writeFileSync(
        "/node_modules/use-sync-external-store/index.js",
        'exports.useSyncExternalStore = function() { return "main"; };',
      );
      vfs.writeFileSync(
        "/node_modules/use-sync-external-store/shim/index.js",
        '"use strict";\n' +
          'if (process.env.NODE_ENV === "production") {\n' +
          '  module.exports = require("./cjs/use-sync-external-store-shim.production.min.js");\n' +
          "} else {\n" +
          '  module.exports = require("./cjs/use-sync-external-store-shim.development.js");\n' +
          "}\n",
      );
      vfs.writeFileSync(
        "/node_modules/use-sync-external-store/shim/cjs/use-sync-external-store-shim.production.min.js",
        '"use strict";\nvar React = require("react");\n' +
          "exports.useSyncExternalStore = function(sub, snap) { return snap(); };\n",
      );
      vfs.writeFileSync(
        "/node_modules/use-sync-external-store/shim/cjs/use-sync-external-store-shim.development.js",
        '"use strict";\nvar React = require("react");\n' +
          "exports.useSyncExternalStore = function(sub, snap) { return snap(); };\n",
      );

      // @radix-ui/react-use-callback-ref (uses jsx-runtime)
      vfs.mkdirSync("/node_modules/@radix-ui/react-use-callback-ref/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-use-callback-ref/package.json",
        JSON.stringify({
          name: "@radix-ui/react-use-callback-ref",
          version: "1.1.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-use-callback-ref/dist/index.js",
        '"use strict";\n' +
          "var React = require('react');\n" +
          "exports.useCallbackRef = function(cb) { var ref = React.useRef(cb); ref.current = cb; return ref; };\n",
      );

      // @radix-ui/react-avatar (uses jsx-runtime and use-sync-external-store)
      vfs.mkdirSync("/node_modules/@radix-ui/react-avatar/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-avatar/package.json",
        JSON.stringify({
          name: "@radix-ui/react-avatar",
          version: "1.1.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/react-avatar/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          'var _jsxRuntime = require("react/jsx-runtime");\n' +
          "var React = require('react');\n" +
          'var useSyncExternalStore = require("use-sync-external-store/shim");\n' +
          "exports.Root = function AvatarRoot(props) {\n" +
          '  return (0, _jsxRuntime.jsx)("span", { className: props.className, children: props.children });\n' +
          "};\n" +
          "exports.Image = function AvatarImage(props) {\n" +
          '  return (0, _jsxRuntime.jsx)("img", { src: props.src, alt: props.alt });\n' +
          "};\n" +
          "exports.Fallback = function AvatarFallback(props) {\n" +
          '  return (0, _jsxRuntime.jsx)("span", { children: props.children });\n' +
          "};\n",
      );

      // radix-ui meta-package
      vfs.mkdirSync("/node_modules/radix-ui/dist", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/radix-ui/package.json",
        JSON.stringify({
          name: "radix-ui",
          version: "1.1.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/radix-ui/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "exports.Avatar = require('@radix-ui/react-avatar');\n",
      );
    }

    it("bundles radix-ui with use-sync-external-store and jsx-runtime deps", () => {
      const c = setup();
      installRealisticRadixMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-ui",
        new Set(["react"]),
      );

      expect(bundle.modules.has("/node_modules/radix-ui/dist/index.js")).toBe(
        true,
      );
      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/react-avatar/dist/index.js",
        ),
      ).toBe(true);
      expect(
        bundle.modules.has(
          "/node_modules/use-sync-external-store/shim/index.js",
        ),
      ).toBe(true);

      const avatarCode = bundle.modules.get(
        "/node_modules/@radix-ui/react-avatar/dist/index.js",
      )!;
      expect(avatarCode).toContain("react/jsx-runtime");
      expect(avatarCode).toContain("use-sync-external-store/shim");
    });

    it("generated shim has both process and jsx-runtime polyfills", () => {
      const c = setup();
      installRealisticRadixMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-ui",
        new Set(["react"]),
      );
      const bundles = new Map([["radix-ui", bundle]]);
      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      expect(shim).toContain("var process");
      expect(shim).toContain('"production"');
      expect(shim).toContain("__jsx_runtime__");
      expect(shim).toContain("exports.jsx");
      expect(shim).toContain("React.createElement");
    });

    it("full pipeline: Avatar demo with jsx-runtime and process shim", async () => {
      const c = setup();
      installRealisticRadixMock(c.vfs);

      const jsx = `import { Avatar } from "radix-ui";

const AvatarDemo = () => (
  <div className="flex gap-5">
    <Avatar.Root className="inline-flex size-[45px]">
      <Avatar.Image
        className="size-full rounded-[inherit] object-cover"
        src="https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?&w=128&h=128&dpr=2&q=80"
        alt="Colm Tuite"
      />
      <Avatar.Fallback delayMs={600}>
        CT
      </Avatar.Fallback>
    </Avatar.Root>
    <Avatar.Root className="inline-flex size-[45px]">
      <Avatar.Fallback>PD</Avatar.Fallback>
    </Avatar.Root>
  </div>
);`;

      const transpiled = await transpileComponent(jsx, "/src/AvatarDemo.jsx");
      expect(transpiled).toContain('window.require("radix-ui")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("<Avatar.Root");
      expect(transpiled).not.toContain("<div");

      const bareImports = scanBareImports([jsx]);
      expect(bareImports.has("radix-ui")).toBe(true);

      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg) || cdnExternals.has(specifier)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }
      expect(bundles.size).toBe(1);

      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      expect(shim).toContain("radix-ui");
      expect(shim).toContain("Avatar");
      expect(shim).toContain("@radix-ui/react-avatar");
      expect(shim).toContain("use-sync-external-store");
      expect(shim).toContain("AvatarRoot");
      expect(shim).toContain("AvatarImage");
      expect(shim).toContain("AvatarFallback");

      expect(shim).toContain("var process");
      expect(shim).toContain("__jsx_runtime__");
      expect(shim).toContain("exports.jsx");
    });

    it("multiple libraries both using jsx-runtime share the same shim", () => {
      const c = setup();
      installRealisticRadixMock(c.vfs);

      c.vfs.mkdirSync("/node_modules/other-ui/dist", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/other-ui/package.json",
        JSON.stringify({
          name: "other-ui",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/other-ui/dist/index.js",
        '"use strict";\n' +
          'var _jsx = require("react/jsx-runtime");\n' +
          "exports.Card = function Card(props) {\n" +
          '  return (0, _jsx.jsx)("div", { className: "card", children: props.children });\n' +
          "};\n",
      );

      const radixBundle = bundlePackageForBrowser(
        c.vfs,
        "radix-ui",
        new Set(["react"]),
      );
      const otherBundle = bundlePackageForBrowser(
        c.vfs,
        "other-ui",
        new Set(["react"]),
      );
      const bundles = new Map([
        ["radix-ui", radixBundle],
        ["other-ui", otherBundle],
      ]);

      const shim = generateRequireScript(bundles, { react: "React" });

      const jsxRuntimeMatches = shim.match(/__jsx_runtime__/g);
      expect(jsxRuntimeMatches).toBeTruthy();

      expect(shim).toContain("radix-ui");
      expect(shim).toContain("other-ui");
      expect(shim).toContain("Card");
      expect(shim).toContain("AvatarRoot");
    });

    it("pipeline with compound component accessing sub-properties", async () => {
      const c = setup();
      installRealisticRadixMock(c.vfs);

      const jsx = `import { Avatar } from "radix-ui";

function UserCard({ user }) {
  return (
    <div className="user-card">
      <Avatar.Root>
        <Avatar.Image src={user.avatar} alt={user.name} />
        <Avatar.Fallback>{user.initials}</Avatar.Fallback>
      </Avatar.Root>
      <span>{user.name}</span>
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/UserCard.jsx");
      expect(transpiled).toContain('window.require("radix-ui")');

      const bareImports = scanBareImports([jsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      const shim = generateRequireScript(bundles, { react: "React" });
      const html = shim + "\n<script>\n" + transpiled + "\n</script>";

      expect(html).toContain("React.createElement");
      expect(html).toContain("var process");
      expect(html).toContain("__jsx_runtime__");
      expect(html).toContain("AvatarRoot");
      expect(html).toContain("AvatarImage");
      expect(html).toContain("AvatarFallback");
      expect(html).toContain("use-sync-external-store");
    });
  });

  // ── React hooks: custom and npm (react-use patterns) ───────────────

  describe("React hooks: custom hooks and react-use patterns", () => {
    function installReactUseMock(vfs: MemFS) {
      // Main react-use package re-exporting hooks
      vfs.mkdirSync("/node_modules/react-use/lib", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/react-use/package.json",
        JSON.stringify({
          name: "react-use",
          version: "17.5.0",
          main: "lib/index.js",
        }),
      );

      // useToggle
      vfs.writeFileSync(
        "/node_modules/react-use/lib/useToggle.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "var useToggle = function(initialValue) {\n" +
          "  if (initialValue === void 0) { initialValue = false; }\n" +
          "  var _a = React.useState(initialValue), value = _a[0], setValue = _a[1];\n" +
          "  var toggle = React.useCallback(function(next) {\n" +
          "    if (typeof next === 'boolean') { setValue(next); }\n" +
          "    else { setValue(function(prev) { return !prev; }); }\n" +
          "  }, []);\n" +
          "  return [value, toggle];\n" +
          "};\n" +
          "exports.default = useToggle;\n",
      );

      // useCounter
      vfs.writeFileSync(
        "/node_modules/react-use/lib/useCounter.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "var useCounter = function(initialValue, max, min) {\n" +
          "  if (initialValue === void 0) { initialValue = 0; }\n" +
          "  if (max === void 0) { max = null; }\n" +
          "  if (min === void 0) { min = null; }\n" +
          "  var _a = React.useState(initialValue), value = _a[0], setValue = _a[1];\n" +
          "  var inc = React.useCallback(function(delta) {\n" +
          "    if (delta === void 0) { delta = 1; }\n" +
          "    setValue(function(v) { return max !== null ? Math.min(v + delta, max) : v + delta; });\n" +
          "  }, [max]);\n" +
          "  var dec = React.useCallback(function(delta) {\n" +
          "    if (delta === void 0) { delta = 1; }\n" +
          "    setValue(function(v) { return min !== null ? Math.max(v - delta, min) : v - delta; });\n" +
          "  }, [min]);\n" +
          "  var reset = React.useCallback(function() { setValue(initialValue); }, [initialValue]);\n" +
          "  return [value, { inc: inc, dec: dec, set: setValue, reset: reset }];\n" +
          "};\n" +
          "exports.default = useCounter;\n",
      );

      // useDebounce
      vfs.writeFileSync(
        "/node_modules/react-use/lib/useDebounce.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "var useDebounce = function(fn, ms, deps) {\n" +
          "  if (ms === void 0) { ms = 0; }\n" +
          "  if (deps === void 0) { deps = []; }\n" +
          "  React.useEffect(function() {\n" +
          "    var timer = setTimeout(fn, ms);\n" +
          "    return function() { clearTimeout(timer); };\n" +
          "  }, deps.concat([ms]));\n" +
          "};\n" +
          "exports.default = useDebounce;\n",
      );

      // useLocalStorage (uses process.env.NODE_ENV for dev warnings)
      vfs.writeFileSync(
        "/node_modules/react-use/lib/useLocalStorage.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "var useLocalStorage = function(key, initialValue) {\n" +
          "  if (process.env.NODE_ENV !== 'production' && typeof key !== 'string') {\n" +
          "    console.warn('useLocalStorage: key must be a string');\n" +
          "  }\n" +
          "  var _a = React.useState(function() {\n" +
          "    try {\n" +
          "      var item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;\n" +
          "      return item ? JSON.parse(item) : initialValue;\n" +
          "    } catch (e) { return initialValue; }\n" +
          "  }), storedValue = _a[0], setStoredValue = _a[1];\n" +
          "  var setValue = React.useCallback(function(value) {\n" +
          "    setStoredValue(value);\n" +
          "    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}\n" +
          "  }, [key]);\n" +
          "  return [storedValue, setValue];\n" +
          "};\n" +
          "exports.default = useLocalStorage;\n",
      );

      // usePrevious
      vfs.writeFileSync(
        "/node_modules/react-use/lib/usePrevious.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "var usePrevious = function(value) {\n" +
          "  var ref = React.useRef();\n" +
          "  React.useEffect(function() { ref.current = value; });\n" +
          "  return ref.current;\n" +
          "};\n" +
          "exports.default = usePrevious;\n",
      );

      // useMount / useUnmount
      vfs.writeFileSync(
        "/node_modules/react-use/lib/useMount.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "var useMount = function(fn) { React.useEffect(function() { fn(); }, []); };\n" +
          "exports.default = useMount;\n",
      );

      // Main index re-exporting all hooks
      vfs.writeFileSync(
        "/node_modules/react-use/lib/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var useToggle = require('./useToggle');\n" +
          "var useCounter = require('./useCounter');\n" +
          "var useDebounce = require('./useDebounce');\n" +
          "var useLocalStorage = require('./useLocalStorage');\n" +
          "var usePrevious = require('./usePrevious');\n" +
          "var useMount = require('./useMount');\n" +
          "exports.useToggle = useToggle.default;\n" +
          "exports.useCounter = useCounter.default;\n" +
          "exports.useDebounce = useDebounce.default;\n" +
          "exports.useLocalStorage = useLocalStorage.default;\n" +
          "exports.usePrevious = usePrevious.default;\n" +
          "exports.useMount = useMount.default;\n",
      );
    }

    it("bundles react-use package with all hook sub-modules", () => {
      const c = setup();
      installReactUseMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "react-use",
        new Set(["react"]),
      );

      expect(bundle.entryPath).toBe("/node_modules/react-use/lib/index.js");
      expect(bundle.modules.size).toBe(7);
      expect(
        bundle.modules.has("/node_modules/react-use/lib/useToggle.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/react-use/lib/useCounter.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/react-use/lib/useDebounce.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/react-use/lib/useLocalStorage.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/react-use/lib/usePrevious.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/react-use/lib/useMount.js"),
      ).toBe(true);
    });

    it("useLocalStorage uses process.env.NODE_ENV and bundles without error", () => {
      const c = setup();
      installReactUseMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "react-use",
        new Set(["react"]),
      );
      const localStorageCode = bundle.modules.get(
        "/node_modules/react-use/lib/useLocalStorage.js",
      )!;

      expect(localStorageCode).toContain("process.env.NODE_ENV");

      const bundles = new Map([["react-use", bundle]]);
      const shim = generateRequireScript(bundles, { react: "React" });

      expect(shim).toContain("var process");
      expect(shim).toContain("useLocalStorage");
    });

    it("full pipeline: component using useToggle from react-use", async () => {
      const c = setup();
      installReactUseMock(c.vfs);

      const jsx = `import { useToggle } from 'react-use';

function DarkModeToggle() {
  const [isDark, toggleDark] = useToggle(false);

  return (
    <div className={isDark ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}>
      <h1>{isDark ? 'Dark Mode' : 'Light Mode'}</h1>
      <button onClick={toggleDark}>Toggle Theme</button>
    </div>
  );
}`;

      const transpiled = await transpileComponent(
        jsx,
        "/src/DarkModeToggle.jsx",
      );
      expect(transpiled).toContain('window.require("react-use")');
      expect(transpiled).toContain("React.createElement");
      expect(transpiled).not.toContain("<div");
      expect(transpiled).not.toContain("<button");

      const bareImports = scanBareImports([jsx]);
      expect(bareImports.has("react-use")).toBe(true);

      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      const shim = generateRequireScript(bundles, { react: "React" });
      const html = shim + "\n<script>\n" + transpiled + "\n</script>";

      expect(html).toContain("useToggle");
      expect(html).toContain("React.createElement");
      expect(html).toContain("var process");
    });

    it("full pipeline: component using useCounter with min/max bounds", async () => {
      const c = setup();
      installReactUseMock(c.vfs);

      const jsx = `import { useCounter } from 'react-use';

function QuantitySelector() {
  const [count, { inc, dec, reset }] = useCounter(1, 10, 0);

  return (
    <div className="flex items-center gap-4">
      <button onClick={() => dec()} disabled={count <= 0}>-</button>
      <span className="text-lg font-bold">{count}</span>
      <button onClick={() => inc()} disabled={count >= 10}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}`;

      const transpiled = await transpileComponent(
        jsx,
        "/src/QuantitySelector.jsx",
      );
      expect(transpiled).toContain('window.require("react-use")');
      expect(transpiled).toContain("React.createElement");

      const bareImports = scanBareImports([jsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("useCounter");
      expect(shim).toContain("inc");
      expect(shim).toContain("dec");
      expect(shim).toContain("reset");
    });

    it("full pipeline: component combining multiple react-use hooks", async () => {
      const c = setup();
      installReactUseMock(c.vfs);

      const jsx = `import { useToggle, useCounter, usePrevious, useMount } from 'react-use';

function Dashboard() {
  const [isOpen, toggleOpen] = useToggle(false);
  const [visits, { inc: incVisits }] = useCounter(0);
  const prevVisits = usePrevious(visits);

  useMount(() => {
    incVisits();
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Visits: {visits} (was: {prevVisits})</p>
      <button onClick={() => incVisits()}>Add Visit</button>
      <button onClick={toggleOpen}>
        {isOpen ? 'Close Panel' : 'Open Panel'}
      </button>
      {isOpen && <div className="panel">Panel content</div>}
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/Dashboard.jsx");
      expect(transpiled).toContain('window.require("react-use")');

      const bareImports = scanBareImports([jsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      const shim = generateRequireScript(bundles, { react: "React" });
      const html = shim + "\n<script>\n" + transpiled + "\n</script>";

      expect(html).toContain("useToggle");
      expect(html).toContain("useCounter");
      expect(html).toContain("usePrevious");
      expect(html).toContain("useMount");
      expect(html).toContain("var process");
    });

    it("custom hook with internal state bundles alongside react-use hooks", async () => {
      const c = setup();
      installReactUseMock(c.vfs);

      // A custom hook package that uses React internals
      c.vfs.mkdirSync("/node_modules/use-form-state", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/use-form-state/package.json",
        JSON.stringify({
          name: "use-form-state",
          version: "1.0.0",
          main: "index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/use-form-state/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var React = require('react');\n" +
          "exports.useFormState = function(initialValues) {\n" +
          "  var _a = React.useState(initialValues), values = _a[0], setValues = _a[1];\n" +
          "  var _b = React.useState({}), errors = _b[0], setErrors = _b[1];\n" +
          "  var _c = React.useState(false), isSubmitting = _c[0], setIsSubmitting = _c[1];\n" +
          "  var handleChange = React.useCallback(function(field, value) {\n" +
          "    setValues(function(prev) { var next = Object.assign({}, prev); next[field] = value; return next; });\n" +
          "  }, []);\n" +
          "  var handleSubmit = React.useCallback(function(onSubmit) {\n" +
          "    setIsSubmitting(true);\n" +
          "    try { onSubmit(values); } finally { setIsSubmitting(false); }\n" +
          "  }, [values]);\n" +
          "  return { values: values, errors: errors, isSubmitting: isSubmitting, handleChange: handleChange, handleSubmit: handleSubmit };\n" +
          "};\n",
      );

      const jsx = `import { useToggle } from 'react-use';
import { useFormState } from 'use-form-state';

function ContactForm() {
  const [submitted, toggleSubmitted] = useToggle(false);
  const { values, handleChange, handleSubmit, isSubmitting } = useFormState({
    name: '',
    email: '',
    message: '',
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(() => toggleSubmitted(true)); }}>
      <input value={values.name} onChange={(e) => handleChange('name', e.target.value)} />
      <input value={values.email} onChange={(e) => handleChange('email', e.target.value)} />
      <textarea value={values.message} onChange={(e) => handleChange('message', e.target.value)} />
      <button type="submit" disabled={isSubmitting}>
        {submitted ? 'Sent!' : 'Send'}
      </button>
    </form>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/ContactForm.jsx");
      expect(transpiled).toContain('window.require("react-use")');
      expect(transpiled).toContain('window.require("use-form-state")');

      const bareImports = scanBareImports([jsx]);
      expect(bareImports.has("react-use")).toBe(true);
      expect(bareImports.has("use-form-state")).toBe(true);

      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      expect(bundles.size).toBe(2);

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("useToggle");
      expect(shim).toContain("useFormState");
      expect(shim).toContain("handleChange");
    });

    it("hook package using jsx-runtime internally for error boundaries", async () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/use-error-boundary/dist", {
        recursive: true,
      });
      c.vfs.writeFileSync(
        "/node_modules/use-error-boundary/package.json",
        JSON.stringify({
          name: "use-error-boundary",
          version: "2.0.0",
          main: "dist/index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/use-error-boundary/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          'var _jsxRuntime = require("react/jsx-runtime");\n' +
          "var React = require('react');\n" +
          "exports.ErrorBoundary = function ErrorBoundary(props) {\n" +
          '  return (0, _jsxRuntime.jsx)("div", { className: "error-boundary", children: props.children });\n' +
          "};\n" +
          "exports.useErrorBoundary = function() {\n" +
          "  var _a = React.useState(null), error = _a[0], setError = _a[1];\n" +
          "  return { error: error, resetError: function() { setError(null); } };\n" +
          "};\n",
      );

      const jsx = `import { ErrorBoundary, useErrorBoundary } from 'use-error-boundary';

function SafeApp() {
  const { error, resetError } = useErrorBoundary();

  if (error) {
    return (
      <div>
        <p>Something went wrong</p>
        <button onClick={resetError}>Try again</button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>App content</div>
    </ErrorBoundary>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/SafeApp.jsx");
      expect(transpiled).toContain('window.require("use-error-boundary")');

      const bareImports = scanBareImports([jsx]);
      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      const shim = generateRequireScript(bundles, { react: "React" });
      expect(shim).toContain("ErrorBoundary");
      expect(shim).toContain("useErrorBoundary");
      expect(shim).toContain("__jsx_runtime__");
    });

    it("react-use + radix-ui together in one component", async () => {
      const c = setup();
      installReactUseMock(c.vfs);

      // Install a simplified radix avatar mock
      c.vfs.mkdirSync("/node_modules/radix-ui/dist", { recursive: true });
      c.vfs.mkdirSync("/node_modules/@radix-ui/react-avatar/dist", {
        recursive: true,
      });
      c.vfs.writeFileSync(
        "/node_modules/@radix-ui/react-avatar/package.json",
        JSON.stringify({
          name: "@radix-ui/react-avatar",
          version: "1.1.0",
          main: "dist/index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/@radix-ui/react-avatar/dist/index.js",
        '"use strict";\n' +
          "var React = require('react');\n" +
          "exports.Root = function(props) { return React.createElement('span', props); };\n" +
          "exports.Image = function(props) { return React.createElement('img', props); };\n" +
          "exports.Fallback = function(props) { return React.createElement('span', null, props.children); };\n",
      );
      c.vfs.writeFileSync(
        "/node_modules/radix-ui/package.json",
        JSON.stringify({
          name: "radix-ui",
          version: "1.1.0",
          main: "dist/index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/radix-ui/dist/index.js",
        '"use strict";\nexports.Avatar = require("@radix-ui/react-avatar");\n',
      );

      const jsx = `import { useToggle, useCounter } from 'react-use';
import { Avatar } from 'radix-ui';

function UserProfile() {
  const [showAvatar, toggleAvatar] = useToggle(true);
  const [likes, { inc }] = useCounter(0);

  return (
    <div>
      <button onClick={toggleAvatar}>
        {showAvatar ? 'Hide' : 'Show'} Avatar
      </button>
      {showAvatar && (
        <Avatar.Root>
          <Avatar.Image src="/user.jpg" alt="User" />
          <Avatar.Fallback>U</Avatar.Fallback>
        </Avatar.Root>
      )}
      <button onClick={() => inc()}>Like ({likes})</button>
    </div>
  );
}`;

      const transpiled = await transpileComponent(jsx, "/src/UserProfile.jsx");
      expect(transpiled).toContain('window.require("react-use")');
      expect(transpiled).toContain('window.require("radix-ui")');

      const bareImports = scanBareImports([jsx]);
      expect(bareImports.has("react-use")).toBe(true);
      expect(bareImports.has("radix-ui")).toBe(true);

      const cdnExternals = new Set(["react", "react-dom"]);
      const bundles = new Map<
        string,
        ReturnType<typeof bundlePackageForBrowser>
      >();
      for (const specifier of bareImports) {
        const pkg = extractPackageName(specifier);
        if (cdnExternals.has(pkg)) continue;
        bundles.set(
          specifier,
          bundlePackageForBrowser(c.vfs, specifier, cdnExternals),
        );
      }

      expect(bundles.size).toBe(2);

      const shim = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });
      expect(shim).toContain("useToggle");
      expect(shim).toContain("useCounter");
      expect(shim).toContain("Avatar");
      expect(shim).toContain("@radix-ui/react-avatar");
    });
  });

  // ── Vue with Radix Vue patterns ────────────────────────────────────

  describe("Vue with Radix Vue component patterns", () => {
    function installRadixVueMock(vfs: MemFS) {
      // @radix-ui/vue-primitive (shared primitive component)
      vfs.mkdirSync("/node_modules/@radix-ui/vue-primitive/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-primitive/package.json",
        JSON.stringify({
          name: "@radix-ui/vue-primitive",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-primitive/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "exports.Primitive = {\n" +
          "  name: 'Primitive',\n" +
          "  props: { as: { type: String, default: 'div' } },\n" +
          "  render: function() {\n" +
          "    return { type: this.as, props: this.$attrs, children: this.$slots.default && this.$slots.default() };\n" +
          "  }\n" +
          "};\n",
      );

      // @radix-ui/vue-use-id (composable, uses process.env.NODE_ENV)
      vfs.mkdirSync("/node_modules/@radix-ui/vue-use-id/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-use-id/package.json",
        JSON.stringify({
          name: "@radix-ui/vue-use-id",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-use-id/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var idCounter = 0;\n" +
          "exports.useId = function(prefix) {\n" +
          "  if (process.env.NODE_ENV !== 'production' && typeof prefix !== 'string') {\n" +
          "    console.warn('[radix-vue] useId prefix should be a string');\n" +
          "  }\n" +
          "  idCounter++;\n" +
          "  return (prefix || 'radix') + '-' + idCounter;\n" +
          "};\n",
      );

      // @radix-ui/vue-avatar (compound component)
      vfs.mkdirSync("/node_modules/@radix-ui/vue-avatar/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-avatar/package.json",
        JSON.stringify({
          name: "@radix-ui/vue-avatar",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-avatar/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var primitive = require('@radix-ui/vue-primitive');\n" +
          "var useId = require('@radix-ui/vue-use-id');\n" +
          "exports.AvatarRoot = {\n" +
          "  name: 'AvatarRoot',\n" +
          "  setup: function() {\n" +
          "    var id = useId.useId('avatar');\n" +
          "    return { id: id };\n" +
          "  },\n" +
          "  template: '<span :id=\"id\"><slot /></span>'\n" +
          "};\n" +
          "exports.AvatarImage = {\n" +
          "  name: 'AvatarImage',\n" +
          "  props: ['src', 'alt'],\n" +
          '  template: \'<img :src="src" :alt="alt" />\'\n' +
          "};\n" +
          "exports.AvatarFallback = {\n" +
          "  name: 'AvatarFallback',\n" +
          "  props: { delayMs: { type: Number, default: 0 } },\n" +
          "  template: '<span><slot /></span>'\n" +
          "};\n",
      );

      // @radix-ui/vue-accordion (complex compound component)
      vfs.mkdirSync("/node_modules/@radix-ui/vue-accordion/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-accordion/package.json",
        JSON.stringify({
          name: "@radix-ui/vue-accordion",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-accordion/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var primitive = require('@radix-ui/vue-primitive');\n" +
          "var useId = require('@radix-ui/vue-use-id');\n" +
          "exports.AccordionRoot = {\n" +
          "  name: 'AccordionRoot',\n" +
          "  props: { type: { type: String, default: 'single' }, collapsible: Boolean },\n" +
          "  setup: function() { return { id: useId.useId('accordion') }; },\n" +
          '  template: \'<div role="region" :id="id"><slot /></div>\'\n' +
          "};\n" +
          "exports.AccordionItem = {\n" +
          "  name: 'AccordionItem',\n" +
          "  props: ['value'],\n" +
          "  template: '<div :data-value=\"value\"><slot /></div>'\n" +
          "};\n" +
          "exports.AccordionTrigger = {\n" +
          "  name: 'AccordionTrigger',\n" +
          "  template: '<button type=\"button\"><slot /></button>'\n" +
          "};\n" +
          "exports.AccordionContent = {\n" +
          "  name: 'AccordionContent',\n" +
          "  template: '<div role=\"region\"><slot /></div>'\n" +
          "};\n",
      );

      // @radix-ui/vue-dialog
      vfs.mkdirSync("/node_modules/@radix-ui/vue-dialog/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-dialog/package.json",
        JSON.stringify({
          name: "@radix-ui/vue-dialog",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-dialog/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var primitive = require('@radix-ui/vue-primitive');\n" +
          "exports.DialogRoot = {\n" +
          "  name: 'DialogRoot',\n" +
          "  props: { open: Boolean },\n" +
          "  emits: ['update:open'],\n" +
          "  template: '<slot />'\n" +
          "};\n" +
          "exports.DialogTrigger = {\n" +
          "  name: 'DialogTrigger',\n" +
          "  template: '<button type=\"button\"><slot /></button>'\n" +
          "};\n" +
          "exports.DialogContent = {\n" +
          "  name: 'DialogContent',\n" +
          "  props: { forceMount: Boolean },\n" +
          '  template: \'<div role="dialog" aria-modal="true"><slot /></div>\'\n' +
          "};\n" +
          "exports.DialogOverlay = {\n" +
          "  name: 'DialogOverlay',\n" +
          "  template: '<div class=\"overlay\"></div>'\n" +
          "};\n" +
          "exports.DialogClose = {\n" +
          "  name: 'DialogClose',\n" +
          '  template: \'<button type="button" aria-label="Close"><slot /></button>\'\n' +
          "};\n" +
          "exports.DialogTitle = {\n" +
          "  name: 'DialogTitle',\n" +
          "  template: '<h2><slot /></h2>'\n" +
          "};\n" +
          "exports.DialogDescription = {\n" +
          "  name: 'DialogDescription',\n" +
          "  template: '<p><slot /></p>'\n" +
          "};\n",
      );

      // @radix-ui/vue-tabs
      vfs.mkdirSync("/node_modules/@radix-ui/vue-tabs/dist", {
        recursive: true,
      });
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-tabs/package.json",
        JSON.stringify({
          name: "@radix-ui/vue-tabs",
          version: "1.0.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/@radix-ui/vue-tabs/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var useId = require('@radix-ui/vue-use-id');\n" +
          "exports.TabsRoot = {\n" +
          "  name: 'TabsRoot',\n" +
          "  props: { defaultValue: String, orientation: { type: String, default: 'horizontal' } },\n" +
          "  setup: function() { return { id: useId.useId('tabs') }; },\n" +
          '  template: \'<div :id="id" role="tablist"><slot /></div>\'\n' +
          "};\n" +
          "exports.TabsList = {\n" +
          "  name: 'TabsList',\n" +
          "  template: '<div role=\"tablist\"><slot /></div>'\n" +
          "};\n" +
          "exports.TabsTrigger = {\n" +
          "  name: 'TabsTrigger',\n" +
          "  props: ['value'],\n" +
          '  template: \'<button role="tab" :data-value="value"><slot /></button>\'\n' +
          "};\n" +
          "exports.TabsContent = {\n" +
          "  name: 'TabsContent',\n" +
          "  props: ['value'],\n" +
          '  template: \'<div role="tabpanel" :data-value="value"><slot /></div>\'\n' +
          "};\n",
      );

      // radix-vue meta-package
      vfs.mkdirSync("/node_modules/radix-vue/dist", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/radix-vue/package.json",
        JSON.stringify({
          name: "radix-vue",
          version: "1.9.0",
          main: "dist/index.js",
        }),
      );
      vfs.writeFileSync(
        "/node_modules/radix-vue/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "var avatar = require('@radix-ui/vue-avatar');\n" +
          "var accordion = require('@radix-ui/vue-accordion');\n" +
          "var dialog = require('@radix-ui/vue-dialog');\n" +
          "var tabs = require('@radix-ui/vue-tabs');\n" +
          "exports.AvatarRoot = avatar.AvatarRoot;\n" +
          "exports.AvatarImage = avatar.AvatarImage;\n" +
          "exports.AvatarFallback = avatar.AvatarFallback;\n" +
          "exports.AccordionRoot = accordion.AccordionRoot;\n" +
          "exports.AccordionItem = accordion.AccordionItem;\n" +
          "exports.AccordionTrigger = accordion.AccordionTrigger;\n" +
          "exports.AccordionContent = accordion.AccordionContent;\n" +
          "exports.DialogRoot = dialog.DialogRoot;\n" +
          "exports.DialogTrigger = dialog.DialogTrigger;\n" +
          "exports.DialogContent = dialog.DialogContent;\n" +
          "exports.DialogOverlay = dialog.DialogOverlay;\n" +
          "exports.DialogClose = dialog.DialogClose;\n" +
          "exports.DialogTitle = dialog.DialogTitle;\n" +
          "exports.DialogDescription = dialog.DialogDescription;\n" +
          "exports.TabsRoot = tabs.TabsRoot;\n" +
          "exports.TabsList = tabs.TabsList;\n" +
          "exports.TabsTrigger = tabs.TabsTrigger;\n" +
          "exports.TabsContent = tabs.TabsContent;\n",
      );
    }

    it("bundles radix-vue meta-package with all sub-packages", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-vue",
        new Set(["vue"]),
      );

      expect(bundle.entryPath).toBe("/node_modules/radix-vue/dist/index.js");
      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-avatar/dist/index.js"),
      ).toBe(true);
      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/vue-accordion/dist/index.js",
        ),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-dialog/dist/index.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-tabs/dist/index.js"),
      ).toBe(true);
      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/vue-primitive/dist/index.js",
        ),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-use-id/dist/index.js"),
      ).toBe(true);
    });

    it("vue-use-id with process.env.NODE_ENV bundles correctly with process shim", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-use-id",
        new Set(["vue"]),
      );
      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("process.env.NODE_ENV");

      const bundles = new Map([["@radix-ui/vue-use-id", bundle]]);
      const shim = generateRequireScript(bundles, { vue: "Vue" });

      expect(shim).toContain("var process");
      expect(shim).toContain("useId");
    });

    it("depMap tracks all transitive Vue sub-package dependencies", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-vue",
        new Set(["vue"]),
      );

      expect(bundle.depMap.get("@radix-ui/vue-avatar")).toBe(
        "/node_modules/@radix-ui/vue-avatar/dist/index.js",
      );
      expect(bundle.depMap.get("@radix-ui/vue-accordion")).toBe(
        "/node_modules/@radix-ui/vue-accordion/dist/index.js",
      );
      expect(bundle.depMap.get("@radix-ui/vue-dialog")).toBe(
        "/node_modules/@radix-ui/vue-dialog/dist/index.js",
      );
      expect(bundle.depMap.get("@radix-ui/vue-tabs")).toBe(
        "/node_modules/@radix-ui/vue-tabs/dist/index.js",
      );
      expect(bundle.depMap.get("@radix-ui/vue-primitive")).toBe(
        "/node_modules/@radix-ui/vue-primitive/dist/index.js",
      );
      expect(bundle.depMap.get("@radix-ui/vue-use-id")).toBe(
        "/node_modules/@radix-ui/vue-use-id/dist/index.js",
      );
    });

    it("generated require shim for Vue includes all components", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "radix-vue",
        new Set(["vue"]),
      );
      const bundles = new Map([["radix-vue", bundle]]);
      const shim = generateRequireScript(bundles, { vue: "Vue" });

      expect(shim).toContain("AvatarRoot");
      expect(shim).toContain("AvatarImage");
      expect(shim).toContain("AvatarFallback");
      expect(shim).toContain("AccordionRoot");
      expect(shim).toContain("AccordionItem");
      expect(shim).toContain("AccordionTrigger");
      expect(shim).toContain("AccordionContent");
      expect(shim).toContain("DialogRoot");
      expect(shim).toContain("DialogTrigger");
      expect(shim).toContain("DialogContent");
      expect(shim).toContain("TabsRoot");
      expect(shim).toContain("TabsList");
      expect(shim).toContain("TabsTrigger");
      expect(shim).toContain("TabsContent");

      expect(shim).toContain("var process");
    });

    it("bundles individual radix-vue component: @radix-ui/vue-accordion", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-accordion",
        new Set(["vue"]),
      );

      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/vue-accordion/dist/index.js",
        ),
      ).toBe(true);
      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/vue-primitive/dist/index.js",
        ),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-use-id/dist/index.js"),
      ).toBe(true);

      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("AccordionRoot");
      expect(code).toContain("AccordionItem");
      expect(code).toContain("AccordionTrigger");
      expect(code).toContain("AccordionContent");
    });

    it("bundles individual radix-vue component: @radix-ui/vue-dialog", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-dialog",
        new Set(["vue"]),
      );

      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-dialog/dist/index.js"),
      ).toBe(true);
      expect(
        bundle.modules.has(
          "/node_modules/@radix-ui/vue-primitive/dist/index.js",
        ),
      ).toBe(true);

      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("DialogRoot");
      expect(code).toContain("DialogTrigger");
      expect(code).toContain("DialogContent");
      expect(code).toContain("DialogOverlay");
      expect(code).toContain("DialogClose");
      expect(code).toContain("DialogTitle");
      expect(code).toContain("DialogDescription");
    });

    it("bundles individual radix-vue component: @radix-ui/vue-tabs", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-tabs",
        new Set(["vue"]),
      );

      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-tabs/dist/index.js"),
      ).toBe(true);
      expect(
        bundle.modules.has("/node_modules/@radix-ui/vue-use-id/dist/index.js"),
      ).toBe(true);

      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("TabsRoot");
      expect(code).toContain("TabsList");
      expect(code).toContain("TabsTrigger");
      expect(code).toContain("TabsContent");
    });

    it("multiple radix-vue components bundled together deduplicate shared deps", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      const avatarBundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-avatar",
        new Set(["vue"]),
      );
      const accordionBundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-accordion",
        new Set(["vue"]),
      );
      const dialogBundle = bundlePackageForBrowser(
        c.vfs,
        "@radix-ui/vue-dialog",
        new Set(["vue"]),
      );

      const bundles = new Map([
        ["@radix-ui/vue-avatar", avatarBundle],
        ["@radix-ui/vue-accordion", accordionBundle],
        ["@radix-ui/vue-dialog", dialogBundle],
      ]);

      const shim = generateRequireScript(bundles, { vue: "Vue" });

      expect(shim).toContain("AvatarRoot");
      expect(shim).toContain("AccordionRoot");
      expect(shim).toContain("DialogRoot");

      const primitiveMatches = shim.match(/Primitive/g);
      expect(primitiveMatches).toBeTruthy();

      expect(shim).toContain("var process");
    });

    it("Vue composable package with provide/inject pattern", () => {
      const c = setup();

      c.vfs.mkdirSync("/node_modules/@vueuse/core/dist", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/@vueuse/core/package.json",
        JSON.stringify({
          name: "@vueuse/core",
          version: "10.0.0",
          main: "dist/index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/@vueuse/core/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "exports.useToggle = function(initialValue) {\n" +
          "  if (initialValue === void 0) { initialValue = false; }\n" +
          "  var value = { value: initialValue };\n" +
          "  var toggle = function(next) {\n" +
          "    value.value = typeof next === 'boolean' ? next : !value.value;\n" +
          "  };\n" +
          "  return [value, toggle];\n" +
          "};\n" +
          "exports.useDark = function() {\n" +
          "  var isDark = { value: false };\n" +
          "  if (typeof window !== 'undefined') {\n" +
          "    isDark.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;\n" +
          "  }\n" +
          "  return isDark;\n" +
          "};\n" +
          "exports.useLocalStorage = function(key, defaultValue) {\n" +
          "  if (process.env.NODE_ENV !== 'production') {\n" +
          "    if (typeof key !== 'string') console.warn('[vueuse] key must be a string');\n" +
          "  }\n" +
          "  var data = { value: defaultValue };\n" +
          "  try {\n" +
          "    var stored = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;\n" +
          "    if (stored) data.value = JSON.parse(stored);\n" +
          "  } catch (e) {}\n" +
          "  return data;\n" +
          "};\n" +
          "exports.useColorMode = function() {\n" +
          "  return { value: 'light' };\n" +
          "};\n",
      );

      const bundle = bundlePackageForBrowser(
        c.vfs,
        "@vueuse/core",
        new Set(["vue"]),
      );

      expect(bundle.entryPath).toBe("/node_modules/@vueuse/core/dist/index.js");
      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("useToggle");
      expect(code).toContain("useDark");
      expect(code).toContain("useLocalStorage");
      expect(code).toContain("useColorMode");
      expect(code).toContain("process.env.NODE_ENV");

      const bundles = new Map([["@vueuse/core", bundle]]);
      const shim = generateRequireScript(bundles, { vue: "Vue" });

      expect(shim).toContain("var process");
      expect(shim).toContain("useToggle");
      expect(shim).toContain("useDark");
    });

    it("radix-vue + @vueuse/core bundled together for a complete app", () => {
      const c = setup();
      installRadixVueMock(c.vfs);

      c.vfs.mkdirSync("/node_modules/@vueuse/core/dist", { recursive: true });
      c.vfs.writeFileSync(
        "/node_modules/@vueuse/core/package.json",
        JSON.stringify({
          name: "@vueuse/core",
          version: "10.0.0",
          main: "dist/index.js",
        }),
      );
      c.vfs.writeFileSync(
        "/node_modules/@vueuse/core/dist/index.js",
        '"use strict";\n' +
          "Object.defineProperty(exports, '__esModule', { value: true });\n" +
          "exports.useDark = function() { return { value: false }; };\n" +
          "exports.useToggle = function(v) { return [{ value: v || false }, function() {}]; };\n",
      );

      const radixBundle = bundlePackageForBrowser(
        c.vfs,
        "radix-vue",
        new Set(["vue"]),
      );
      const vueuseBundle = bundlePackageForBrowser(
        c.vfs,
        "@vueuse/core",
        new Set(["vue"]),
      );

      const bundles = new Map([
        ["radix-vue", radixBundle],
        ["@vueuse/core", vueuseBundle],
      ]);

      const shim = generateRequireScript(bundles, { vue: "Vue" });

      expect(shim).toContain("AvatarRoot");
      expect(shim).toContain("AccordionRoot");
      expect(shim).toContain("DialogRoot");
      expect(shim).toContain("TabsRoot");
      expect(shim).toContain("useDark");
      expect(shim).toContain("useToggle");

      expect(shim).toContain("var process");
      expect(shim).toContain("window.require");
    });
  });
});
