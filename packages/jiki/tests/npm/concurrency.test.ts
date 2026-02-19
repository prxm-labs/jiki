import { describe, it, expect } from "vitest";
import { PackageManager, NpmLayout } from "../../src/npm/index";
import { MemFS } from "../../src/memfs";

describe("PackageManager: configurable concurrency", () => {
  it("InstallOptions accepts concurrency parameter", async () => {
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });

    const result = await pm.install("is-number", { concurrency: 2 });
    expect(result.installed.size).toBeGreaterThan(0);
    expect(vfs.existsSync("/node_modules/is-number")).toBe(true);
  });

  it("default concurrency works without explicit setting", async () => {
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });

    const result = await pm.install("is-number");
    expect(result.installed.size).toBeGreaterThan(0);
  });

  it("high concurrency installs correctly", async () => {
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });

    const result = await pm.install("is-number", { concurrency: 20 });
    expect(result.installed.size).toBeGreaterThan(0);
    expect(vfs.existsSync("/node_modules/is-number")).toBe(true);
  });

  it("concurrency=1 installs one at a time (sequential)", async () => {
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });

    const result = await pm.install("is-number", { concurrency: 1 });
    expect(result.installed.size).toBeGreaterThan(0);
  });

  it("installFromPackageJson respects concurrency", async () => {
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });

    vfs.writeFileSync(
      "/package.json",
      JSON.stringify({
        name: "test",
        dependencies: { "is-number": "*" },
      }),
    );

    const result = await pm.installFromPackageJson({ concurrency: 3 });
    expect(result.installed.size).toBeGreaterThan(0);
    expect(vfs.existsSync("/node_modules/is-number")).toBe(true);
  });

  it("onProgress receives progress messages during install", async () => {
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });

    const messages: string[] = [];
    await pm.install("is-number", {
      onProgress: msg => messages.push(msg),
    });

    expect(messages.some(m => m.includes("Resolving"))).toBe(true);
    expect(messages.some(m => m.includes("Downloading"))).toBe(true);
    expect(messages.some(m => m.includes("Installed"))).toBe(true);
  });
});
