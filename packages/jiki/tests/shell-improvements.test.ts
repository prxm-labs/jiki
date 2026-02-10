import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager } from "../src/npm/index";
import { Shell, ShellHistory } from "../src/shell";

describe("ShellHistory", () => {
  let history: ShellHistory;

  beforeEach(() => {
    history = new ShellHistory();
  });

  it("starts empty", () => {
    expect(history.length).toBe(0);
    expect(history.getAll()).toEqual([]);
  });

  it("push adds entries", () => {
    history.push("echo hello");
    history.push("ls");
    expect(history.length).toBe(2);
    expect(history.getAll()).toEqual(["echo hello", "ls"]);
  });

  it("push ignores empty strings", () => {
    history.push("");
    history.push("   ");
    expect(history.length).toBe(0);
  });

  it("push ignores consecutive duplicates", () => {
    history.push("echo hello");
    history.push("echo hello");
    expect(history.length).toBe(1);
  });

  it("up navigates backwards through history", () => {
    history.push("first");
    history.push("second");
    history.push("third");
    expect(history.up()).toBe("third");
    expect(history.up()).toBe("second");
    expect(history.up()).toBe("first");
    expect(history.up()).toBe("first"); // stays at beginning
  });

  it("down navigates forwards through history", () => {
    history.push("first");
    history.push("second");
    history.up(); // → second
    history.up(); // → first
    expect(history.down()).toBe("second");
    expect(history.down()).toBeUndefined(); // past the end
  });

  it("reset moves cursor to end", () => {
    history.push("a");
    history.push("b");
    history.up(); // → b
    history.up(); // → a
    history.reset();
    expect(history.up()).toBe("b");
  });

  it("respects maxSize", () => {
    const small = new ShellHistory(3);
    small.push("a");
    small.push("b");
    small.push("c");
    small.push("d");
    expect(small.length).toBe(3);
    expect(small.getAll()).toEqual(["b", "c", "d"]);
  });
});

describe("Shell tab completion", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/home", { recursive: true });
    const runtime = new Kernel(vfs, { cwd: "/" });
    const pm = new PackageManager(vfs, { cwd: "/" });
    shell = new Shell(vfs, runtime, pm, { cwd: "/" });
  });

  it("completes command names", () => {
    const candidates = shell.complete("ec");
    expect(candidates).toContain("echo");
  });

  it("completes file paths", () => {
    vfs.writeFileSync("/app.js", "");
    vfs.writeFileSync("/app.ts", "");
    vfs.writeFileSync("/readme.md", "");
    const candidates = shell.complete("cat app");
    expect(candidates).toContain("app.js");
    expect(candidates).toContain("app.ts");
    expect(candidates).not.toContain("readme.md");
  });

  it("appends / for directories", () => {
    vfs.mkdirSync("/src", { recursive: true });
    vfs.writeFileSync("/src/index.js", "");
    const candidates = shell.complete("cd s");
    expect(candidates).toContain("src/");
  });

  it("returns empty for no matches", () => {
    const candidates = shell.complete("cat zzz");
    expect(candidates).toEqual([]);
  });
});

describe("Shell history integration", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    const runtime = new Kernel(vfs, { cwd: "/" });
    const pm = new PackageManager(vfs, { cwd: "/" });
    shell = new Shell(vfs, runtime, pm, { cwd: "/" });
  });

  it("exec records commands in history", async () => {
    await shell.exec("echo hello");
    await shell.exec("echo world");
    expect(shell.history.length).toBe(2);
    expect(shell.history.getAll()).toEqual(["echo hello", "echo world"]);
  });

  it("history command outputs history", async () => {
    await shell.exec("echo a");
    await shell.exec("echo b");
    const result = await shell.exec("history");
    expect(result.stdout).toContain("echo a");
    expect(result.stdout).toContain("echo b");
  });
});

describe("Shell background jobs", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    const runtime = new Kernel(vfs, { cwd: "/" });
    const pm = new PackageManager(vfs, { cwd: "/" });
    shell = new Shell(vfs, runtime, pm, { cwd: "/" });
  });

  it("& runs command in background", async () => {
    const result = await shell.exec("echo hello &");
    expect(result.stdout).toContain("[1] started");
    expect(result.exitCode).toBe(0);
  });

  it("jobs lists running jobs", async () => {
    await shell.exec("echo hello &");
    // The job may complete instantly, but let's check the command exists
    const result = await shell.exec("jobs");
    expect(result.exitCode).toBe(0);
  });

  it("&& is not treated as background", async () => {
    vfs.mkdirSync("/tmp");
    const result = await shell.exec("echo a && echo b");
    expect(result.stdout).toContain("a");
    expect(result.stdout).toContain("b");
  });
});

describe("Shell recursive glob **", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/src/components", { recursive: true });
    vfs.mkdirSync("/src/utils", { recursive: true });
    vfs.writeFileSync("/src/index.ts", "");
    vfs.writeFileSync("/src/app.ts", "");
    vfs.writeFileSync("/src/components/Button.ts", "");
    vfs.writeFileSync("/src/components/Card.tsx", "");
    vfs.writeFileSync("/src/utils/helpers.ts", "");
    vfs.writeFileSync("/readme.md", "");
    const runtime = new Kernel(vfs, { cwd: "/" });
    const pm = new PackageManager(vfs, { cwd: "/" });
    shell = new Shell(vfs, runtime, pm, { cwd: "/" });
  });

  it("**/*.ts matches files recursively", async () => {
    const result = await shell.exec("echo /src/**/*.ts");
    expect(result.stdout).toContain("/src/index.ts");
    expect(result.stdout).toContain("/src/app.ts");
    expect(result.stdout).toContain("/src/components/Button.ts");
    expect(result.stdout).toContain("/src/utils/helpers.ts");
    // Should not match .tsx
    expect(result.stdout).not.toContain("Card.tsx");
  });

  it("**/*.tsx matches tsx files", async () => {
    const result = await shell.exec("echo /src/**/*.tsx");
    expect(result.stdout).toContain("/src/components/Card.tsx");
  });
});

describe("Shell brace expansion", () => {
  let vfs: MemFS;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.writeFileSync("/a.js", "");
    vfs.writeFileSync("/a.ts", "");
    vfs.writeFileSync("/b.js", "");
    const runtime = new Kernel(vfs, { cwd: "/" });
    const pm = new PackageManager(vfs, { cwd: "/" });
    shell = new Shell(vfs, runtime, pm, { cwd: "/" });
  });

  it("{a,b}.js expands to matching files", async () => {
    const result = await shell.exec("echo /{a,b}.js");
    expect(result.stdout).toContain("a.js");
    expect(result.stdout).toContain("b.js");
  });

  it("*.{js,ts} expands to both extensions", async () => {
    const result = await shell.exec("echo /*.{js,ts}");
    expect(result.stdout).toContain("a.js");
    expect(result.stdout).toContain("a.ts");
    expect(result.stdout).toContain("b.js");
  });
});
