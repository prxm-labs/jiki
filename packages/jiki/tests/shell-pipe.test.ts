// tests/shell-pipe.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Shell } from "../src/shell";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager } from "../src/npm/index";

describe("shell pipe stdin", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    const kernel = new Kernel(vfs, {});
    const pm = new PackageManager(vfs, {});
    shell = new Shell(vfs, kernel, pm, { cwd: "/" });
  });

  it("echo piped to cat passes data through", async () => {
    // Simple test: echo output becomes next command's context
    const result = await shell.exec("echo hello | cat");
    // cat should receive "hello" from stdin
    expect(result.stdout.trim()).toContain("hello");
  });

  it("cat with no args reads from stdin (pipe)", async () => {
    // Register a custom command that uppercases its stdin
    shell.registerCommand("upper", (args, ctx) => {
      // stdinData should be available on the context
      const input = ctx.stdinData || "";
      return { stdout: input.toUpperCase(), stderr: "", exitCode: 0 };
    });
    const result = await shell.exec("echo hello world | upper");
    expect(result.stdout.trim()).toBe("HELLO WORLD");
  });

  it("multi-stage pipe threads stdin through each segment", async () => {
    // Register commands that transform stdin
    shell.registerCommand("append-foo", (_args, ctx) => {
      const input = ctx.stdinData || "";
      return { stdout: input.trim() + "-foo\n", stderr: "", exitCode: 0 };
    });
    shell.registerCommand("append-bar", (_args, ctx) => {
      const input = ctx.stdinData || "";
      return { stdout: input.trim() + "-bar\n", stderr: "", exitCode: 0 };
    });
    const result = await shell.exec("echo start | append-foo | append-bar");
    expect(result.stdout.trim()).toBe("start-foo-bar");
  });
});
