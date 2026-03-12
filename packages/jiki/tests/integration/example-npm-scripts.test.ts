import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: npm-scripts example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot -> init -> writeFile(package.json) -> installDependencies", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "npm-scripts-demo",
        version: "1.0.0",
        scripts: { start: "node index.js" },
        dependencies: { "is-number": "*" },
      }),
    );

    await container.installDependencies();
    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(container.exists("/node_modules/is-number/package.json")).toBe(true);
  });

  it("node_modules structure is created correctly", async () => {
    container = boot();
    await container.install("is-number");

    expect(container.exists("/node_modules/is-number")).toBe(true);
    const pkgJson = JSON.parse(
      container.readFile("/node_modules/is-number/package.json"),
    );
    expect(pkgJson.name).toBe("is-number");
  });

  it("run npm scripts via shell and verify exit codes", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        scripts: { hello: "node /hello.js" },
      }),
    );
    container.writeFile("/hello.js", 'console.log("npm script works");');

    const result = await container.run("npm run hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("npm script works");
  });

  it("npm run with missing script returns error", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        scripts: {},
      }),
    );

    const result = await container.run("npm run nonexistent");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("not found");
  });

  it("install with save: true updates package.json", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
        dependencies: {},
      }),
    );

    await container.install("is-number", { save: true });

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.dependencies["is-number"]).toBeDefined();
    expect(pkgJson.dependencies["is-number"]).toMatch(/^\^/);
  });

  it("install with saveDev: true updates devDependencies", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );

    await container.install("is-number", { saveDev: true });

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.devDependencies["is-number"]).toBeDefined();
  });

  it("full workflow: install deps -> run script using them", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "npm-demo",
        scripts: { start: "node index.js" },
        dependencies: { "is-number": "*" },
      }),
    );
    container.writeFile(
      "/index.js",
      `
      const isNum = require('is-number');
      console.log('42 is number:', isNum(42));
      console.log('abc is number:', isNum('abc'));
    `,
    );

    await container.installDependencies();
    const result = await container.run("npm run start");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("42 is number: true");
    expect(result.stdout).toContain("abc is number: false");
  });

  it("npm ls shows installed packages", async () => {
    container = boot();
    await container.install("is-number");

    const result = await container.run("npm ls");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is-number");
  });

  it("npm init creates package.json", async () => {
    container = boot();
    const result = await container.run("npm init");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/package.json")).toBe(true);
    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.version).toBe("1.0.0");
  });

  it("installDependencies with concurrency + onProgress reports progress", async () => {
    container = boot({ autoInstall: true });
    await container.init();

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "npm-progress-demo",
        version: "1.0.0",
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

  it("install with concurrency + onProgress reports progress", async () => {
    container = boot({ autoInstall: true });

    const progress: string[] = [];
    await container.install("is-number", {
      concurrency: 12,
      onProgress: msg => progress.push(msg),
    });

    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("boot with autoInstall: true — require triggers auto-install error path in test env", () => {
    container = boot({ autoInstall: true });

    container.writeFile(
      "/auto.js",
      `
      const isNum = require('is-number');
      module.exports = isNum(42);
    `,
    );

    // SyncAutoInstaller needs XMLHttpRequest, unavailable in Node/Vitest.
    expect(() => container.runFile("/auto.js")).toThrow();
  });
});
