import { describe, it, expect } from "vitest";
import * as path from "../../src/polyfills/path";

describe("path shim", () => {
  describe("normalize", () => {
    it("removes trailing slashes and resolves ..", () => {
      expect(path.normalize("/a/b/../c")).toBe("/a/c");
    });

    it("removes . segments", () => {
      expect(path.normalize("/a/./b")).toBe("/a/b");
    });

    it('returns "." for empty string', () => {
      expect(path.normalize("")).toBe(".");
    });

    it("handles multiple consecutive slashes", () => {
      expect(path.normalize("/a//b///c")).toBe("/a/b/c");
    });
  });

  describe("join", () => {
    it("joins multiple segments", () => {
      expect(path.join("/a", "b", "c")).toBe("/a/b/c");
    });

    it("filters empty segments", () => {
      expect(path.join("/a", "", "b")).toBe("/a/b");
    });

    it("absolute root", () => {
      expect(path.join("/", "file.txt")).toBe("/file.txt");
    });
  });

  describe("resolve", () => {
    it("absolute path short-circuits", () => {
      expect(path.resolve("/abs/path")).toBe("/abs/path");
    });

    it("resolves relative segments", () => {
      expect(path.resolve("/base", "sub", "file.txt")).toBe(
        "/base/sub/file.txt",
      );
    });
  });

  describe("isAbsolute", () => {
    it("/foo is absolute", () => {
      expect(path.isAbsolute("/foo")).toBe(true);
    });

    it("foo is not absolute", () => {
      expect(path.isAbsolute("foo")).toBe(false);
    });
  });

  describe("dirname", () => {
    it("/a/b -> /a", () => {
      expect(path.dirname("/a/b")).toBe("/a");
    });

    it("/a -> /", () => {
      expect(path.dirname("/a")).toBe("/");
    });

    it("a -> .", () => {
      expect(path.dirname("a")).toBe(".");
    });
  });

  describe("basename", () => {
    it("returns last segment", () => {
      expect(path.basename("/a/b/c.txt")).toBe("c.txt");
    });

    it("strips extension", () => {
      expect(path.basename("/a/b/c.txt", ".txt")).toBe("c");
    });
  });

  describe("extname", () => {
    it("returns .js", () => {
      expect(path.extname("file.js")).toBe(".js");
    });

    it("returns .gz for .tar.gz", () => {
      expect(path.extname("archive.tar.gz")).toBe(".gz");
    });

    it("returns empty for no extension", () => {
      expect(path.extname("Makefile")).toBe("");
    });
  });

  describe("relative", () => {
    it("same directory returns empty", () => {
      expect(path.relative("/a/b", "/a/b")).toBe("");
    });

    it("parent directory", () => {
      expect(path.relative("/a/b", "/a")).toBe("..");
    });

    it("sibling directory", () => {
      expect(path.relative("/a/b", "/a/c")).toBe("../c");
    });
  });

  describe("parse + format round-trip", () => {
    it("absolute path", () => {
      const parsed = path.parse("/a/b/c.txt");
      expect(parsed.root).toBe("/");
      expect(parsed.dir).toBe("/a/b");
      expect(parsed.base).toBe("c.txt");
      expect(parsed.ext).toBe(".txt");
      expect(parsed.name).toBe("c");
    });

    it("format reconstructs path", () => {
      const parsed = path.parse("/a/b/c.txt");
      expect(path.format(parsed)).toBe("/a/b/c.txt");
    });
  });

  describe("posix and win32", () => {
    it("posix sub-object exists", () => {
      expect(path.posix).toBeDefined();
      expect(path.posix.sep).toBe("/");
    });

    it("win32 sub-object exists", () => {
      expect(path.win32).toBeDefined();
      expect(path.win32.sep).toBe("\\");
    });
  });
});
