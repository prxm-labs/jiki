import { describe, it, expect, afterEach } from "vitest";
import { Container } from "../../src/container";

describe("Integration: pnpm-scripts example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot with pnpm -> init -> install packages", async () => {
    container = new Container({ packageManager: "pnpm" });
    await container.init();

    await container.install("is-number");
    expect(container.exists("/node_modules/is-number")).toBe(true);
  });

  it("pnpm store structure uses .pnpm directory", async () => {
    container = new Container({ packageManager: "pnpm" });
    await container.install("is-number");

    expect(container.exists("/node_modules/.pnpm")).toBe(true);
    expect(container.exists("/node_modules/is-number")).toBe(true);
  });

  it("pnpm run executes scripts from package.json", async () => {
    container = new Container({ packageManager: "pnpm" });
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "pnpm-demo",
        scripts: { greet: "node /greet.js" },
      }),
    );
    container.writeFile("/greet.js", 'console.log("pnpm works");');

    const result = await container.run("pnpm run greet");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("pnpm works");
  });

  it("pnpm ls lists installed packages", async () => {
    container = new Container({ packageManager: "pnpm" });
    await container.install("is-number");

    const result = await container.run("pnpm ls");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is-number");
  });

  it("pnpm install from package.json", async () => {
    container = new Container({ packageManager: "pnpm" });
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "pnpm-demo",
        dependencies: { "is-number": "*" },
      }),
    );

    await container.installDependencies();
    expect(container.exists("/node_modules/is-number")).toBe(true);
  });

  it("full pnpm workflow: install deps -> run script", async () => {
    container = new Container({ packageManager: "pnpm" });
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "pnpm-demo",
        scripts: { start: "node index.js" },
        dependencies: { "is-number": "*" },
      }),
    );
    container.writeFile(
      "/index.js",
      `
      const isNum = require('is-number');
      console.log('result:', isNum(42));
    `,
    );

    await container.installDependencies();
    const result = await container.run("pnpm run start");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("result: true");
  });

  it("pnpm command on npm container uses lazy initialization", async () => {
    container = new Container();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );

    const result = await container.run("pnpm ls");
    expect(result.exitCode).toBe(0);
  });

  it("pnpm install with concurrency option completes successfully", async () => {
    container = new Container({ packageManager: "pnpm", autoInstall: true });

    const progress: string[] = [];
    await container.install("is-number", {
      concurrency: 12,
      onProgress: msg => progress.push(msg),
    });

    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("boot pnpm + autoInstall triggers error path in test env", () => {
    container = new Container({ packageManager: "pnpm", autoInstall: true });

    container.writeFile(
      "/check.js",
      `
      const isNum = require('is-number');
      module.exports = isNum(42);
    `,
    );

    // SyncAutoInstaller needs XMLHttpRequest, unavailable in Node/Vitest.
    expect(() => container.runFile("/check.js")).toThrow();
  });

  it("pnpm installDependencies with concurrency + onProgress", async () => {
    container = new Container({ packageManager: "pnpm", autoInstall: true });
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "pnpm-progress-demo",
        dependencies: { "is-number": "*" },
      }),
    );

    const progress: string[] = [];
    await container.installDependencies({
      concurrency: 12,
      onProgress: msg => progress.push(msg),
    });

    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
  });
});
