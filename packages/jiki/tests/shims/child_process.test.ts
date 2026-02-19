import { describe, it, expect, vi } from "vitest";
import { spawn, ChildProcess } from "../../src/polyfills/child_process";

describe("child_process stdio", () => {
  it('spawn accepts stdio option "pipe" and has stdout/stderr', () => {
    const cp = spawn("node", ["-e", 'console.log("hi")'], { stdio: "pipe" });
    expect(cp.stdout).toBeDefined();
    expect(cp.stderr).toBeDefined();
    expect(cp.stdin).toBeDefined();
  });

  it('spawn with stdio "ignore" nullifies streams', () => {
    const cp = spawn("node", ["-e", "1"], { stdio: "ignore" });
    expect(cp.stdout).toBeNull();
    expect(cp.stderr).toBeNull();
    expect(cp.stdin).toBeNull();
  });

  it("spawn with stdio array supports per-fd configuration", () => {
    const cp = spawn("node", [], { stdio: ["pipe", "ignore", "pipe"] });
    expect(cp.stdin).toBeDefined();
    expect(cp.stdout).toBeNull();
    expect(cp.stderr).toBeDefined();
  });

  it("spawn with stdio ipc channel sets connected", () => {
    const cp = spawn("node", [], { stdio: ["pipe", "pipe", "pipe", "ipc"] });
    expect(cp.connected).toBe(true);
  });

  it("spawn accepts shell option", () => {
    const cp = spawn("echo", ["hello"], { shell: true });
    expect(cp).toBeDefined();
    expect(cp.spawnfile).toBe("/bin/sh");
    expect(cp.spawnargs[0]).toBe("/bin/sh");
    expect(cp.spawnargs[1]).toBe("-c");
  });

  it("spawn with shell as string uses that shell", () => {
    const cp = spawn("echo", ["hello"], { shell: "/bin/bash" });
    expect(cp.spawnfile).toBe("/bin/bash");
  });

  it("spawn without options still works", () => {
    const cp = spawn("ls", ["-la"]);
    expect(cp).toBeInstanceOf(ChildProcess);
    expect(cp.stdout).toBeDefined();
    expect(cp.stderr).toBeDefined();
  });
});
