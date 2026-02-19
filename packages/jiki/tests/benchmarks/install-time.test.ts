import { describe, it, expect } from "vitest";
import { boot } from "../../src/container";
import { PackageManager, NpmLayout } from "../../src/npm/index";
import { MemFS } from "../../src/memfs";

describe("Benchmark: install time", () => {
  it("install a package with transitive deps completes in reasonable time", async () => {
    const container = boot();

    const start = performance.now();
    await container.install("is-odd");
    const installTime = performance.now() - start;

    expect(container.exists("/node_modules/is-odd")).toBe(true);
    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(installTime).toBeLessThan(30000);

    container.destroy();
  });

  it("re-installing an already installed package is near-instant", async () => {
    const container = boot();
    await container.install("is-number");

    const start = performance.now();
    await container.install("is-number");
    const reinstallTime = performance.now() - start;

    expect(reinstallTime).toBeLessThan(2000);

    container.destroy();
  });

  it("concurrency=1 vs default concurrency both complete correctly", async () => {
    const vfs1 = new MemFS();
    const pm1 = new PackageManager(vfs1, { cwd: "/", layout: new NpmLayout() });

    const vfs2 = new MemFS();
    const pm2 = new PackageManager(vfs2, { cwd: "/", layout: new NpmLayout() });

    const start1 = performance.now();
    await pm1.install("is-odd", { concurrency: 1 });
    const time1 = performance.now() - start1;

    const start2 = performance.now();
    await pm2.install("is-odd", { concurrency: 12 });
    const time2 = performance.now() - start2;

    expect(vfs1.existsSync("/node_modules/is-odd")).toBe(true);
    expect(vfs2.existsSync("/node_modules/is-odd")).toBe(true);

    expect(time1).toBeLessThan(30000);
    expect(time2).toBeLessThan(30000);
  });

  it("onProgress reports meaningful progress steps", async () => {
    const container = boot();
    const messages: string[] = [];

    await container.install("is-number", {
      onProgress: msg => messages.push(msg),
    });

    expect(messages.length).toBeGreaterThanOrEqual(3);
    expect(messages.some(m => m.includes("Resolving"))).toBe(true);
    expect(
      messages.some(m => m.includes("Downloading") || m.includes("Installing")),
    ).toBe(true);
    expect(messages.some(m => m.includes("Installed"))).toBe(true);

    container.destroy();
  });

  it("installing multiple packages in one call", async () => {
    const container = boot();

    const start = performance.now();
    const result = await container.install(["is-number", "is-odd"]);
    const installTime = performance.now() - start;

    expect(result.installed.size).toBeGreaterThanOrEqual(2);
    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(container.exists("/node_modules/is-odd")).toBe(true);
    expect(installTime).toBeLessThan(30000);

    container.destroy();
  });
});
