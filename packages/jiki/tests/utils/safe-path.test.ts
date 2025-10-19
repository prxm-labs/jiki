import { describe, it, expect } from "vitest";
import { safePath } from "../../src/utils/safe-path";

describe("safePath", () => {
  it("normalizes simple paths", () => {
    expect(safePath("/root", "/foo/bar")).toBe("/root/foo/bar");
  });

  it("blocks .. traversal", () => {
    expect(safePath("/root", "/../../../etc/passwd")).toBe("/root/etc/passwd");
  });

  it("blocks encoded .. traversal", () => {
    expect(safePath("/root", "/%2e%2e/etc/passwd")).toBe("/root/etc/passwd");
  });

  it("handles double slashes", () => {
    expect(safePath("/root", "//foo//bar")).toBe("/root/foo/bar");
  });

  it("handles root path /", () => {
    expect(safePath("/", "/foo/../bar")).toBe("/bar");
  });

  it("strips query strings before resolving", () => {
    expect(safePath("/root", "/foo?query=1")).toBe("/root/foo");
  });

  it("strips hash fragments", () => {
    expect(safePath("/root", "/foo#anchor")).toBe("/root/foo");
  });

  it("never escapes the root", () => {
    expect(safePath("/node_modules", "/../../../secret")).toBe(
      "/node_modules/secret",
    );
  });
});
