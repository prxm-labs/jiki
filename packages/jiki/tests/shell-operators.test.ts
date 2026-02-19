// tests/shell-operators.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Shell } from "../src/shell";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager } from "../src/npm/index";

describe("shell control flow operators", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/");
    const kernel = new Kernel(vfs, {});
    const pm = new PackageManager(vfs, {});
    shell = new Shell(vfs, kernel, pm, { cwd: "/" });
  });

  it("&& runs second command when first succeeds", async () => {
    vfs.writeFileSync("/a.txt", "hello");
    const result = await shell.exec("echo first && echo second");
    expect(result.stdout).toContain("first");
    expect(result.stdout).toContain("second");
    expect(result.exitCode).toBe(0);
  });

  it("&& skips second command when first fails", async () => {
    const result = await shell.exec(
      "cat /nonexistent && echo should-not-appear",
    );
    expect(result.stdout).not.toContain("should-not-appear");
    expect(result.exitCode).not.toBe(0);
  });

  it("|| runs second command when first fails", async () => {
    const result = await shell.exec("cat /nonexistent || echo fallback");
    expect(result.stdout).toContain("fallback");
  });

  it("|| skips second command when first succeeds", async () => {
    const result = await shell.exec("echo ok || echo should-not-appear");
    expect(result.stdout).toContain("ok");
    expect(result.stdout).not.toContain("should-not-appear");
  });

  it("&& skips entire chain when first fails", async () => {
    const result = await shell.exec("cat /nonexistent && echo B && echo C");
    expect(result.stdout).not.toContain("B");
    expect(result.stdout).not.toContain("C");
  });

  it("false && B || C runs C as fallback", async () => {
    const result = await shell.exec("cat /nonexistent && echo B || echo C");
    expect(result.stdout).not.toContain("B");
    expect(result.stdout).toContain("C");
  });

  it("; always runs both commands", async () => {
    const result = await shell.exec("echo first ; echo second");
    expect(result.stdout).toContain("first");
    expect(result.stdout).toContain("second");
  });

  it("; runs second even when first fails", async () => {
    const result = await shell.exec("cat /nonexistent ; echo ran-anyway");
    expect(result.stdout).toContain("ran-anyway");
  });
});
