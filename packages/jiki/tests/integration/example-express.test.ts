import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: Express example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot -> init -> install express -> verify module loads", async () => {
    container = boot();
    await container.init();

    await container.install("express");
    expect(container.exists("/node_modules/express")).toBe(true);
    expect(container.exists("/node_modules/express/package.json")).toBe(true);

    const pkgJson = JSON.parse(
      container.readFile("/node_modules/express/package.json"),
    );
    expect(pkgJson.name).toBe("express");
  });

  it("express module can be required and returns a function", async () => {
    container = boot();
    await container.init();

    await container.install("express");

    container.writeFile(
      "/check.js",
      `
      const express = require('express');
      module.exports = typeof express;
    `,
    );

    const result = container.runFile("/check.js");
    expect(result.exports).toBe("function");
  });

  it("express app registers routes and handlers", async () => {
    container = boot();
    await container.init();

    await container.install("express");

    container.writeFile(
      "/server.js",
      `
      const express = require('express');
      const app = express();

      const routes = [];
      const originalGet = app.get.bind(app);
      app.get = function(path, ...handlers) {
        if (typeof path === 'string' && handlers.length > 0) {
          routes.push({ method: 'GET', path });
        }
        return originalGet(path, ...handlers);
      };

      app.get('/api/hello', (req, res) => {
        // handler registered
      });

      app.get('/api/users', (req, res) => {
        // handler registered
      });

      module.exports = { routes, type: typeof app.listen };
    `,
    );

    const result = container.runFile("/server.js");
    const exports = result.exports as {
      routes: Array<{ method: string; path: string }>;
      type: string;
    };
    expect(exports.routes).toHaveLength(2);
    expect(exports.routes[0]).toEqual({ method: "GET", path: "/api/hello" });
    expect(exports.routes[1]).toEqual({ method: "GET", path: "/api/users" });
    expect(exports.type).toBe("function");
  });

  it("express dependencies are installed transitively", async () => {
    container = boot();
    await container.install("express");

    const depsList = container
      .readdir("/node_modules")
      .filter(d => !d.startsWith("."));
    expect(depsList.length).toBeGreaterThan(1);
    expect(depsList).toContain("express");
  });

  it("boot with autoInstall: true and require express without explicit install triggers error path", () => {
    container = boot({ autoInstall: true });

    container.writeFile(
      "/app.js",
      `
      const express = require('express');
      module.exports = typeof express;
    `,
    );

    // In test env (no XMLHttpRequest), autoInstall's SyncAutoInstaller will throw.
    // This verifies the autoInstall code path is wired up correctly.
    expect(() => container.runFile("/app.js")).toThrow();
  });

  it("install with explicit concurrency option completes successfully", async () => {
    container = boot({ autoInstall: true });
    await container.init();

    const progress: string[] = [];
    const result = await container.install("express", {
      concurrency: 12,
      onProgress: msg => progress.push(msg),
    });

    expect(result.added.length).toBeGreaterThan(0);
    expect(result.added.some(a => a.startsWith("express"))).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
    expect(container.exists("/node_modules/express")).toBe(true);
  });
});
