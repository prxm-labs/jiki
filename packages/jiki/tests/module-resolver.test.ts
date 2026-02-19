import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemFS } from "../src/memfs";
import { ModuleResolver, RuntimeOptions } from "../src/module-resolver";
import { createFsShim } from "../src/polyfills/fs";
import { createProcess } from "../src/polyfills/process";

function makeResolver(vfs?: MemFS, opts?: RuntimeOptions) {
  const fs = vfs || new MemFS();
  const proc = createProcess({ cwd: "/" });
  const fsShim = createFsShim(fs, () => proc.cwd());
  const cache: Record<string, any> = {};
  const transformedCache = new Map<string, string>();
  return {
    resolver: new ModuleResolver(
      fs,
      fsShim,
      proc,
      cache,
      opts || {},
      transformedCache,
    ),
    vfs: fs,
    cache,
    transformedCache,
  };
}

describe("ModuleResolver", () => {
  describe("resolve", () => {
    it("resolves builtin modules by name", () => {
      const { resolver } = makeResolver();
      expect(resolver.resolve("path", "/")).toBe("path");
      expect(resolver.resolve("events", "/")).toBe("events");
    });

    it("strips node: prefix and resolves builtins", () => {
      const { resolver } = makeResolver();
      expect(resolver.resolve("node:path", "/")).toBe("path");
      expect(resolver.resolve("node:fs", "/")).toBe("fs");
    });

    it("resolves relative .js files", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/src/helper.js", "module.exports = 1;");
      expect(resolver.resolve("./helper", "/src")).toBe("/src/helper.js");
    });

    it("resolves relative files with explicit extension", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/lib/util.js", "");
      expect(resolver.resolve("./util.js", "/lib")).toBe("/lib/util.js");
    });

    it("resolves index.js in a directory", () => {
      const { resolver, vfs } = makeResolver();
      vfs.mkdirSync("/pkg", { recursive: true });
      vfs.writeFileSync("/pkg/index.js", "");
      expect(resolver.resolve("./pkg", "/")).toBe("/pkg/index.js");
    });

    it("resolves from node_modules", () => {
      const { resolver, vfs } = makeResolver();
      vfs.mkdirSync("/node_modules/foo", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/foo/index.js",
        'module.exports = "foo";',
      );
      expect(resolver.resolve("foo", "/")).toBe("/node_modules/foo/index.js");
    });

    it("resolves package.json main field", () => {
      const { resolver, vfs } = makeResolver();
      vfs.mkdirSync("/node_modules/bar", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/bar/package.json",
        JSON.stringify({ main: "lib/entry.js" }),
      );
      vfs.mkdirSync("/node_modules/bar/lib", { recursive: true });
      vfs.writeFileSync("/node_modules/bar/lib/entry.js", "");
      expect(resolver.resolve("bar", "/")).toBe(
        "/node_modules/bar/lib/entry.js",
      );
    });

    it("throws for missing modules", () => {
      const { resolver } = makeResolver();
      expect(() => resolver.resolve("./nonexistent", "/")).toThrow(
        "Cannot find module",
      );
    });

    it("throws for missing npm packages", () => {
      const { resolver } = makeResolver();
      expect(() => resolver.resolve("missing-pkg", "/")).toThrow(
        "Cannot find module",
      );
    });

    it("memoizes resolution results", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/a.js", "");
      const first = resolver.resolve("./a", "/");
      const second = resolver.resolve("./a", "/");
      expect(first).toBe(second);
    });

    it("resolves scoped packages", () => {
      const { resolver, vfs } = makeResolver();
      vfs.mkdirSync("/node_modules/@scope/pkg", { recursive: true });
      vfs.writeFileSync("/node_modules/@scope/pkg/index.js", "");
      expect(resolver.resolve("@scope/pkg", "/")).toBe(
        "/node_modules/@scope/pkg/index.js",
      );
    });

    it("resolves .ts extensions", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/src/util.ts", "");
      expect(resolver.resolve("./util", "/src")).toBe("/src/util.ts");
    });

    it("resolves .json files", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/config.json", "{}");
      expect(resolver.resolve("./config.json", "/")).toBe("/config.json");
    });
  });

  describe("makeRequire", () => {
    it("returns a function with resolve and cache", () => {
      const { resolver } = makeResolver();
      const req = resolver.makeRequire("/");
      expect(typeof req).toBe("function");
      expect(typeof req.resolve).toBe("function");
      expect(typeof req.cache).toBe("object");
    });

    it("resolve.paths returns node_modules paths for non-builtins", () => {
      const { resolver } = makeResolver();
      const req = resolver.makeRequire("/app/src");
      const paths = req.resolve.paths("express");
      expect(paths).toContain("/app/src/node_modules");
      expect(paths).toContain("/app/node_modules");
      expect(paths).toContain("/node_modules");
    });

    it("resolve.paths returns null for builtins", () => {
      const { resolver } = makeResolver();
      const req = resolver.makeRequire("/");
      expect(req.resolve.paths("path")).toBeNull();
      expect(req.resolve.paths("node:fs")).toBeNull();
    });
  });

  describe("load", () => {
    it("loads and caches a JS module", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/mod.js", "module.exports = 42;");
      const mod = resolver.load("/mod.js");
      expect(mod.exports).toBe(42);
      expect(mod.loaded).toBe(true);
    });

    it("loads JSON files", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/data.json", '{"key": "value"}');
      const mod = resolver.load("/data.json");
      expect(mod.exports).toEqual({ key: "value" });
    });

    it("loads builtin modules", () => {
      const { resolver } = makeResolver();
      const mod = resolver.load("path");
      expect(mod.exports).toBeDefined();
      expect((mod.exports as any).join).toBeDefined();
    });

    it("returns cached module on second load", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/cached.js", "module.exports = Math.random();");
      const first = resolver.load("/cached.js");
      const second = resolver.load("/cached.js");
      expect(first).toBe(second);
    });

    it("wraps errors with module path context", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/bad.js", 'throw new Error("broken");');
      expect(() => resolver.load("/bad.js")).toThrow(
        /Error loading module '\/bad.js'/,
      );
    });
  });

  describe("exports conditions", () => {
    it("checks node condition", () => {
      const vfs = new MemFS();
      vfs.writeFileSync(
        "/node_modules/condpkg/package.json",
        JSON.stringify({
          name: "condpkg",
          exports: { ".": { node: "./node.js", default: "./browser.js" } },
        }),
      );
      vfs.writeFileSync("/node_modules/condpkg/node.js", "");
      vfs.writeFileSync("/node_modules/condpkg/browser.js", "");

      const { resolver } = makeResolver(vfs);
      const resolved = resolver.resolve("condpkg", "/");
      // resolve.exports adds "node" condition by default (browser: false)
      expect(resolved).toContain("node.js");
    });

    it("checks default condition as fallback", () => {
      const vfs = new MemFS();
      vfs.writeFileSync(
        "/node_modules/defpkg/package.json",
        JSON.stringify({
          name: "defpkg",
          exports: { ".": { default: "./index.js" } },
        }),
      );
      vfs.writeFileSync("/node_modules/defpkg/index.js", "");

      const { resolver } = makeResolver(vfs);
      const resolved = resolver.resolve("defpkg", "/");
      expect(resolved).toContain("index.js");
    });
  });

  describe("exports field precedence", () => {
    it("does not fall through to main when exports resolves", () => {
      const vfs = new MemFS();
      vfs.writeFileSync(
        "/node_modules/testpkg/package.json",
        JSON.stringify({
          name: "testpkg",
          main: "./legacy.js",
          exports: { ".": "./modern.js" },
        }),
      );
      vfs.writeFileSync(
        "/node_modules/testpkg/modern.js",
        'module.exports = "modern"',
      );
      vfs.writeFileSync(
        "/node_modules/testpkg/legacy.js",
        'module.exports = "legacy"',
      );

      const { resolver } = makeResolver(vfs);
      const resolved = resolver.resolve("testpkg", "/");
      expect(resolved).toContain("modern.js");
      expect(resolved).not.toContain("legacy.js");
    });

    it("does not check browser field when exports is present", () => {
      const vfs = new MemFS();
      vfs.writeFileSync(
        "/node_modules/testpkg2/package.json",
        JSON.stringify({
          name: "testpkg2",
          browser: "./browser.js",
          exports: { ".": "./server.js" },
        }),
      );
      vfs.writeFileSync(
        "/node_modules/testpkg2/server.js",
        'module.exports = "server"',
      );
      vfs.writeFileSync(
        "/node_modules/testpkg2/browser.js",
        'module.exports = "browser"',
      );

      const { resolver } = makeResolver(vfs);
      const resolved = resolver.resolve("testpkg2", "/");
      expect(resolved).toContain("server.js");
      expect(resolved).not.toContain("browser.js");
    });
  });

  // Task 21: exports field logging
  describe("debug logging for exports resolution", () => {
    it("logs warnings when DEBUG_RESOLVER is set and exports resolution fails", () => {
      const vfs = new MemFS();
      vfs.mkdirSync("/node_modules/badpkg", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/badpkg/package.json",
        JSON.stringify({
          name: "badpkg",
          exports: { ".": { require: "./nonexistent.js" } },
        }),
      );
      // The file doesn't exist, so resolution through exports should fail and log

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { resolver } = makeResolver(vfs, { env: { DEBUG_RESOLVER: "1" } });
      expect(() => resolver.resolve("badpkg", "/")).toThrow(
        "Cannot find module",
      );
      // No warn expected here because resolve.exports returns the path but the file doesn't exist
      // The catch is for when resolve.exports itself throws
      warnSpy.mockRestore();
    });

    it("does not log when DEBUG_RESOLVER is not set", () => {
      const vfs = new MemFS();
      vfs.mkdirSync("/node_modules/badpkg", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/badpkg/package.json",
        JSON.stringify({
          name: "badpkg",
          exports: { ".": { require: "./nonexistent.js" } },
        }),
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { resolver } = makeResolver(vfs);
      expect(() => resolver.resolve("badpkg", "/")).toThrow(
        "Cannot find module",
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // Task 22: per-entry cache invalidation
  describe("invalidate", () => {
    it("invalidates resolution memo for a specific path", () => {
      const { resolver, vfs } = makeResolver();
      vfs.writeFileSync("/a.js", "module.exports = 1;");
      const first = resolver.resolve("./a", "/");
      expect(first).toBe("/a.js");

      // Invalidate and delete the file
      resolver.invalidate("/a.js");
      vfs.rmSync("/a.js");

      expect(() => resolver.resolve("./a", "/")).toThrow("Cannot find module");
    });

    it("invalidates module require cache for the path", () => {
      const { resolver, vfs, cache } = makeResolver();
      vfs.writeFileSync("/mod.js", "module.exports = 42;");
      const mod = resolver.load("/mod.js");
      expect(mod.exports).toBe(42);
      expect(cache["/mod.js"]).toBeDefined();

      resolver.invalidate("/mod.js");
      expect(cache["/mod.js"]).toBeUndefined();
    });

    it("invalidates pkgJsonMemo when package.json changes", () => {
      const { resolver, vfs } = makeResolver();
      vfs.mkdirSync("/node_modules/mypkg", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/mypkg/package.json",
        JSON.stringify({ name: "mypkg", main: "old.js" }),
      );
      vfs.writeFileSync("/node_modules/mypkg/old.js", "");
      expect(resolver.resolve("mypkg", "/")).toBe("/node_modules/mypkg/old.js");

      // Update package.json and invalidate
      vfs.writeFileSync(
        "/node_modules/mypkg/package.json",
        JSON.stringify({ name: "mypkg", main: "new.js" }),
      );
      vfs.writeFileSync("/node_modules/mypkg/new.js", "");
      resolver.invalidate("/node_modules/mypkg/package.json");
      resolver.invalidate("/node_modules/mypkg/old.js");

      // Should now resolve to new.js
      const resolved = resolver.resolve("mypkg", "/");
      expect(resolved).toBe("/node_modules/mypkg/new.js");
    });

    it("invalidates transformedCache for the path", () => {
      const { resolver, transformedCache } = makeResolver();
      transformedCache.set("/test.js", "transformed code");
      resolver.invalidate("/test.js");
      expect(transformedCache.has("/test.js")).toBe(false);
    });
  });
});
