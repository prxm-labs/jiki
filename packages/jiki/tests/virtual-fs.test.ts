import { describe, it, expect, vi } from "vitest";
import { MemFS, createNodeError } from "../src/memfs";

function makeVFS(): MemFS {
  return new MemFS();
}

describe("MemFS", () => {
  // --- File operations ---

  describe("file operations", () => {
    it("writeFileSync + readFileSync (string)", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/hello.txt", "world");
      expect(vfs.readFileSync("/hello.txt", "utf8")).toBe("world");
    });

    it("writeFileSync + readFileSync (Uint8Array)", () => {
      const vfs = makeVFS();
      const data = new Uint8Array([1, 2, 3]);
      vfs.writeFileSync("/bin.dat", data);
      expect(vfs.readFileSync("/bin.dat")).toEqual(data);
    });

    it("overwrites existing file", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "old");
      vfs.writeFileSync("/f.txt", "new");
      expect(vfs.readFileSync("/f.txt", "utf8")).toBe("new");
    });

    it("readFileSync with utf-8 encoding alias", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a.txt", "data");
      expect(vfs.readFileSync("/a.txt", "utf-8")).toBe("data");
    });

    it("auto-creates parent directories on write", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a/b/c.txt", "deep");
      expect(vfs.readFileSync("/a/b/c.txt", "utf8")).toBe("deep");
    });
  });

  // --- Directory operations ---

  describe("directory operations", () => {
    it("mkdirSync simple", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/mydir");
      expect(vfs.statSync("/mydir").isDirectory()).toBe(true);
    });

    it("mkdirSync recursive", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/a/b/c", { recursive: true });
      expect(vfs.statSync("/a/b/c").isDirectory()).toBe(true);
    });

    it("readdirSync plain", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/dir/a.txt", "");
      vfs.writeFileSync("/dir/b.txt", "");
      expect(vfs.readdirSync("/dir").sort()).toEqual(["a.txt", "b.txt"]);
    });

    it("readdirSync withFileTypes", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/d/file.txt", "");
      vfs.mkdirSync("/d/sub");
      const entries = vfs.readdirSync("/d", { withFileTypes: true });
      expect(entries.length).toBe(2);
      const file = entries.find(e => e.name === "file.txt")!;
      const dir = entries.find(e => e.name === "sub")!;
      expect(file.isFile()).toBe(true);
      expect(dir.isDirectory()).toBe(true);
    });
  });

  // --- Error handling ---

  describe("error handling", () => {
    it("readFileSync on missing file throws ENOENT", () => {
      const vfs = makeVFS();
      expect(() => vfs.readFileSync("/nope")).toThrow(/ENOENT/);
    });

    it("readFileSync on directory throws EISDIR", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/dir");
      expect(() => vfs.readFileSync("/dir")).toThrow(/EISDIR/);
    });

    it("mkdirSync on existing throws EEXIST", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/dir");
      expect(() => vfs.mkdirSync("/dir")).toThrow(/EEXIST/);
    });

    it("rmdirSync on non-empty throws ENOTEMPTY", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/d/file", "");
      expect(() => vfs.rmdirSync("/d")).toThrow(/ENOTEMPTY/);
    });

    it("unlinkSync on directory throws EISDIR", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/dir");
      expect(() => vfs.unlinkSync("/dir")).toThrow(/EISDIR/);
    });
  });

  // --- Path normalization ---

  describe("path normalization", () => {
    it("handles .. in paths", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a/b/c.txt", "data");
      expect(vfs.readFileSync("/a/b/../b/c.txt", "utf8")).toBe("data");
    });

    it("handles . in paths", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a/./b.txt", "data");
      expect(vfs.readFileSync("/a/b.txt", "utf8")).toBe("data");
    });

    it("handles double slashes", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("//a//b.txt", "data");
      expect(vfs.readFileSync("/a/b.txt", "utf8")).toBe("data");
    });

    it("handles no leading slash", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("file.txt", "data");
      expect(vfs.readFileSync("/file.txt", "utf8")).toBe("data");
    });
  });

  // --- statSync / lstatSync ---

  describe("statSync / lstatSync", () => {
    it("file stats (isFile, size, mtime)", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "hello");
      const st = vfs.statSync("/f.txt");
      expect(st.isFile()).toBe(true);
      expect(st.isDirectory()).toBe(false);
      expect(st.size).toBe(5);
      expect(st.mtime).toBeInstanceOf(Date);
    });

    it("directory stats", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/d");
      const st = vfs.statSync("/d");
      expect(st.isDirectory()).toBe(true);
      expect(st.isFile()).toBe(false);
    });

    it("lstatSync shows symlink type", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/target", "data");
      vfs.symlinkSync("/target", "/link");
      const st = vfs.lstatSync("/link");
      expect(st.isSymbolicLink()).toBe(true);
      expect(st.isFile()).toBe(false);
    });
  });

  // --- Symlinks ---

  describe("symlinks", () => {
    it("symlinkSync + readlinkSync", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/target.txt", "data");
      vfs.symlinkSync("/target.txt", "/link.txt");
      expect(vfs.readlinkSync("/link.txt")).toBe("/target.txt");
    });

    it("read/write through symlinks", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/real.txt", "original");
      vfs.symlinkSync("/real.txt", "/sym.txt");
      expect(vfs.readFileSync("/sym.txt", "utf8")).toBe("original");
    });

    it("nested symlink resolution", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a.txt", "data");
      vfs.symlinkSync("/a.txt", "/b.txt");
      vfs.symlinkSync("/b.txt", "/c.txt");
      expect(vfs.readFileSync("/c.txt", "utf8")).toBe("data");
    });

    it("ELOOP on circular symlinks", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/d");
      // Manually create circular symlinks using internal VFS
      vfs.symlinkSync("/loop2", "/loop1");
      vfs.symlinkSync("/loop1", "/loop2");
      expect(() => vfs.statSync("/loop1")).toThrow(/ELOOP/);
    });

    it("EEXIST when creating symlink over existing", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a", "data");
      vfs.symlinkSync("/a", "/b");
      expect(() => vfs.symlinkSync("/a", "/b")).toThrow(/EEXIST/);
    });
  });

  // --- existsSync ---

  describe("existsSync", () => {
    it("returns true for existing file", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "");
      expect(vfs.existsSync("/f.txt")).toBe(true);
    });

    it("returns false for missing file", () => {
      const vfs = makeVFS();
      expect(vfs.existsSync("/nope")).toBe(false);
    });

    it("returns true for directory", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/d");
      expect(vfs.existsSync("/d")).toBe(true);
    });

    it("returns true for symlink target", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/t", "data");
      vfs.symlinkSync("/t", "/s");
      expect(vfs.existsSync("/s")).toBe(true);
    });
  });

  // --- unlinkSync / rmdirSync / rmSync ---

  describe("removal operations", () => {
    it("unlinkSync removes file", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "data");
      vfs.unlinkSync("/f.txt");
      expect(vfs.existsSync("/f.txt")).toBe(false);
    });

    it("rmdirSync removes empty dir", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/d");
      vfs.rmdirSync("/d");
      expect(vfs.existsSync("/d")).toBe(false);
    });

    it("rmdirSync recursive removes non-empty dir", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/d/f.txt", "data");
      vfs.rmdirSync("/d", { recursive: true });
      expect(vfs.existsSync("/d")).toBe(false);
    });

    it("rmSync force on missing does not throw", () => {
      const vfs = makeVFS();
      expect(() => vfs.rmSync("/nope", { force: true })).not.toThrow();
    });

    it("rmSync recursive removes directory", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/d/a/b.txt", "data");
      vfs.rmSync("/d", { recursive: true });
      expect(vfs.existsSync("/d")).toBe(false);
    });
  });

  // --- renameSync ---

  describe("renameSync", () => {
    it("renames a file", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/old.txt", "data");
      vfs.renameSync("/old.txt", "/new.txt");
      expect(vfs.existsSync("/old.txt")).toBe(false);
      expect(vfs.readFileSync("/new.txt", "utf8")).toBe("data");
    });

    it("renames across directories", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/a");
      vfs.mkdirSync("/b");
      vfs.writeFileSync("/a/f.txt", "data");
      vfs.renameSync("/a/f.txt", "/b/f.txt");
      expect(vfs.existsSync("/a/f.txt")).toBe(false);
      expect(vfs.readFileSync("/b/f.txt", "utf8")).toBe("data");
    });
  });

  // --- copyFileSync ---

  describe("copyFileSync", () => {
    it("copies file content", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/src.txt", "content");
      vfs.copyFileSync("/src.txt", "/dest.txt");
      expect(vfs.readFileSync("/dest.txt", "utf8")).toBe("content");
      expect(vfs.readFileSync("/src.txt", "utf8")).toBe("content");
    });
  });

  // --- accessSync ---

  describe("accessSync", () => {
    it("existing file passes", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "");
      expect(() => vfs.accessSync("/f.txt")).not.toThrow();
    });

    it("missing file throws ENOENT", () => {
      const vfs = makeVFS();
      expect(() => vfs.accessSync("/nope")).toThrow(/ENOENT/);
    });
  });

  // --- realpathSync ---

  describe("realpathSync", () => {
    it("normalizes and validates", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a/b.txt", "data");
      expect(vfs.realpathSync("/a/./b.txt")).toBe("/a/b.txt");
    });

    it("throws on missing path", () => {
      const vfs = makeVFS();
      expect(() => vfs.realpathSync("/nope")).toThrow(/ENOENT/);
    });
  });

  // --- Snapshots ---

  describe("snapshot", () => {
    it("toSnapshot + fromSnapshot round-trip", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a.txt", "alpha");
      vfs.mkdirSync("/sub");
      vfs.writeFileSync("/sub/b.txt", "beta");
      vfs.symlinkSync("/a.txt", "/link");

      const snapshot = vfs.toSnapshot();
      const restored = MemFS.fromSnapshot(snapshot);

      expect(restored.readFileSync("/a.txt", "utf8")).toBe("alpha");
      expect(restored.readFileSync("/sub/b.txt", "utf8")).toBe("beta");
      expect(restored.readlinkSync("/link")).toBe("/a.txt");
    });
  });

  // --- Export ---

  describe("export", () => {
    it("returns correct JSON tree", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/file.txt", "content");
      vfs.mkdirSync("/dir");
      vfs.writeFileSync("/dir/nested.txt", "inner");

      const tree = vfs.export("/");
      expect(tree["file.txt"]).toEqual({ file: { contents: "content" } });
      expect(tree["dir"]).toHaveProperty("directory");
      expect((tree["dir"] as any).directory["nested.txt"]).toEqual({
        file: { contents: "inner" },
      });
    });
  });

  // --- File watching ---

  describe("file watching", () => {
    it("watch fires on write (change)", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "old");
      const events: [string, string | null][] = [];
      vfs.watch("/f.txt", (eventType, filename) =>
        events.push([eventType, filename]),
      );
      vfs.writeFileSync("/f.txt", "new");
      expect(events.length).toBeGreaterThan(0);
      expect(events[0][0]).toBe("change");
    });

    it("watch fires on new file (rename)", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/d");
      const events: [string, string | null][] = [];
      vfs.watch("/d", (eventType, filename) =>
        events.push([eventType, filename]),
      );
      vfs.writeFileSync("/d/new.txt", "data");
      expect(events.some(e => e[0] === "rename")).toBe(true);
    });

    it("recursive watcher catches nested changes", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/root/sub", { recursive: true });
      const events: [string, string | null][] = [];
      vfs.watch("/root", { recursive: true }, (eventType, filename) =>
        events.push([eventType, filename]),
      );
      vfs.writeFileSync("/root/sub/file.txt", "data");
      expect(events.length).toBeGreaterThan(0);
    });

    it("close stops events", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "old");
      const events: [string, string | null][] = [];
      const watcher = vfs.watch("/f.txt", (eventType, filename) =>
        events.push([eventType, filename]),
      );
      watcher.close();
      vfs.writeFileSync("/f.txt", "new");
      expect(events.length).toBe(0);
    });
  });

  // --- Event listeners ---

  describe("event listeners", () => {
    it('on("change") fires on write', () => {
      const vfs = makeVFS();
      const changes: string[] = [];
      vfs.on("change", path => changes.push(path));
      vfs.writeFileSync("/test.txt", "data");
      expect(changes).toContain("/test.txt");
    });

    it('on("delete") fires on unlink', () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/f.txt", "data");
      const deleted: string[] = [];
      vfs.on("delete", path => deleted.push(path));
      vfs.unlinkSync("/f.txt");
      expect(deleted).toContain("/f.txt");
    });

    it("off() removes listener", () => {
      const vfs = makeVFS();
      const changes: string[] = [];
      const listener = (path: string) => changes.push(path);
      vfs.on("change", listener);
      vfs.off("change", listener);
      vfs.writeFileSync("/f.txt", "data");
      expect(changes.length).toBe(0);
    });
  });

  // --- Symlink depth limit (Finding #27) ---

  describe("symlink depth limit", () => {
    it("ELOOP is thrown at exactly symlinkLimit depth (off-by-one fix)", () => {
      const vfs = makeVFS();
      // Create a chain of symlinks: /s0 -> /s1 -> /s2 -> ... -> /s20 -> /target
      vfs.writeFileSync("/target", "data");
      // symlinkLimit is 20, so 20 levels of symlinks should trigger ELOOP
      // (>= check, not > check)
      let prev = "/target";
      for (let i = 19; i >= 0; i--) {
        const name = `/s${i}`;
        vfs.symlinkSync(prev, name);
        prev = name;
      }
      // 20 links deep: /s0 -> /s1 -> ... -> /s19 -> /target = 20 hops
      // This should trigger ELOOP with the >= fix
      expect(() => vfs.statSync("/s0")).toThrow(/ELOOP/);
    });

    it("resolves within symlink limit", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/target", "ok");
      let prev = "/target";
      for (let i = 18; i >= 0; i--) {
        const name = `/l${i}`;
        vfs.symlinkSync(prev, name);
        prev = name;
      }
      // 19 hops - should be within limit
      expect(vfs.readFileSync("/l0", "utf8")).toBe("ok");
    });
  });

  // --- Node index path boundary (Finding #28) ---

  describe("dropIndex path boundary", () => {
    it("deleting /a does not affect /ab", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/a");
      vfs.writeFileSync("/a/file.txt", "inside-a");
      vfs.writeFileSync("/ab", "different-file");

      // Force node index population by reading
      vfs.readFileSync("/ab", "utf8");

      // Remove /a recursively
      vfs.rmdirSync("/a", { recursive: true });

      // /ab should still be accessible
      expect(vfs.existsSync("/ab")).toBe(true);
      expect(vfs.readFileSync("/ab", "utf8")).toBe("different-file");
    });

    it("deleting /foo does not affect /foobar directory", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/foo");
      vfs.writeFileSync("/foo/child.txt", "foo-child");
      vfs.mkdirSync("/foobar");
      vfs.writeFileSync("/foobar/child.txt", "foobar-child");

      // Force index population
      vfs.readFileSync("/foobar/child.txt", "utf8");

      vfs.rmdirSync("/foo", { recursive: true });

      expect(vfs.existsSync("/foobar")).toBe(true);
      expect(vfs.readFileSync("/foobar/child.txt", "utf8")).toBe(
        "foobar-child",
      );
    });
  });

  // --- createNodeError ---

  describe("createNodeError", () => {
    it("creates error with code, errno, syscall, path", () => {
      const err = createNodeError("ENOENT", "open", "/test");
      expect(err.code).toBe("ENOENT");
      expect(err.errno).toBe(-2);
      expect(err.syscall).toBe("open");
      expect(err.path).toBe("/test");
      expect(err.message).toContain("ENOENT");
    });
  });

  // --- Sprint 4 P3: MemFS error consistency (Findings #53-57) ---

  describe("readlinkSync EINVAL on non-symlink (Finding #53)", () => {
    it("throws EINVAL with proper code property", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/file.txt", "data");
      try {
        vfs.readlinkSync("/file.txt");
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.code).toBe("EINVAL");
        expect(e.errno).toBe(-22);
        expect(e.syscall).toBe("readlink");
        expect(e.path).toBe("/file.txt");
      }
    });
  });

  describe("rmdirSync EPERM on root (Finding #54)", () => {
    it("throws EPERM with proper code property", () => {
      const vfs = makeVFS();
      try {
        vfs.rmdirSync("/");
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.code).toBe("EPERM");
        expect(e.errno).toBe(-1);
        expect(e.syscall).toBe("rmdir");
      }
    });
  });

  describe("mkdirSync empty filename (Finding #55)", () => {
    it("mkdirSync root is a no-op (root always exists)", () => {
      const vfs = makeVFS();
      // Should not throw — root always exists
      expect(() => vfs.mkdirSync("/")).not.toThrow();
    });

    it("uses createNodeError for error cases (not raw Error)", () => {
      const vfs = makeVFS();
      // Trying to create an existing non-root dir throws EEXIST with proper structure
      vfs.mkdirSync("/existing");
      try {
        vfs.mkdirSync("/existing");
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.code).toBe("EEXIST");
        expect(e.syscall).toBe("mkdir");
        expect(typeof e.errno).toBe("number");
      }
    });
  });

  describe("watch event path boundary for root (Finding #56)", () => {
    it("root watcher receives correct relative paths", () => {
      const vfs = makeVFS();
      const events: [string, string | null][] = [];
      vfs.watch("/", { recursive: true }, (eventType, filename) =>
        events.push([eventType, filename]),
      );
      vfs.writeFileSync("/test.txt", "data");
      expect(events.length).toBeGreaterThan(0);
      // Should be 'test.txt', not '/test.txt' or 'est.txt'
      expect(events[0][1]).toBe("test.txt");
    });

    it("non-root watcher receives correct relative paths", () => {
      const vfs = makeVFS();
      vfs.mkdirSync("/dir");
      const events: [string, string | null][] = [];
      vfs.watch("/dir", { recursive: true }, (eventType, filename) =>
        events.push([eventType, filename]),
      );
      vfs.writeFileSync("/dir/sub.txt", "data");
      expect(events.length).toBeGreaterThan(0);
      expect(events[0][1]).toBe("sub.txt");
    });
  });

  describe("inode stability (Finding #57)", () => {
    it("statSync returns same ino for the same file across calls", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/stable.txt", "data");
      const ino1 = vfs.statSync("/stable.txt").ino;
      const ino2 = vfs.statSync("/stable.txt").ino;
      expect(ino1).toBe(ino2);
    });

    it("different files have different inodes", () => {
      const vfs = makeVFS();
      vfs.writeFileSync("/a.txt", "aaa");
      vfs.writeFileSync("/b.txt", "bbb");
      const inoA = vfs.statSync("/a.txt").ino;
      const inoB = vfs.statSync("/b.txt").ino;
      expect(inoA).not.toBe(inoB);
    });
  });
});
