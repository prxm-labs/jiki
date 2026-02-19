import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: Node example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot -> writeFile -> execute -> verify output", async () => {
    container = boot({
      cwd: "/",
      onConsole: () => {},
    });

    container.writeFile(
      "/index.js",
      `
      const os = require('os');
      const path = require('path');
      console.log('Platform:', os.platform());
      console.log('CWD:', process.cwd());
      const greeting = require('./lib/greeting');
      console.log(greeting('jiki'));
    `,
    );
    container.writeFile(
      "/lib/greeting.js",
      `
      module.exports = function greeting(name) {
        return 'Hello from ' + name + '!';
      };
    `,
    );

    const result = await container.run("node /index.js");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Platform:");
    expect(result.stdout).toContain("CWD:");
    expect(result.stdout).toContain("Hello from jiki!");
  });

  it("write multiple files and require across them", () => {
    container = boot();

    container.writeFile(
      "/lib/math.js",
      `
      module.exports = { add: (a, b) => a + b, mul: (a, b) => a * b };
    `,
    );
    container.writeFile(
      "/config.json",
      JSON.stringify({ env: "browser", version: "1.0" }),
    );
    container.writeFile(
      "/main.js",
      `
      const math = require('./lib/math');
      const config = require('./config.json');
      module.exports = {
        sum: math.add(10, 32),
        product: math.mul(6, 7),
        config,
      };
    `,
    );

    const result = container.runFile("/main.js");
    expect(result.exports).toEqual({
      sum: 42,
      product: 42,
      config: { env: "browser", version: "1.0" },
    });
  });

  it("ESM-style modules are auto-transformed to CJS", () => {
    container = boot();

    container.writeFile(
      "/math.js",
      `
      export const add = (a, b) => a + b;
      export const multiply = (a, b) => a * b;
      export default { add, multiply };
    `,
    );
    container.writeFile(
      "/user.js",
      `
      const math = require('./math');
      module.exports = { sum: math.add(2, 3), product: math.multiply(4, 5) };
    `,
    );

    const result = container.runFile("/user.js");
    expect(result.exports).toEqual({ sum: 5, product: 20 });
  });

  it("VFS snapshot round-trip preserves all files", () => {
    container = boot();

    container.writeFile("/a.txt", "alpha");
    container.writeFile("/b/c.txt", "beta");
    container.writeFile("/lib/deep.js", 'module.exports = "deep";');
    container.mkdir("/empty");

    const snapshot = container.toSnapshot();
    container.destroy();

    const restored = Container.fromSnapshot(snapshot);
    expect(restored.readFile("/a.txt")).toBe("alpha");
    expect(restored.readFile("/b/c.txt")).toBe("beta");
    expect(restored.readFile("/lib/deep.js")).toContain("deep");
    expect(restored.exists("/empty")).toBe(true);

    const result = restored.runFile("/lib/deep.js");
    expect(result.exports).toBe("deep");
    restored.destroy();
  });

  it("shell commands interact with VFS", async () => {
    container = boot();

    container.writeFile("/file.txt", "hello");
    const catResult = await container.run("cat /file.txt");
    expect(catResult.stdout).toBe("hello");
    expect(catResult.exitCode).toBe(0);

    await container.run("mkdir -p /project/src");
    expect(container.exists("/project/src")).toBe(true);

    await container.run("touch /project/src/index.js");
    expect(container.exists("/project/src/index.js")).toBe(true);

    const lsResult = await container.run("ls /project/src");
    expect(lsResult.stdout).toContain("index.js");
  });

  it("process.env is accessible in executed code", () => {
    container = new Container({
      env: { APP_MODE: "test", PORT: "3000" },
    });

    const result = container.execute(`
      module.exports = {
        mode: process.env.APP_MODE,
        port: process.env.PORT,
      };
    `);

    expect(result.exports).toEqual({ mode: "test", port: "3000" });
  });

  it("boot with autoInstall: true — ESM auto-transform still works", () => {
    container = boot({ autoInstall: true });

    container.writeFile(
      "/math.js",
      `
      export const add = (a, b) => a + b;
      export default { add };
    `,
    );
    container.writeFile(
      "/user.js",
      `
      const math = require('./math');
      module.exports = math.add(2, 3);
    `,
    );

    const result = container.runFile("/user.js");
    expect(result.exports).toBe(5);
  });

  it("boot with autoInstall: true — builtins resolve without triggering auto-install", () => {
    container = boot({ autoInstall: true });

    container.writeFile(
      "/check.js",
      `
      const path = require('path');
      const os = require('os');
      module.exports = { join: typeof path.join, platform: typeof os.platform };
    `,
    );

    const result = container.runFile("/check.js");
    expect(result.exports).toEqual({ join: "function", platform: "function" });
  });
});
