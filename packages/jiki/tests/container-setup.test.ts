import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../src/container";

describe("Container setup and lifecycle", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  describe("boot -> write -> run workflow", () => {
    it("writes a script and runs it via shell", async () => {
      container = boot();
      container.writeFile("/hello.js", 'console.log("lifecycle works");');
      const result = await container.run("node /hello.js");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("lifecycle works");
    });

    it("writes multiple files and runs a script that requires them", async () => {
      container = boot();
      container.writeFile(
        "/lib/math.js",
        "module.exports = { add: (a, b) => a + b };",
      );
      container.writeFile(
        "/main.js",
        `
        const { add } = require("./lib/math");
        console.log("sum=" + add(3, 7));
      `,
      );
      const result = await container.run("node /main.js");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sum=10");
    });
  });

  describe("boot -> install -> require workflow", () => {
    it("installs a package and requires it in executed code", async () => {
      container = boot();
      await container.install("is-number");
      container.writeFile(
        "/check.js",
        `
        const isNum = require("is-number");
        console.log("result=" + isNum(42));
      `,
      );
      const result = await container.run("node /check.js");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("result=true");
    });

    it("installs from package.json and runs an npm script", async () => {
      container = boot();
      container.writeFile(
        "/package.json",
        JSON.stringify({
          name: "lifecycle-test",
          scripts: { greet: "node /greet.js" },
          dependencies: { "is-number": "*" },
        }),
      );
      container.writeFile(
        "/greet.js",
        `
        const isNum = require("is-number");
        console.log("check=" + isNum("abc"));
      `,
      );
      await container.installDependencies();
      const result = await container.run("npm run greet");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("check=false");
    });
  });

  describe("snapshot with installed packages", () => {
    it("snapshot preserves node_modules and restores correctly", async () => {
      container = boot();
      await container.install("is-number");

      expect(container.exists("/node_modules/is-number/package.json")).toBe(
        true,
      );

      const snapshot = container.toSnapshot();
      const restored = Container.fromSnapshot(snapshot);

      expect(restored.exists("/node_modules/is-number/package.json")).toBe(
        true,
      );

      restored.writeFile(
        "/use-it.js",
        `
        const isNum = require("is-number");
        module.exports = isNum(5);
      `,
      );
      const result = restored.runFile("/use-it.js");
      expect(result.exports).toBe(true);
    });
  });

  describe("custom cwd", () => {
    it("resolves files relative to cwd in executed code", () => {
      container = new Container({ cwd: "/app" });
      container.mkdir("/app");
      container.writeFile("/app/data.json", '{"v":1}');
      container.writeFile(
        "/app/loader.js",
        'module.exports = require("./data.json");',
      );
      const result = container.runFile("/app/loader.js");
      expect(result.exports).toEqual({ v: 1 });
    });

    it("shell pwd reflects custom cwd", async () => {
      container = new Container({ cwd: "/project" });
      container.mkdir("/project");
      const result = await container.run("pwd");
      expect(result.stdout.trim()).toBe("/project");
    });
  });

  describe("env passthrough", () => {
    it("env variables reach process.env in executed code", () => {
      container = new Container({
        env: { DB_HOST: "localhost", PORT: "3000" },
      });
      const result = container.execute(`
        module.exports = { host: process.env.DB_HOST, port: process.env.PORT };
      `);
      expect(result.exports).toEqual({ host: "localhost", port: "3000" });
    });

    it("env variables are accessible in shell scripts", async () => {
      container = new Container({ env: { GREETING: "hi-there" } });
      container.writeFile(
        "/env-check.js",
        'console.log("val=" + process.env.GREETING);',
      );
      const result = await container.run("node /env-check.js");
      expect(result.stdout).toContain("val=hi-there");
    });

    it("shell export adds new env variables", async () => {
      container = boot();
      await container.run("export DYNAMIC_VAR=dynamic");
      const result = await container.run("echo $DYNAMIC_VAR");
      expect(result.stdout.trim()).toBe("dynamic");
    });
  });

  describe("sendInput wiring", () => {
    it("sendInput does not throw when called", () => {
      container = boot();
      expect(() => container.sendInput("test\n")).not.toThrow();
    });
  });

  describe("run with AbortController", () => {
    it("AbortController signal can be passed to run without error", async () => {
      container = boot();
      container.writeFile("/quick.js", 'console.log("fast"); process.exit(0);');
      const controller = new AbortController();
      const result = await container.run("node /quick.js", {
        signal: controller.signal,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("fast");
    });

    it("aborting before run completes does not crash", async () => {
      container = boot();
      container.writeFile(
        "/simple.js",
        'console.log("done"); process.exit(0);',
      );
      const controller = new AbortController();
      controller.abort();
      const result = await container.run("node /simple.js", {
        signal: controller.signal,
      });
      expect(typeof result.exitCode).toBe("number");
    });
  });

  describe("container with pnpm layout", () => {
    it("pnpm container can install and use packages", async () => {
      container = new Container({ packageManager: "pnpm" });
      await container.install("is-number");
      expect(container.exists("/node_modules/is-number")).toBe(true);
    });
  });

  describe("multiple operations sequence", () => {
    it("write -> execute -> modify -> re-execute sees updated code", () => {
      container = boot();
      container.writeFile("/val.js", "module.exports = 1;");
      expect(container.runFile("/val.js").exports).toBe(1);

      container.destroy();
      container.writeFile("/val.js", "module.exports = 2;");
      expect(container.runFile("/val.js").exports).toBe(2);
    });

    it("mkdir -> writeFile -> rm -> exists sequence", () => {
      container = boot();
      container.mkdir("/temp");
      container.writeFile("/temp/file.txt", "temporary");
      expect(container.exists("/temp/file.txt")).toBe(true);
      container.rm("/temp");
      expect(container.exists("/temp")).toBe(false);
      expect(container.exists("/temp/file.txt")).toBe(false);
    });
  });
});
