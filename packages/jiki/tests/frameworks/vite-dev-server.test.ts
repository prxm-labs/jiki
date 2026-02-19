import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";
import { ViteDevServer } from "../../src/frameworks/vite-dev-server";

describe("ViteDevServer", () => {
  let vfs: MemFS;
  let server: ViteDevServer;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/src", { recursive: true });
    server = new ViteDevServer(vfs, { port: 3000, root: "/" });
  });

  describe("HTML serving", () => {
    it("serves index.html with HMR client injected", async () => {
      vfs.writeFileSync(
        "/index.html",
        "<html><head></head><body>Hello</body></html>",
      );
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/",
        {},
      );
      expect(res.statusCode).toBe(200);
      const body = res.body.toString();
      expect(body).toContain("/@vite/client");
      expect(body).toContain("Hello");
    });

    it("generates default HTML when index.html is missing", async () => {
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/",
        {},
      );
      expect(res.statusCode).toBe(200);
      const body = res.body.toString();
      expect(body).toContain("<!DOCTYPE html>");
      expect(body).toContain("/@vite/client");
      expect(body).toContain("/src/main");
    });
  });

  describe("JavaScript serving", () => {
    it("serves .js files with correct MIME type", async () => {
      vfs.writeFileSync("/src/app.js", "export const x = 1;");
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/src/app.js",
        {},
      );
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toContain("application/javascript");
    });

    it("transforms ESM to CJS", async () => {
      vfs.writeFileSync("/src/app.js", "export const x = 1;");
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/src/app.js",
        {},
      );
      const body = res.body.toString();
      // Should have been transformed from ESM
      expect(body).toContain("exports");
    });

    it("rewrites bare imports to /@modules/", async () => {
      vfs.writeFileSync(
        "/src/app.js",
        'import React from "react";\nconsole.log(React);',
      );
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/src/app.js",
        {},
      );
      const body = res.body.toString();
      expect(body).toContain("/@modules/react");
    });
  });

  describe("CSS serving", () => {
    it("serves CSS as a JS module that injects a <style> tag", async () => {
      vfs.writeFileSync("/src/style.css", "body { color: red; }");
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/src/style.css",
        {},
      );
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toContain("application/javascript");
      const body = res.body.toString();
      expect(body).toContain("body { color: red; }");
      expect(body).toContain("document.createElement");
      expect(body).toContain("style");
    });

    it("returns 404 for missing CSS", async () => {
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/missing.css",
        {},
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe("/@modules/ bare import resolution", () => {
    it("resolves package from node_modules", async () => {
      vfs.mkdirSync("/node_modules/lodash", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/lodash/package.json",
        JSON.stringify({ main: "lodash.js" }),
      );
      vfs.writeFileSync(
        "/node_modules/lodash/lodash.js",
        "module.exports = {};",
      );

      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/@modules/lodash",
        {},
      );
      expect(res.statusCode).toBe(200);
    });

    it("returns 404 for missing package", async () => {
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/@modules/nonexistent",
        {},
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe("HMR client", () => {
    it("serves /@vite/client", async () => {
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/@vite/client",
        {},
      );
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toContain("application/javascript");
      const body = res.body.toString();
      expect(body).toContain("createHotContext");
    });
  });

  describe("static files", () => {
    it("serves static files with correct MIME type", async () => {
      vfs.writeFileSync("/favicon.ico", new Uint8Array([0, 0]));
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/favicon.ico",
        {},
      );
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toContain("image/x-icon");
    });
  });

  describe("CORS", () => {
    it("adds CORS headers to responses", async () => {
      vfs.writeFileSync(
        "/index.html",
        "<html><head></head><body></body></html>",
      );
      const res = await server.handleRequest(
        "GET",
        "http://localhost:3000/",
        {},
      );
      expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
    });

    it("handles OPTIONS preflight", async () => {
      const res = await server.handleRequest(
        "OPTIONS",
        "http://localhost:3000/",
        {},
      );
      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
    });
  });

  describe("file watching and HMR", () => {
    it("emits hmr-update on JS file change", async () => {
      const updates: any[] = [];
      server.on("hmr-update", (u: any) => updates.push(u));
      server.start();

      vfs.writeFileSync("/src/app.js", "export const x = 2;");
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe("update");
      expect(updates[0].path).toBe("/src/app.js");
    });

    it("emits full-reload on HTML change", async () => {
      const updates: any[] = [];
      server.on("hmr-update", (u: any) => updates.push(u));
      server.start();

      vfs.writeFileSync(
        "/index.html",
        "<html><head></head><body>Updated</body></html>",
      );
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe("full-reload");
    });

    it("emits update on CSS change", async () => {
      const updates: any[] = [];
      server.on("hmr-update", (u: any) => updates.push(u));
      server.start();

      vfs.writeFileSync("/src/style.css", "body { color: blue; }");
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe("update");
    });
  });
});
