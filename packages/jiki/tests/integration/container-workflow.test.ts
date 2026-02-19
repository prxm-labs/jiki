import { describe, it, expect } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: Container Workflows", () => {
  it("write files and execute code that requires them", () => {
    const container = boot();
    container.writeFile(
      "/utils.js",
      "module.exports = { greet: name => `Hello ${name}` };",
    );
    container.writeFile(
      "/main.js",
      `
      const utils = require('./utils');
      module.exports = utils.greet('World');
    `,
    );
    const result = container.runFile("/main.js");
    expect(result.exports).toBe("Hello World");
    container.destroy();
  });

  it("run node via shell", async () => {
    const container = boot();
    container.writeFile("/index.js", 'module.exports = "shell-run";');
    const result = await container.run("node /index.js");
    expect(result.exitCode).toBe(0);
    container.destroy();
  });

  it("snapshot round-trip: create, snapshot, restore, verify", () => {
    const container = boot();
    container.writeFile("/a.txt", "alpha");
    container.writeFile("/b/c.txt", "beta");
    container.mkdir("/empty");

    const snapshot = container.toSnapshot();
    container.destroy();

    const restored = Container.fromSnapshot(snapshot);
    expect(restored.readFile("/a.txt")).toBe("alpha");
    expect(restored.readFile("/b/c.txt")).toBe("beta");
    expect(restored.exists("/empty")).toBe(true);
    restored.destroy();
  });

  it("full workflow: write package.json + module + execute", () => {
    const container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test-app",
        version: "1.0.0",
        main: "index.js",
      }),
    );
    container.writeFile("/lib/helper.js", "module.exports = x => x * 2;");
    container.writeFile(
      "/index.js",
      `
      const helper = require('./lib/helper');
      module.exports = helper(21);
    `,
    );

    const result = container.runFile("/index.js");
    expect(result.exports).toBe(42);

    const tree = container.export("/");
    expect(tree["package.json"]).toBeDefined();
    expect(tree["index.js"]).toBeDefined();
    expect(tree["lib"]).toBeDefined();

    container.destroy();
  });

  it("shell commands modify VFS", async () => {
    const container = boot();
    await container.run("mkdir -p /project");
    await container.run("touch /project/readme.txt");
    expect(container.exists("/project/readme.txt")).toBe(true);

    await container.run("rm -rf /project");
    expect(container.exists("/project")).toBe(false);
    container.destroy();
  });

  it("execute code that uses multiple built-in modules", () => {
    const container = boot();
    const result = container.execute(`
      const path = require('path');
      const os = require('os');
      const util = require('util');
      module.exports = {
        joined: path.join('/a', 'b'),
        platform: os.platform(),
        formatted: util.format('%s=%d', 'x', 42),
      };
    `);
    const exports = result.exports as any;
    expect(exports.joined).toBe("/a/b");
    expect(typeof exports.platform).toBe("string");
    expect(exports.formatted).toBe("x=42");
    container.destroy();
  });
});
