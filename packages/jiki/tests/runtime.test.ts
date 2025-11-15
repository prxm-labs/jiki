import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";

describe("Kernel", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  describe("execute", () => {
    it("execute simple code returns exports", () => {
      const result = runtime.execute("module.exports = 42;");
      expect(result.exports).toBe(42);
    });

    it("execute with module.exports object", () => {
      const result = runtime.execute("module.exports = { a: 1, b: 2 };");
      expect(result.exports).toEqual({ a: 1, b: 2 });
    });

    it("execute with console captures via onConsole", () => {
      const logs: { method: string; args: unknown[] }[] = [];
      const rt = new Kernel(vfs, {
        cwd: "/",
        onConsole: (method, args) => logs.push({ method, args }),
      });
      rt.execute('console.log("hello", 42);');
      expect(logs.some(l => l.method === "log" && l.args[0] === "hello")).toBe(
        true,
      );
    });
  });

  describe("runFile", () => {
    it("writes file to VFS and runs it", () => {
      vfs.writeFileSync("/test.js", 'module.exports = "from file";');
      const result = runtime.runFile("/test.js");
      expect(result.exports).toBe("from file");
    });

    it("runs file with complex exports", () => {
      vfs.writeFileSync(
        "/calc.js",
        "module.exports = { add: (a, b) => a + b };",
      );
      const result = runtime.runFile("/calc.js");
      expect((result.exports as any).add(1, 2)).toBe(3);
    });
  });

  describe("require built-ins", () => {
    it('require("path") returns path shim', () => {
      const result = runtime.execute(
        'const p = require("path"); module.exports = p.join("/a", "b");',
      );
      expect(result.exports).toBe("/a/b");
    });

    it('require("node:path") strips prefix', () => {
      const result = runtime.execute(
        'const p = require("node:path"); module.exports = p.sep;',
      );
      expect(result.exports).toBe("/");
    });

    it('require("events") returns EventEmitter', () => {
      const result = runtime.execute(
        'const ee = require("events"); module.exports = typeof ee.EventEmitter;',
      );
      expect(result.exports).toBe("function");
    });

    it('require("fs") returns fs shim', () => {
      vfs.writeFileSync("/data.txt", "hello");
      const result = runtime.execute(
        'const fs = require("fs"); module.exports = fs.readFileSync("/data.txt", "utf8");',
      );
      expect(result.exports).toBe("hello");
    });

    it('require("process") returns process shim', () => {
      const result = runtime.execute(
        'const p = require("process"); module.exports = p.platform;',
      );
      expect(result.exports).toBe("linux");
    });
  });

  describe("require relative modules", () => {
    it('require("./other") resolves from VFS', () => {
      vfs.writeFileSync("/other.js", "module.exports = 99;");
      vfs.writeFileSync("/main.js", 'module.exports = require("./other");');
      const result = runtime.runFile("/main.js");
      expect(result.exports).toBe(99);
    });

    it("require resolves .js extension automatically", () => {
      vfs.writeFileSync("/lib.js", 'module.exports = "lib";');
      vfs.writeFileSync("/main.js", 'module.exports = require("./lib");');
      const result = runtime.runFile("/main.js");
      expect(result.exports).toBe("lib");
    });
  });

  describe("require JSON", () => {
    it('require("./data.json") parses JSON', () => {
      vfs.writeFileSync("/data.json", '{"key": "value"}');
      const result = runtime.execute(
        'module.exports = require("./data.json");',
      );
      expect(result.exports).toEqual({ key: "value" });
    });
  });

  describe("ESM transform", () => {
    it("code with import/export gets transformed and runs", () => {
      vfs.writeFileSync("/esm.js", "export const x = 42;");
      const result = runtime.runFile("/esm.js");
      const exports = result.exports as any;
      expect(exports.x).toBe(42);
      expect(exports.__esModule).toBe(true);
    });

    it("import from another module", () => {
      vfs.writeFileSync("/dep.js", "export const value = 10;");
      vfs.writeFileSync(
        "/main.js",
        'import { value } from "./dep.js";\nmodule.exports = value;',
      );
      const result = runtime.runFile("/main.js");
      expect(result.exports).toBe(10);
    });
  });

  describe("module cache", () => {
    it("second require returns same object", () => {
      vfs.writeFileSync(
        "/cached.js",
        "module.exports = { count: 0 }; module.exports.count++;",
      );
      const result = runtime.execute(`
        const a = require("./cached");
        const b = require("./cached");
        module.exports = a === b;
      `);
      expect(result.exports).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("after clear, modules reload", () => {
      vfs.writeFileSync("/mod.js", "module.exports = Math.random();");
      const first = runtime.execute('module.exports = require("./mod");');
      runtime.clearCache();
      const second = runtime.execute('module.exports = require("./mod");');
      expect(first.exports).not.toBe(second.exports);
    });
  });

  describe("createREPL", () => {
    it("eval returns expression results", () => {
      const repl = runtime.createREPL();
      expect(repl.eval("1 + 2")).toBe(3);
    });

    it("eval handles statements", () => {
      const repl = runtime.createREPL();
      expect(() => repl.eval("var x = 10;")).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("require missing module throws", () => {
      expect(() => runtime.execute('require("./nonexistent");')).toThrow(
        /Cannot find module/,
      );
    });

    it("syntax error in code throws", () => {
      expect(() => runtime.execute("module.exports = {{")).toThrow();
    });
  });
});
