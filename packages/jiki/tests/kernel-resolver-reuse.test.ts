import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";

describe("Kernel: shared ModuleResolver reuse", () => {
  let vfs: MemFS;
  let kernel: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    kernel = new Kernel(vfs, { cwd: "/" });
  });

  it("resolver memos persist across multiple runFileSync calls", () => {
    vfs.writeFileSync("/helper.js", "module.exports = 42;");
    vfs.writeFileSync("/a.js", 'module.exports = require("./helper");');
    vfs.writeFileSync("/b.js", 'module.exports = require("./helper");');

    const resultA = kernel.runFile("/a.js");
    const resultB = kernel.runFile("/b.js");

    expect(resultA.exports).toBe(42);
    expect(resultB.exports).toBe(42);
  });

  it("module cache is shared across executions", () => {
    vfs.writeFileSync(
      "/counter.js",
      `
      let count = 0;
      module.exports = { inc: () => ++count, get: () => count };
    `,
    );
    vfs.writeFileSync(
      "/user.js",
      `
      const c = require('./counter');
      c.inc();
      module.exports = c.get();
    `,
    );

    const first = kernel.runFile("/user.js");
    expect(first.exports).toBe(1);

    vfs.writeFileSync(
      "/user2.js",
      `
      const c = require('./counter');
      c.inc();
      module.exports = c.get();
    `,
    );
    const second = kernel.runFile("/user2.js");
    expect(second.exports).toBe(2);
  });

  it("clearCache resets both module cache and resolver memos", () => {
    vfs.writeFileSync("/val.js", "module.exports = Math.random();");
    const first = kernel.execute('module.exports = require("./val");');
    kernel.clearCache();
    const second = kernel.execute('module.exports = require("./val");');
    expect(first.exports).not.toBe(second.exports);
  });

  it("invalidateModule clears specific module from shared cache", () => {
    vfs.writeFileSync("/counter.js", "module.exports = Math.random();");
    const first = kernel.execute('module.exports = require("./counter");');
    kernel.invalidateModule("/counter.js");
    const second = kernel.execute('module.exports = require("./counter");');
    expect(first.exports).not.toBe(second.exports);
  });

  it("invalidateModulesMatching clears by predicate", () => {
    vfs.writeFileSync("/a.js", "module.exports = Math.random();");
    vfs.writeFileSync("/b.js", "module.exports = Math.random();");

    const a1 = kernel.execute('module.exports = require("./a");');
    const b1 = kernel.execute('module.exports = require("./b");');

    kernel.invalidateModulesMatching(p => p === "/a.js");

    const a2 = kernel.execute('module.exports = require("./a");');
    const b2 = kernel.execute('module.exports = require("./b");');

    expect(a1.exports).not.toBe(a2.exports);
    expect(b1.exports).toBe(b2.exports);
  });

  it("REPL shares the same resolver", () => {
    vfs.writeFileSync("/lib.js", "module.exports = { value: 99 };");
    const repl = kernel.createREPL();
    const result = repl.eval('require("./lib").value');
    expect(result).toBe(99);
  });

  it("multiple files requiring the same deep module share resolution", () => {
    vfs.mkdirSync("/lib", { recursive: true });
    vfs.writeFileSync("/lib/deep.js", 'module.exports = "deep";');
    vfs.writeFileSync("/a.js", 'module.exports = require("./lib/deep");');
    vfs.writeFileSync("/b.js", 'module.exports = require("./lib/deep");');

    expect(kernel.runFile("/a.js").exports).toBe("deep");
    expect(kernel.runFile("/b.js").exports).toBe("deep");
  });
});
