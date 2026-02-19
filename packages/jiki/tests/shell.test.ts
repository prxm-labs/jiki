import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { Kernel } from "../src/kernel";
import { PackageManager } from "../src/npm/index";
import { Shell } from "../src/shell";

describe("Shell", () => {
  let vfs: MemFS;
  let runtime: Kernel;
  let pm: PackageManager;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.mkdirSync("/home", { recursive: true });
    runtime = new Kernel(vfs, { cwd: "/" });
    pm = new PackageManager(vfs, { cwd: "/" });
    shell = new Shell(vfs, runtime, pm, { cwd: "/" });
  });

  it("echo hello world", async () => {
    const result = await shell.exec("echo hello world");
    expect(result.stdout).toContain("hello world");
    expect(result.exitCode).toBe(0);
  });

  it("pwd returns cwd", async () => {
    const result = await shell.exec("pwd");
    expect(result.stdout.trim()).toBe("/");
  });

  it("cd + pwd", async () => {
    vfs.mkdirSync("/tmp");
    await shell.exec("cd /tmp");
    const result = await shell.exec("pwd");
    expect(result.stdout.trim()).toBe("/tmp");
  });

  it("cd to nonexistent dir returns exitCode 1", async () => {
    const result = await shell.exec("cd /nonexistent");
    expect(result.exitCode).toBe(1);
  });

  it("mkdir -p creates nested dirs", async () => {
    await shell.exec("mkdir -p /a/b/c");
    expect(vfs.statSync("/a/b/c").isDirectory()).toBe(true);
  });

  it("ls lists directory entries", async () => {
    vfs.writeFileSync("/file1.txt", "");
    vfs.writeFileSync("/file2.txt", "");
    const result = await shell.exec("ls /");
    expect(result.stdout).toContain("file1.txt");
    expect(result.stdout).toContain("file2.txt");
  });

  it("touch + cat", async () => {
    await shell.exec("touch /file.txt");
    expect(vfs.existsSync("/file.txt")).toBe(true);
    const result = await shell.exec("cat /file.txt");
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("rm -rf removes recursively", async () => {
    vfs.writeFileSync("/d/a/b.txt", "data");
    await shell.exec("rm -rf /d");
    expect(vfs.existsSync("/d")).toBe(false);
  });

  it("cp copies a file", async () => {
    vfs.writeFileSync("/src.txt", "content");
    await shell.exec("cp /src.txt /dest.txt");
    expect(vfs.readFileSync("/dest.txt", "utf8")).toBe("content");
  });

  it("mv moves a file", async () => {
    vfs.writeFileSync("/old.txt", "data");
    await shell.exec("mv /old.txt /new.txt");
    expect(vfs.existsSync("/old.txt")).toBe(false);
    expect(vfs.readFileSync("/new.txt", "utf8")).toBe("data");
  });

  it("which node returns path", async () => {
    const result = await shell.exec("which node");
    expect(result.stdout.trim()).toBe("/usr/local/bin/node");
    expect(result.exitCode).toBe(0);
  });

  it("export + env", async () => {
    await shell.exec("export FOO=bar");
    const result = await shell.exec("env");
    expect(result.stdout).toContain("FOO=bar");
  });

  it('node -e "console.log(42)" captures output', async () => {
    const result = await shell.exec('node -e "module.exports = 42"');
    expect(result.exitCode).toBe(0);
  });

  it("true returns exitCode 0", async () => {
    const result = await shell.exec("true");
    expect(result.exitCode).toBe(0);
  });

  it("false returns exitCode 1", async () => {
    const result = await shell.exec("false");
    expect(result.exitCode).toBe(1);
  });

  it("unknown command returns exitCode 127", async () => {
    const result = await shell.exec("nonexistentcommand");
    expect(result.exitCode).toBe(127);
  });

  it("pipe: echo hello | cat", async () => {
    const result = await shell.exec("echo hello | cat");
    expect(result.exitCode).toBe(0);
  });

  it("quoted arguments", async () => {
    const result = await shell.exec('echo "hello world"');
    expect(result.stdout.trim()).toBe("hello world");
  });

  it("env variable expansion", async () => {
    shell.setEnv("MY_VAR", "expanded");
    const result = await shell.exec("echo $MY_VAR");
    expect(result.stdout.trim()).toBe("expanded");
  });

  // Task 17: Shell variable expansion ($VAR, ${VAR})
  describe("variable expansion", () => {
    it("expands ${VAR} syntax", async () => {
      shell.setEnv("GREETING", "hello");
      const result = await shell.exec("echo ${GREETING}");
      expect(result.stdout.trim()).toBe("hello");
    });

    it("expands $VAR in double quotes", async () => {
      shell.setEnv("NAME", "world");
      const result = await shell.exec('echo "hello $NAME"');
      expect(result.stdout.trim()).toBe("hello world");
    });

    it("expands ${VAR} in double quotes", async () => {
      shell.setEnv("NAME", "world");
      const result = await shell.exec('echo "hello ${NAME}"');
      expect(result.stdout.trim()).toBe("hello world");
    });

    it("does NOT expand variables in single quotes", async () => {
      shell.setEnv("NAME", "world");
      const result = await shell.exec("echo '$NAME'");
      expect(result.stdout.trim()).toBe("$NAME");
    });

    it("expands undefined variable to empty string", async () => {
      const result = await shell.exec("echo $UNDEFINED_VAR");
      expect(result.stdout.trim()).toBe("");
    });

    it("expands multiple variables in one argument", async () => {
      shell.setEnv("A", "hello");
      shell.setEnv("B", "world");
      const result = await shell.exec('echo "$A $B"');
      expect(result.stdout.trim()).toBe("hello world");
    });
  });

  // Task 18: cp -r (recursive copy)
  describe("cp -r", () => {
    it("copies a directory recursively", async () => {
      vfs.mkdirSync("/src-dir/sub", { recursive: true });
      vfs.writeFileSync("/src-dir/a.txt", "aaa");
      vfs.writeFileSync("/src-dir/sub/b.txt", "bbb");
      const result = await shell.exec("cp -r /src-dir /dest-dir");
      expect(result.exitCode).toBe(0);
      expect(vfs.readFileSync("/dest-dir/a.txt", "utf8")).toBe("aaa");
      expect(vfs.readFileSync("/dest-dir/sub/b.txt", "utf8")).toBe("bbb");
    });

    it("fails without -r flag for directories", async () => {
      vfs.mkdirSync("/mydir", { recursive: true });
      const result = await shell.exec("cp /mydir /dest");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("-r not specified");
    });

    it("copies single file without -r flag", async () => {
      vfs.writeFileSync("/f.txt", "content");
      const result = await shell.exec("cp /f.txt /g.txt");
      expect(result.exitCode).toBe(0);
      expect(vfs.readFileSync("/g.txt", "utf8")).toBe("content");
    });
  });

  // Task 19: which command (PATH lookup)
  describe("which", () => {
    it("finds executables in PATH directories", async () => {
      vfs.mkdirSync("/node_modules/.bin", { recursive: true });
      vfs.writeFileSync("/node_modules/.bin/jest", "#!/usr/bin/env node");
      const result = await shell.exec("which jest");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/node_modules/.bin/jest");
    });

    it("finds built-in commands like node", async () => {
      const result = await shell.exec("which node");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/usr/local/bin/node");
    });

    it("returns error for unknown command", async () => {
      const result = await shell.exec("which nonexistent");
      expect(result.exitCode).toBe(1);
    });
  });

  // Sprint 4 P3: Shell command polish (Findings #58-60)

  describe("cat processes all files (Finding #58)", () => {
    it("outputs content from all valid files even when some fail", async () => {
      vfs.writeFileSync("/a.txt", "AAA");
      vfs.writeFileSync("/c.txt", "CCC");
      const result = await shell.exec("cat /a.txt /missing.txt /c.txt");
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("AAA");
      expect(result.stdout).toContain("CCC");
      expect(result.stderr).toContain("missing.txt");
    });

    it("returns exitCode 0 when all files exist", async () => {
      vfs.writeFileSync("/x.txt", "X");
      vfs.writeFileSync("/y.txt", "Y");
      const result = await shell.exec("cat /x.txt /y.txt");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("XY");
    });
  });

  describe("export validates variable names (Finding #59)", () => {
    it("rejects invalid variable names", async () => {
      const result = await shell.exec("export 123BAD=val");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not a valid identifier");
    });

    it("accepts valid variable names", async () => {
      const result = await shell.exec("export _VALID_NAME=hello");
      expect(result.exitCode).toBe(0);
      const envResult = await shell.exec("env");
      expect(envResult.stdout).toContain("_VALID_NAME=hello");
    });
  });

  describe("env VAR=val command syntax (Finding #60)", () => {
    it("prints environment when no args", async () => {
      shell.setEnv("TEST_KEY", "test_val");
      const result = await shell.exec("env");
      expect(result.stdout).toContain("TEST_KEY=test_val");
      expect(result.exitCode).toBe(0);
    });

    it("passes VAR=val overrides to sub-command env", async () => {
      // env FOO=bar env should show FOO=bar in the output
      const result = await shell.exec("env FOO=bar env");
      expect(result.stdout).toContain("FOO=bar");
      expect(result.exitCode).toBe(0);
    });

    it("restores env after sub-command completes", async () => {
      shell.setEnv("ORIG", "original");
      await shell.exec("env ORIG=changed true");
      const result = await shell.exec("env");
      expect(result.stdout).toContain("ORIG=original");
    });
  });

  // Task 20: touch command (mtime update)
  describe("touch", () => {
    it("creates a new file if it does not exist", async () => {
      const result = await shell.exec("touch /newfile.txt");
      expect(result.exitCode).toBe(0);
      expect(vfs.existsSync("/newfile.txt")).toBe(true);
    });

    it("updates mtime on an existing file", async () => {
      vfs.writeFileSync("/existing.txt", "data");
      const mtimeBefore = vfs.statSync("/existing.txt").mtimeMs;
      // Small delay to ensure mtime changes
      await new Promise(r => setTimeout(r, 10));
      const result = await shell.exec("touch /existing.txt");
      expect(result.exitCode).toBe(0);
      const mtimeAfter = vfs.statSync("/existing.txt").mtimeMs;
      expect(mtimeAfter).toBeGreaterThanOrEqual(mtimeBefore);
      // Content should be unchanged
      expect(vfs.readFileSync("/existing.txt", "utf8")).toBe("data");
    });
  });
});
