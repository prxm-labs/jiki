// tests/shell-glob.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Shell } from "../src/shell";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager } from "../src/npm/index";

describe("shell glob expansion", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.writeFileSync("/a.js", "");
    vfs.writeFileSync("/b.js", "");
    vfs.writeFileSync("/c.ts", "");
    const kernel = new Kernel(vfs, {});
    const pm = new PackageManager(vfs, {});
    shell = new Shell(vfs, kernel, pm, { cwd: "/" });
  });

  it("expands *.js to matching files", async () => {
    const result = await shell.exec("echo *.js");
    expect(result.stdout).toContain("a.js");
    expect(result.stdout).toContain("b.js");
    expect(result.stdout).not.toContain("c.ts");
  });

  it("passes literal when no match found", async () => {
    const result = await shell.exec("echo *.xyz");
    expect(result.stdout).toContain("*.xyz");
  });

  it("expands ? wildcard for single characters", async () => {
    const result = await shell.exec("echo ?.js");
    expect(result.stdout).toContain("a.js");
    expect(result.stdout).toContain("b.js");
  });

  it("does not expand patterns inside quotes", async () => {
    const result = await shell.exec('echo "*.js"');
    expect(result.stdout).toContain("*.js");
  });

  it("dots are matched literally not as wildcards", async () => {
    vfs.writeFileSync("/aXjs", "");
    const result = await shell.exec("echo *.js");
    expect(result.stdout).not.toContain("aXjs");
  });
});
