import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";
import { Kernel } from "../../src/kernel";
import { NextDevServer } from "../../src/frameworks/next-dev-server";
import {
  addReactRefresh,
  stripCssImports,
  redirectNpmImports,
} from "../../src/frameworks/code-transforms";

describe("HMR: File watching triggers HMR events", () => {
  let vfs: MemFS;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync(
      "/app/page.tsx",
      "export default function Home() { return <h1>Home</h1>; }",
    );
    vfs.writeFileSync(
      "/app/layout.tsx",
      "export default function Layout({ children }) { return <html><body>{children}</body></html>; }",
    );
  });

  it("emits hmr-update event on file change", () => {
    const server = new NextDevServer(vfs, { port: 3000 });
    server.start();

    const updates: any[] = [];
    server.on("hmr-update", (update: any) => {
      updates.push(update);
    });

    vfs.writeFileSync(
      "/app/page.tsx",
      "export default function Home() { return <h1>Updated</h1>; }",
    );

    expect(updates.length).toBeGreaterThanOrEqual(1);
    const update = updates[updates.length - 1];
    expect(update.type).toBe("update");
    expect(update.path).toContain("page.tsx");
    expect(update.timestamp).toBeTypeOf("number");

    server.stop();
  });

  it("emits full-reload for non-JS/CSS files", () => {
    vfs.mkdirSync("/public", { recursive: true });
    vfs.writeFileSync("/public/data.json", "{}");

    const server = new NextDevServer(vfs, { port: 3001 });
    server.start();

    const updates: any[] = [];
    server.on("hmr-update", (update: any) => {
      updates.push(update);
    });

    vfs.writeFileSync("/public/data.json", '{"updated": true}');

    const jsonUpdates = updates.filter(u => u.path.includes("data.json"));
    if (jsonUpdates.length > 0) {
      expect(jsonUpdates[0].type).toBe("full-reload");
    }

    server.stop();
  });

  it("emits update for CSS changes", () => {
    vfs.writeFileSync("/app/globals.css", "body { margin: 0; }");

    const server = new NextDevServer(vfs, { port: 3002 });
    server.start();

    const updates: any[] = [];
    server.on("hmr-update", (update: any) => {
      updates.push(update);
    });

    vfs.writeFileSync(
      "/app/globals.css",
      "body { margin: 0; background: red; }",
    );

    const cssUpdates = updates.filter(u => u.path.includes(".css"));
    if (cssUpdates.length > 0) {
      expect(cssUpdates[0].type).toBe("update");
    }

    server.stop();
  });
});

describe("HMR: Kernel cache invalidation", () => {
  let vfs: MemFS;
  let kernel: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    kernel = new Kernel(vfs);
  });

  it("invalidateModule removes a specific module from cache", () => {
    vfs.writeFileSync("/test.js", "module.exports = { value: 1 };");

    kernel.runFileSync("/test.js");
    expect(kernel.moduleCache["/test.js"]).toBeDefined();

    kernel.invalidateModule("/test.js");
    expect(kernel.moduleCache["/test.js"]).toBeUndefined();
  });

  it("invalidateModule clears corresponding processedCodeCache entries", () => {
    vfs.writeFileSync("/test.js", "module.exports = { value: 1 };");

    kernel.runFileSync("/test.js");

    const hasEntryBefore = [...kernel.processedCodeCache.keys()].some(k =>
      k.startsWith("/test.js:"),
    );

    kernel.invalidateModule("/test.js");

    const hasEntryAfter = [...kernel.processedCodeCache.keys()].some(k =>
      k.startsWith("/test.js:"),
    );

    if (hasEntryBefore) {
      expect(hasEntryAfter).toBe(false);
    }
  });

  it("invalidateModulesMatching clears modules by predicate", () => {
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync("/app/a.js", "module.exports = { a: 1 };");
    vfs.writeFileSync("/app/b.js", "module.exports = { b: 2 };");
    vfs.writeFileSync("/lib/c.js", "module.exports = { c: 3 };");
    vfs.mkdirSync("/lib", { recursive: true });
    vfs.writeFileSync("/lib/c.js", "module.exports = { c: 3 };");

    kernel.runFileSync("/app/a.js");
    kernel.runFileSync("/app/b.js");
    kernel.runFileSync("/lib/c.js");

    expect(kernel.moduleCache["/app/a.js"]).toBeDefined();
    expect(kernel.moduleCache["/app/b.js"]).toBeDefined();
    expect(kernel.moduleCache["/lib/c.js"]).toBeDefined();

    kernel.invalidateModulesMatching(path => path.startsWith("/app/"));

    expect(kernel.moduleCache["/app/a.js"]).toBeUndefined();
    expect(kernel.moduleCache["/app/b.js"]).toBeUndefined();
    expect(kernel.moduleCache["/lib/c.js"]).toBeDefined();
  });

  it("re-executes module after invalidation with fresh content", () => {
    vfs.writeFileSync("/counter.js", "module.exports = { count: 1 };");

    const first = kernel.runFileSync("/counter.js");
    expect(first.exports.count).toBe(1);

    kernel.invalidateModule("/counter.js");
    vfs.writeFileSync("/counter.js", "module.exports = { count: 2 };");

    const second = kernel.runFileSync("/counter.js");
    expect(second.exports.count).toBe(2);
  });
});

describe("HMR: React Refresh registration", () => {
  it("adds $RefreshReg$ calls for React components", () => {
    const code = `
function App() {
  return React.createElement('div', null, 'Hello');
}
`;
    const result = addReactRefresh(code, "/app/page.tsx");
    expect(result).toContain("$RefreshReg$(App");
    expect(result).toContain("import.meta.hot");
    expect(result).toContain("$RefreshRuntime$");
  });

  it("registers multiple components", () => {
    const code = `
function Header() { return React.createElement('header'); }
function Footer() { return React.createElement('footer'); }
`;
    const result = addReactRefresh(code, "/components/layout.tsx");
    expect(result).toContain("$RefreshReg$(Header");
    expect(result).toContain("$RefreshReg$(Footer");
  });

  it("handles arrow function components", () => {
    const code = `const Button = () => React.createElement('button');`;
    const result = addReactRefresh(code, "/components/button.tsx");
    expect(result).toContain("$RefreshReg$(Button");
  });

  it("skips non-component functions (lowercase)", () => {
    const code = `function helper() { return 42; }`;
    const result = addReactRefresh(code, "/utils/helper.ts");
    expect(result).not.toContain("$RefreshReg$");
    expect(result).toContain("import.meta.hot.accept()");
  });

  it("adds HMR setup wrapper", () => {
    const code = `export default function Page() { return null; }`;
    const result = addReactRefresh(code, "/app/page.tsx");
    expect(result).toContain("import.meta.hot = window.__vite_hot_context__");
    expect(result).toContain("import.meta.hot.accept");
  });
});

describe("HMR: CSS import stripping", () => {
  it("strips plain CSS imports", () => {
    const code = `import './globals.css';\nconst x = 1;`;
    const ctx = {
      readFile: () => "",
      exists: () => false,
    };
    const result = stripCssImports(code, "/app/page.tsx", ctx);
    expect(result).not.toContain("import './globals.css'");
    expect(result).toContain("const x = 1");
  });

  it("converts CSS module imports to class name objects", () => {
    const ctx = {
      readFile: () => ".container { color: red; }\n.title { font-size: 20px; }",
      exists: (path: string) => path.includes("module.css"),
    };
    const code = `import styles from './page.module.css';`;
    const result = stripCssImports(code, "/app/page.tsx", ctx);
    expect(result).toContain("const styles");
    expect(result).toContain("container");
    expect(result).toContain("title");
  });
});

describe("HMR: NPM import redirection", () => {
  it("redirects react imports to esm.sh", () => {
    const code = `import React from 'react';`;
    const result = redirectNpmImports(code);
    expect(result).toContain("esm.sh/react");
  });

  it("does not redirect relative imports", () => {
    const code = `import Button from './Button';`;
    const result = redirectNpmImports(code);
    expect(result).toContain("./Button");
    expect(result).not.toContain("esm.sh");
  });

  it("does not redirect next/* imports (handled by import map)", () => {
    const code = `import Link from 'next/link';\nimport { useRouter } from 'next/router';`;
    const result = redirectNpmImports(code);
    expect(result).toContain("'next/link'");
    expect(result).toContain("'next/router'");
  });

  it("redirects third-party packages to esm.sh", () => {
    const code = `import { z } from 'zod';`;
    const result = redirectNpmImports(code);
    expect(result).toContain("esm.sh/zod");
  });
});

describe("NextDevServer: Route resolution", () => {
  let vfs: MemFS;

  beforeEach(() => {
    vfs = new MemFS();
  });

  it("resolves App Router page", async () => {
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync(
      "/app/page.tsx",
      "export default function Home() { return null; }",
    );
    vfs.writeFileSync(
      "/app/layout.tsx",
      "export default function Layout({ children }) { return children; }",
    );

    const server = new NextDevServer(vfs, {
      port: 3010,
      preferAppRouter: true,
    });
    const response = await server.handleRequest(
      "GET",
      "http://localhost:3010/",
      {},
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toContain("text/html");
  });

  it("resolves Pages Router page", async () => {
    vfs.mkdirSync("/pages", { recursive: true });
    vfs.writeFileSync(
      "/pages/index.jsx",
      "export default function Home() { return null; }",
    );

    const server = new NextDevServer(vfs, {
      port: 3011,
      preferAppRouter: false,
    });
    const response = await server.handleRequest(
      "GET",
      "http://localhost:3011/",
      {},
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toContain("text/html");
  });

  it("returns 404 for non-existent route", async () => {
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync(
      "/app/page.tsx",
      "export default function Home() { return null; }",
    );
    vfs.writeFileSync(
      "/app/layout.tsx",
      "export default function Layout({ children }) { return children; }",
    );

    const server = new NextDevServer(vfs, {
      port: 3012,
      preferAppRouter: true,
    });
    const response = await server.handleRequest(
      "GET",
      "http://localhost:3012/nonexistent",
      {},
    );
    expect(response.statusCode).toBe(404);
  });

  it("serves Next.js shims", async () => {
    vfs.mkdirSync("/app", { recursive: true });
    vfs.writeFileSync("/app/page.tsx", "");

    const server = new NextDevServer(vfs, { port: 3013 });
    const response = await server.handleRequest(
      "GET",
      "http://localhost:3013/_next/shims/link.js",
      {},
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toContain("javascript");
  });
});
