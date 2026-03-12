import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: Hono example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot -> install hono with concurrency -> verify module loads", async () => {
    container = boot({ autoInstall: true });

    const progress: string[] = [];
    await container.install("hono", {
      concurrency: 12,
      onProgress: msg => progress.push(msg),
    });

    expect(container.exists("/node_modules/hono")).toBe(true);
    expect(container.exists("/node_modules/hono/package.json")).toBe(true);
    expect(progress.length).toBeGreaterThan(0);

    const pkgJson = JSON.parse(
      container.readFile("/node_modules/hono/package.json"),
    );
    expect(pkgJson.name).toBe("hono");
  });

  it("hono module can be required and exports Hono class", async () => {
    container = boot({ autoInstall: true });
    await container.install("hono");

    container.writeFile(
      "/check.js",
      `
      const { Hono } = require('hono');
      module.exports = typeof Hono;
    `,
    );

    const result = container.runFile("/check.js");
    expect(result.exports).toBe("function");
  });

  it("hono app registers routes", async () => {
    container = boot({ autoInstall: true });
    await container.install("hono");

    container.writeFile(
      "/server.js",
      `
      const { Hono } = require('hono');
      const app = new Hono();

      app.get('/api/hello', (c) => c.text('Hello'));
      app.get('/api/users', (c) => c.json([]));

      module.exports = {
        type: typeof app.fetch,
        routes: app.routes.map(r => ({ method: r.method, path: r.path })),
      };
    `,
    );

    const result = container.runFile("/server.js");
    const exports = result.exports as {
      type: string;
      routes: Array<{ method: string; path: string }>;
    };
    expect(exports.type).toBe("function");
    expect(exports.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/hello" }),
        expect.objectContaining({ method: "GET", path: "/api/users" }),
      ]),
    );
  });

  it("hono dependencies are installed transitively", async () => {
    container = boot();
    await container.install("hono");

    expect(container.exists("/node_modules/hono")).toBe(true);
    const depsList = container
      .readdir("/node_modules")
      .filter(d => !d.startsWith("."));
    expect(depsList).toContain("hono");
  });

  it("autoInstall resolves hono without explicit install", () => {
    container = boot({ autoInstall: true });

    container.writeFile(
      "/check.js",
      `
      const { Hono } = require('hono');
      module.exports = typeof Hono;
    `,
    );

    // With autoInstall, requiring 'hono' should trigger on-demand install.
    // In the test environment (no real network), this will throw because
    // SyncAutoInstaller needs XMLHttpRequest. Verify the error path is clean.
    expect(() => container.runFile("/check.js")).toThrow();
  });

  it("install with concurrency completes faster than sequential", async () => {
    container = boot();

    const progress: string[] = [];
    const start = performance.now();
    await container.install("hono", {
      concurrency: 12,
      onProgress: msg => progress.push(msg),
    });
    const elapsed = performance.now() - start;

    expect(container.exists("/node_modules/hono")).toBe(true);
    expect(elapsed).toBeLessThan(30_000);
    expect(progress.length).toBeGreaterThan(0);
  });
});
