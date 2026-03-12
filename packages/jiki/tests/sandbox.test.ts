import { describe, it, expect, beforeEach } from "vitest";
import { SandboxGuard } from "../src/sandbox";
import { Container, boot } from "../src/container";

describe("SandboxGuard", () => {
  it("isActive is false with no options", () => {
    const guard = new SandboxGuard();
    expect(guard.isActive).toBe(false);
  });

  it("isActive is true with limits", () => {
    const guard = new SandboxGuard({ limits: { maxFileCount: 10 } });
    expect(guard.isActive).toBe(true);
  });

  describe("file write checks", () => {
    it("allows writes within limits", () => {
      const guard = new SandboxGuard({
        limits: { maxFileCount: 10, maxMemoryMB: 1 },
      });
      expect(() => guard.checkWrite("/test.txt", 100)).not.toThrow();
    });

    it("rejects writes in read-only mode", () => {
      const guard = new SandboxGuard({ fs: { readOnly: true } });
      expect(() => guard.checkWrite("/test.txt", 100)).toThrow(
        "[sandbox] VFS is read-only",
      );
    });

    it("rejects writes outside allowed paths", () => {
      const guard = new SandboxGuard({
        fs: { allowedPaths: ["/app", "/node_modules"] },
      });
      expect(() => guard.checkWrite("/app/index.js", 100)).not.toThrow();
      expect(() =>
        guard.checkWrite("/node_modules/react/index.js", 100),
      ).not.toThrow();
      expect(() => guard.checkWrite("/etc/passwd", 100)).toThrow(
        "outside allowed paths",
      );
    });

    it("rejects files exceeding max file size", () => {
      const guard = new SandboxGuard({ limits: { maxFileSizeMB: 1 } });
      const twoMB = 2 * 1024 * 1024;
      expect(() => guard.checkWrite("/big.bin", twoMB)).toThrow(
        "exceeds max file size",
      );
    });

    it("rejects when file count limit exceeded", () => {
      const guard = new SandboxGuard({ limits: { maxFileCount: 2 } });
      guard.checkWrite("/a.txt", 10);
      guard.trackWrite(10);
      guard.checkWrite("/b.txt", 10);
      guard.trackWrite(10);
      expect(() => guard.checkWrite("/c.txt", 10)).toThrow(
        "file count limit exceeded",
      );
    });

    it("rejects when memory limit exceeded", () => {
      const guard = new SandboxGuard({ limits: { maxMemoryMB: 1 } });
      const almostOneMB = 1000 * 1024;
      guard.checkWrite("/a.txt", almostOneMB);
      guard.trackWrite(almostOneMB);
      expect(() => guard.checkWrite("/b.txt", almostOneMB)).toThrow(
        "memory limit exceeded",
      );
    });
  });

  describe("trackDelete", () => {
    it("decrements file count and bytes", () => {
      const guard = new SandboxGuard({ limits: { maxFileCount: 2 } });
      guard.trackWrite(100);
      guard.trackWrite(200);
      expect(guard.currentFileCount).toBe(2);
      expect(guard.currentMemoryBytes).toBe(300);

      guard.trackDelete(100);
      expect(guard.currentFileCount).toBe(1);
      expect(guard.currentMemoryBytes).toBe(200);
    });
  });

  describe("network checks", () => {
    it("allows all when no network options", () => {
      const guard = new SandboxGuard();
      expect(() => guard.checkNetwork("https://example.com")).not.toThrow();
    });

    it("blocks all when blockAll is true", () => {
      const guard = new SandboxGuard({ network: { blockAll: true } });
      expect(() => guard.checkNetwork("https://example.com")).toThrow(
        "blocked",
      );
    });

    it("allows only listed hosts", () => {
      const guard = new SandboxGuard({
        network: { allowedHosts: ["registry.npmjs.org", "api.example.com"] },
      });
      expect(() =>
        guard.checkNetwork("https://registry.npmjs.org/react"),
      ).not.toThrow();
      expect(() =>
        guard.checkNetwork("https://api.example.com/data"),
      ).not.toThrow();
      expect(() => guard.checkNetwork("https://evil.com/steal")).toThrow(
        "not in allowed hosts",
      );
    });
  });

  describe("execution timeout", () => {
    it("returns undefined when no limit", () => {
      const guard = new SandboxGuard();
      expect(guard.executionTimeout).toBeUndefined();
    });

    it("returns configured timeout", () => {
      const guard = new SandboxGuard({ limits: { maxExecutionMs: 5000 } });
      expect(guard.executionTimeout).toBe(5000);
    });
  });
});

describe("Container with sandbox", () => {
  it("accepts sandbox option", () => {
    const c = boot({ sandbox: { limits: { maxFileCount: 100 } } });
    expect(c.sandbox.isActive).toBe(true);
  });

  it("enforces read-only mode on writeFile", () => {
    const c = boot({ sandbox: { fs: { readOnly: true } } });
    expect(() => c.writeFile("/test.txt", "data")).toThrow("read-only");
  });

  it("enforces allowed paths on writeFile", () => {
    const c = boot({ sandbox: { fs: { allowedPaths: ["/app"] } } });
    expect(() => c.writeFile("/app/index.js", "code")).not.toThrow();
    expect(() => c.writeFile("/etc/secret", "data")).toThrow(
      "outside allowed paths",
    );
  });

  it("enforces file count limit", () => {
    const c = boot({ sandbox: { limits: { maxFileCount: 2 } } });
    c.writeFile("/a.txt", "a");
    c.writeFile("/b.txt", "b");
    expect(() => c.writeFile("/c.txt", "c")).toThrow("file count limit");
  });

  it("no sandbox means no restrictions", () => {
    const c = boot();
    expect(c.sandbox.isActive).toBe(false);
    c.writeFile("/anything.txt", "data");
    expect(c.readFile("/anything.txt")).toBe("data");
  });

  it("enforces path restriction on shell redirect (echo > file)", async () => {
    const c = boot({ sandbox: { fs: { allowedPaths: ["/app"] } } });
    c.writeFile("/app/ok.txt", "allowed");
    const result = await c.run("echo secret > /etc/passwd");
    // The redirect should be blocked by the sandbox at the VFS level
    expect(result.stderr).toContain("sandbox");
    expect(c.exists("/etc/passwd")).toBe(false);
  });

  it("allows shell redirect to allowed path", async () => {
    const c = boot({ sandbox: { fs: { allowedPaths: ["/app"] } } });
    await c.run("echo hello > /app/test.txt");
    expect(c.exists("/app/test.txt")).toBe(true);
    expect(c.readFile("/app/test.txt")).toContain("hello");
  });

  it("enforces file count limit via shell commands", async () => {
    const c = boot({ sandbox: { limits: { maxFileCount: 3 } } });
    c.writeFile("/a.txt", "1");
    c.writeFile("/b.txt", "2");
    c.writeFile("/c.txt", "3");
    const result = await c.run("echo overflow > /d.txt");
    expect(result.stderr).toContain("sandbox");
    expect(c.exists("/d.txt")).toBe(false);
  });
});
