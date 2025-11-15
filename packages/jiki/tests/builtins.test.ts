import { describe, it, expect } from "vitest";
import { isBuiltinModule, resolveBuiltin } from "../src/builtins";

describe("builtins", () => {
  describe("isBuiltinModule", () => {
    it("returns true for core modules", () => {
      for (const name of [
        "path",
        "events",
        "stream",
        "buffer",
        "url",
        "util",
        "os",
        "crypto",
      ]) {
        expect(isBuiltinModule(name)).toBe(true);
      }
    });

    it("returns true for fs and process (handled separately)", () => {
      expect(isBuiltinModule("fs")).toBe(true);
      expect(isBuiltinModule("fs/promises")).toBe(true);
      expect(isBuiltinModule("process")).toBe(true);
    });

    it("returns true for stub modules", () => {
      for (const name of [
        "async_hooks",
        "worker_threads",
        "cluster",
        "tls",
        "dns",
      ]) {
        expect(isBuiltinModule(name)).toBe(true);
      }
    });

    it("returns true for sub-path modules", () => {
      expect(isBuiltinModule("util/types")).toBe(true);
      expect(isBuiltinModule("path/posix")).toBe(true);
      expect(isBuiltinModule("timers/promises")).toBe(true);
    });

    it("returns false for non-builtin modules", () => {
      expect(isBuiltinModule("express")).toBe(false);
      expect(isBuiltinModule("lodash")).toBe(false);
      expect(isBuiltinModule("./local-file")).toBe(false);
    });
  });

  describe("resolveBuiltin", () => {
    it("returns path module with join and resolve", () => {
      const pathMod = resolveBuiltin("path") as any;
      expect(pathMod).toBeDefined();
      expect(typeof pathMod.join).toBe("function");
      expect(typeof pathMod.resolve).toBe("function");
    });

    it("returns events module with EventEmitter", () => {
      const eventsMod = resolveBuiltin("events") as any;
      expect(eventsMod).toBeDefined();
      expect(
        eventsMod.EventEmitter ||
          eventsMod.default?.EventEmitter ||
          typeof eventsMod === "function",
      ).toBeTruthy();
    });

    it("returns undefined for unknown modules", () => {
      expect(resolveBuiltin("nonexistent-module")).toBeUndefined();
    });

    it("returns undefined for fs (handled by ModuleResolver)", () => {
      expect(resolveBuiltin("fs")).toBeUndefined();
    });

    it("caches results on second call", () => {
      const first = resolveBuiltin("url");
      const second = resolveBuiltin("url");
      expect(first).toBe(second);
    });

    it("returns constants module with expected values", () => {
      const constants = resolveBuiltin("constants") as any;
      expect(constants).toBeDefined();
      expect(constants.F_OK).toBe(0);
      expect(constants.R_OK).toBe(4);
      expect(constants.S_IFDIR).toBe(16384);
    });

    it("returns string_decoder with StringDecoder class", () => {
      const sdMod = resolveBuiltin("string_decoder") as any;
      expect(sdMod).toBeDefined();
      expect(sdMod.StringDecoder).toBeDefined();
      const dec = new sdMod.StringDecoder("utf8");
      const result = dec.write(new TextEncoder().encode("hello"));
      expect(result).toBe("hello");
    });

    it("returns timers module with expected functions", () => {
      const timers = resolveBuiltin("timers") as any;
      expect(typeof timers.setTimeout).toBe("function");
      expect(typeof timers.setInterval).toBe("function");
      expect(typeof timers.setImmediate).toBe("function");
    });
  });
});
