import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager, NpmLayout } from "../src/npm/index";
import { Shell } from "../src/shell";

describe("Shell binary path cache", () => {
  let vfs: MemFS;
  let runtime: Kernel;
  let pm: PackageManager;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
    pm = new PackageManager(vfs, { cwd: "/", layout: new NpmLayout() });
    shell = new Shell(vfs, runtime, pm);
  });

  it("caches resolved binary path on first lookup", async () => {
    vfs.mkdirSync("/node_modules/.bin", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/.bin/mybin",
      '#!/usr/bin/env node\nmodule.exports = "ok";',
    );

    const result1 = await shell.exec("mybin");
    expect(result1.exitCode).toBe(0);

    const result2 = await shell.exec("mybin");
    expect(result2.exitCode).toBe(0);
  });

  it("clearBinCache forces fresh lookup", async () => {
    vfs.mkdirSync("/node_modules/.bin", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/.bin/mybin",
      '#!/usr/bin/env node\nconsole.log("hi");',
    );

    await shell.exec("mybin");
    vfs.rmSync("/node_modules/.bin/mybin", { force: true });

    shell.clearBinCache();
    const result = await shell.exec("mybin");
    expect(result.exitCode).toBe(127);
  });

  it("does not cache missing binaries", async () => {
    const result1 = await shell.exec("nonexistent");
    expect(result1.exitCode).toBe(127);

    vfs.mkdirSync("/node_modules/.bin", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/.bin/nonexistent",
      '#!/usr/bin/env node\nconsole.log("found");',
    );

    const result2 = await shell.exec("nonexistent");
    expect(result2.exitCode).toBe(0);
  });

  it("built-in commands bypass bin cache", async () => {
    const result = await shell.exec("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello");
  });
});
