import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";
import { Kernel } from "../../src/kernel";

describe("Integration: Kernel + VFS + Module System", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("multi-file project: entry requires helpers", () => {
    vfs.writeFileSync("/utils.js", "module.exports = { double: n => n * 2 };");
    vfs.writeFileSync("/config.js", "module.exports = { factor: 3 };");
    vfs.writeFileSync(
      "/main.js",
      `
      const utils = require('./utils');
      const config = require('./config');
      module.exports = utils.double(config.factor);
    `,
    );
    const result = runtime.runFile("/main.js");
    expect(result.exports).toBe(6);
  });

  it("circular dependency handling: A requires B, B requires A", () => {
    vfs.writeFileSync(
      "/a.js",
      `
      exports.fromA = 'A';
      const b = require('./b');
      exports.fromB = b.fromB;
    `,
    );
    vfs.writeFileSync(
      "/b.js",
      `
      exports.fromB = 'B';
      const a = require('./a');
      exports.fromA = a.fromA;
    `,
    );
    const result = runtime.execute('module.exports = require("./a");');
    const exports = result.exports as any;
    expect(exports.fromA).toBe("A");
    expect(exports.fromB).toBe("B");
  });

  it("node_modules resolution: require installed package", () => {
    vfs.mkdirSync("/node_modules/my-lib", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/my-lib/package.json",
      JSON.stringify({
        name: "my-lib",
        version: "1.0.0",
        main: "index.js",
      }),
    );
    vfs.writeFileSync(
      "/node_modules/my-lib/index.js",
      'module.exports = { name: "my-lib" };',
    );
    vfs.writeFileSync("/app.js", 'module.exports = require("my-lib");');
    const result = runtime.runFile("/app.js");
    expect((result.exports as any).name).toBe("my-lib");
  });

  it("nested node_modules resolution", () => {
    vfs.mkdirSync("/project/node_modules/pkg", { recursive: true });
    vfs.writeFileSync(
      "/project/node_modules/pkg/package.json",
      JSON.stringify({
        name: "pkg",
        main: "index.js",
      }),
    );
    vfs.writeFileSync(
      "/project/node_modules/pkg/index.js",
      'module.exports = "pkg-result";',
    );
    vfs.writeFileSync("/project/main.js", 'module.exports = require("pkg");');
    const result = runtime.runFile("/project/main.js");
    expect(result.exports).toBe("pkg-result");
  });

  it("index.js resolution in directories", () => {
    vfs.mkdirSync("/lib", { recursive: true });
    vfs.writeFileSync("/lib/index.js", 'module.exports = "from-index";');
    vfs.writeFileSync("/main.js", 'module.exports = require("./lib");');
    const result = runtime.runFile("/main.js");
    expect(result.exports).toBe("from-index");
  });

  it("JSON require from node_modules", () => {
    vfs.mkdirSync("/node_modules/config", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/config/package.json",
      JSON.stringify({
        name: "config",
        main: "data.json",
      }),
    );
    vfs.writeFileSync("/node_modules/config/data.json", '{"setting": true}');
    const result = runtime.execute('module.exports = require("config");');
    expect((result.exports as any).setting).toBe(true);
  });

  it("ESM modules with imports between files", () => {
    vfs.writeFileSync(
      "/math.js",
      "export function add(a, b) { return a + b; }\nexport function mul(a, b) { return a * b; }",
    );
    vfs.writeFileSync(
      "/entry.js",
      `
      import { add, mul } from './math.js';
      module.exports = { sum: add(1, 2), product: mul(3, 4) };
    `,
    );
    const result = runtime.runFile("/entry.js");
    const exports = result.exports as any;
    expect(exports.sum).toBe(3);
    expect(exports.product).toBe(12);
  });
});
