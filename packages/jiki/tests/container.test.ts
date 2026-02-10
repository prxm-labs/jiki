import { describe, it, expect, beforeEach } from "vitest";
import { Container, boot, createContainer } from "../src/container";

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = boot();
  });

  it("boot returns Container with expected properties", () => {
    expect(container.vfs).toBeDefined();
    expect(container.runtime).toBeDefined();
    expect(container.shell).toBeDefined();
    expect(container.packageManager).toBeDefined();
  });

  it("writeFile + readFile round-trip", () => {
    container.writeFile("/test.txt", "hello");
    expect(container.readFile("/test.txt")).toBe("hello");
  });

  it("writeFile creates parent directories", () => {
    container.writeFile("/a/b/c.txt", "deep");
    expect(container.readFile("/a/b/c.txt")).toBe("deep");
  });

  it("mkdir + readdir", () => {
    container.mkdir("/mydir");
    container.writeFile("/mydir/a.txt", "");
    const entries = container.readdir("/mydir");
    expect(entries).toContain("a.txt");
  });

  it("exists for existing and missing paths", () => {
    container.writeFile("/f.txt", "");
    expect(container.exists("/f.txt")).toBe(true);
    expect(container.exists("/nope.txt")).toBe(false);
  });

  it("execute runs code and returns result", () => {
    const result = container.execute("module.exports = 42;");
    expect(result.exports).toBe(42);
  });

  it("runFile executes from VFS", () => {
    container.writeFile("/test.js", 'module.exports = "works";');
    const result = container.runFile("/test.js");
    expect(result.exports).toBe("works");
  });

  it("toSnapshot + fromSnapshot preserves state", () => {
    container.writeFile("/a.txt", "alpha");
    container.writeFile("/b.txt", "beta");
    const snapshot = container.toSnapshot();

    const restored = Container.fromSnapshot(snapshot);
    expect(restored.readFile("/a.txt")).toBe("alpha");
    expect(restored.readFile("/b.txt")).toBe("beta");
  });

  it("export returns JSON tree", () => {
    container.writeFile("/file.txt", "content");
    const tree = container.export("/");
    expect(tree["file.txt"]).toEqual({ file: { contents: "content" } });
  });

  it("rm removes files and directories", () => {
    container.writeFile("/d/f.txt", "data");
    container.rm("/d");
    expect(container.exists("/d")).toBe(false);
  });

  it("destroy clears runtime cache", () => {
    container.execute("module.exports = 1;");
    container.destroy();
    const result = container.execute("module.exports = 2;");
    expect(result.exports).toBe(2);
  });

  describe("constructor options", () => {
    it("accepts custom cwd and uses it for shell", async () => {
      const c = new Container({ cwd: "/workspace" });
      c.mkdir("/workspace");
      const result = await c.run("pwd");
      expect(result.stdout.trim()).toBe("/workspace");
    });

    it("passes env to process.env inside executed code", () => {
      const c = new Container({ env: { APP_MODE: "test" } });
      const result = c.execute("module.exports = process.env.APP_MODE;");
      expect(result.exports).toBe("test");
    });

    it("onConsole callback receives console.log output", () => {
      const captured: { method: string; args: unknown[] }[] = [];
      const c = new Container({
        onConsole: (method, args) => captured.push({ method, args }),
      });
      c.execute('console.log("ping", 123);');
      expect(captured.length).toBeGreaterThan(0);
      const logEntry = captured.find(e => e.method === "log");
      expect(logEntry).toBeDefined();
      expect(logEntry!.args[0]).toBe("ping");
    });

    it("packageManager option pnpm creates a working container", () => {
      const c = new Container({ packageManager: "pnpm" });
      expect(c.packageManager).toBeDefined();
      expect(c.shell).toBeDefined();
    });
  });

  describe("readFile binary", () => {
    it("readFile with encoding null returns Uint8Array", () => {
      const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      container.writeFile("/bin.dat", bytes);
      const result = container.readFile("/bin.dat", null);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result[0]).toBe(0xde);
      expect(result[3]).toBe(0xef);
    });

    it("readFile without encoding returns utf8 string", () => {
      container.writeFile("/text.txt", "hello");
      const result = container.readFile("/text.txt");
      expect(typeof result).toBe("string");
      expect(result).toBe("hello");
    });
  });

  describe("run (shell commands via container)", () => {
    it("runs echo and captures stdout", async () => {
      const result = await container.run("echo hello from run");
      expect(result.stdout).toContain("hello from run");
      expect(result.exitCode).toBe(0);
    });

    it("runs pwd and returns root by default", async () => {
      const result = await container.run("pwd");
      expect(result.stdout.trim()).toBe("/");
    });

    it("runs unknown command and returns exit code 127", async () => {
      const result = await container.run("doesnotexist");
      expect(result.exitCode).toBe(127);
    });

    it("streaming onStdout callback receives data", async () => {
      const chunks: string[] = [];
      container.writeFile("/greet.js", 'console.log("streamed");');
      const result = await container.run("node /greet.js", {
        onStdout: data => chunks.push(data),
      });
      expect(result.exitCode).toBe(0);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join("")).toContain("streamed");
    });

    it("streaming onStderr callback receives error output", async () => {
      const errChunks: string[] = [];
      container.writeFile("/warn.js", 'console.error("oops");');
      const result = await container.run("node /warn.js", {
        onStderr: data => errChunks.push(data),
      });
      expect(result.exitCode).toBe(0);
      expect(errChunks.join("")).toContain("oops");
    });
  });

  describe("install", () => {
    it("install writes node_modules to VFS", async () => {
      await container.install("is-odd");
      expect(container.exists("/node_modules/is-odd")).toBe(true);
    });

    it("installDependencies reads from package.json", async () => {
      container.writeFile(
        "/package.json",
        JSON.stringify({
          name: "test",
          dependencies: { "is-odd": "*" },
        }),
      );
      await container.installDependencies();
      expect(container.exists("/node_modules/is-odd")).toBe(true);
    });
  });

  describe("fromSnapshot with options", () => {
    it("preserves files and applies new options", () => {
      container.writeFile("/data.txt", "important");
      const snap = container.toSnapshot();

      const restored = Container.fromSnapshot(snap, { cwd: "/home" });
      expect(restored.readFile("/data.txt")).toBe("important");
      expect(restored.vfs).toBeDefined();
      expect(restored.runtime).toBeDefined();
    });

    it("snapshot round-trip preserves nested directories", () => {
      container.mkdir("/x/y/z");
      container.writeFile("/x/y/z/deep.txt", "found");
      const snap = container.toSnapshot();

      const restored = Container.fromSnapshot(snap);
      expect(restored.readFile("/x/y/z/deep.txt")).toBe("found");
    });
  });

  describe("export edge cases", () => {
    it("export with nested directories", () => {
      container.mkdir("/project/src");
      container.writeFile("/project/src/index.js", "main");
      container.writeFile("/project/README.md", "# Hi");
      const tree = container.export("/project");
      expect((tree["src"] as any).directory["index.js"]).toEqual({
        file: { contents: "main" },
      });
      expect(tree["README.md"]).toEqual({ file: { contents: "# Hi" } });
    });

    it("export returns empty object for empty directory", () => {
      container.mkdir("/empty");
      const tree = container.export("/empty");
      expect(Object.keys(tree)).toHaveLength(0);
    });
  });

  describe("error propagation", () => {
    it("execute with syntax error throws", () => {
      expect(() => container.execute("module.exports = {{")).toThrow();
    });

    it("runFile on missing file throws", () => {
      expect(() => container.runFile("/nonexistent.js")).toThrow();
    });

    it("readFile on missing file throws", () => {
      expect(() => container.readFile("/nope.txt")).toThrow(/ENOENT/);
    });
  });

  describe("container isolation", () => {
    it("two containers have independent VFS", () => {
      const c1 = boot();
      const c2 = boot();
      c1.writeFile("/only-in-c1.txt", "c1");
      expect(c1.exists("/only-in-c1.txt")).toBe(true);
      expect(c2.exists("/only-in-c1.txt")).toBe(false);
    });

    it("two containers have independent module caches", () => {
      const c1 = boot();
      const c2 = boot();
      c1.writeFile("/mod.js", 'module.exports = "from-c1";');
      c2.writeFile("/mod.js", 'module.exports = "from-c2";');
      expect(c1.runFile("/mod.js").exports).toBe("from-c1");
      expect(c2.runFile("/mod.js").exports).toBe("from-c2");
    });
  });

  describe("destroy behavior", () => {
    it("destroy allows fresh module loading", () => {
      container.writeFile("/counter.js", "module.exports = Math.random();");
      const first = container.runFile("/counter.js").exports;
      container.destroy();
      const second = container.runFile("/counter.js").exports;
      expect(first).not.toBe(second);
    });

    it("destroy does not break VFS access", () => {
      container.writeFile("/keep.txt", "still here");
      container.destroy();
      expect(container.readFile("/keep.txt")).toBe("still here");
    });
  });

  describe("boot and createContainer aliases", () => {
    it("boot and createContainer are the same function", () => {
      expect(boot).toBe(createContainer);
    });

    it("createContainer returns a functional Container", () => {
      const c = createContainer();
      c.writeFile("/test.txt", "ok");
      expect(c.readFile("/test.txt")).toBe("ok");
    });
  });

  describe("init", () => {
    it("init resolves without error", async () => {
      await expect(container.init()).resolves.toBeUndefined();
    });

    it("container works normally after init", async () => {
      await container.init();
      container.writeFile("/after-init.js", 'module.exports = "ready";');
      const result = container.runFile("/after-init.js");
      expect(result.exports).toBe("ready");
    });
  });
});
