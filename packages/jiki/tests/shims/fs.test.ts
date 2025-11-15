import { describe, it, expect, vi } from "vitest";
import { MemFS } from "../../src/memfs";
import { createFsShim } from "../../src/polyfills/fs";

describe("fs shim (createFsShim)", () => {
  function setup(cwd = "/app") {
    const vfs = new MemFS();
    vfs.mkdirSync(cwd, { recursive: true });
    const shim = createFsShim(vfs, () => cwd);
    return { vfs, shim };
  }

  it("relative path resolution: write to ./foo.txt from cwd /app writes to /app/foo.txt", () => {
    const { vfs, shim } = setup("/app");
    shim.writeFileSync("./foo.txt", "data");
    expect(vfs.readFileSync("/app/foo.txt", "utf8")).toBe("data");
  });

  it('readFileSync with { encoding: "utf8" } object syntax', () => {
    const { shim } = setup("/app");
    shim.writeFileSync("/app/f.txt", "hello");
    const result = shim.readFileSync("/app/f.txt", { encoding: "utf8" });
    expect(result).toBe("hello");
  });

  it("promises.readFile / promises.writeFile async versions work", async () => {
    const { shim } = setup("/app");
    await shim.promises.writeFile("/app/async.txt", "async-data");
    const data = await shim.promises.readFile("/app/async.txt", "utf8");
    expect(data).toBe("async-data");
  });

  it("constants object has F_OK, R_OK, etc.", () => {
    const { shim } = setup();
    expect(shim.constants.F_OK).toBe(0);
    expect(shim.constants.R_OK).toBe(4);
    expect(shim.constants.W_OK).toBe(2);
    expect(shim.constants.X_OK).toBe(1);
  });

  it("symlink operations through shim", () => {
    const { shim } = setup("/app");
    shim.writeFileSync("/app/target.txt", "data");
    shim.symlinkSync("/app/target.txt", "/app/link.txt");
    const content = shim.readFileSync("/app/link.txt", "utf8");
    expect(content).toBe("data");
  });

  it("existsSync works", () => {
    const { shim } = setup("/app");
    shim.writeFileSync("/app/exists.txt", "data");
    expect(shim.existsSync("/app/exists.txt")).toBe(true);
    expect(shim.existsSync("/app/nope.txt")).toBe(false);
  });

  it("mkdirSync with recursive option", () => {
    const { shim, vfs } = setup("/app");
    shim.mkdirSync("/app/a/b/c", { recursive: true });
    expect(vfs.statSync("/app/a/b/c").isDirectory()).toBe(true);
  });

  it("rmSync removes files", () => {
    const { shim } = setup("/app");
    shim.writeFileSync("/app/del.txt", "data");
    shim.rmSync("/app/del.txt");
    expect(shim.existsSync("/app/del.txt")).toBe(false);
  });

  describe("chmod/chown warning stubs", () => {
    it("chmodSync is a no-op that warns", () => {
      const { shim } = setup("/app");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      shim.chmodSync("/app/file.txt", 0o755);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("chmodSync"),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no-op"));
      warnSpy.mockRestore();
    });

    it("chownSync is a no-op that warns", () => {
      const { shim } = setup("/app");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      shim.chownSync("/app/file.txt", 1000, 1000);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("chownSync"),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no-op"));
      warnSpy.mockRestore();
    });

    it("lchmodSync is a no-op that warns", () => {
      const { shim } = setup("/app");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      shim.lchmodSync("/app/file.txt", 0o755);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("lchmodSync"),
      );
      warnSpy.mockRestore();
    });

    it("lchownSync is a no-op that warns", () => {
      const { shim } = setup("/app");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      shim.lchownSync("/app/file.txt", 1000, 1000);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("lchownSync"),
      );
      warnSpy.mockRestore();
    });

    it("promises.chmod is a no-op that warns", async () => {
      const { shim } = setup("/app");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await shim.promises.chmod("/app/file.txt", 0o755);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("chmod"));
      warnSpy.mockRestore();
    });

    it("promises.chown is a no-op that warns", async () => {
      const { shim } = setup("/app");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await shim.promises.chown("/app/file.txt", 1000, 1000);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("chown"));
      warnSpy.mockRestore();
    });
  });
});
