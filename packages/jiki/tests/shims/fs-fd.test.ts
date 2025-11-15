import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";

describe("file descriptor APIs", () => {
  let vfs: MemFS;

  beforeEach(() => {
    vfs = new MemFS();
    vfs.writeFileSync("/test.txt", "hello world");
  });

  it("openSync returns a numeric fd", () => {
    const fd = vfs.openSync("/test.txt", "r");
    expect(typeof fd).toBe("number");
    expect(fd).toBeGreaterThanOrEqual(3); // 0,1,2 reserved for stdin/out/err
  });

  it("closeSync closes an fd without error", () => {
    const fd = vfs.openSync("/test.txt", "r");
    expect(() => vfs.closeSync(fd)).not.toThrow();
  });

  it("closeSync throws on invalid fd", () => {
    expect(() => vfs.closeSync(999)).toThrow();
  });

  it("readSync reads bytes from fd into buffer", () => {
    const fd = vfs.openSync("/test.txt", "r");
    const buf = new Uint8Array(5);
    const bytesRead = vfs.readSync(fd, buf, 0, 5, 0);
    expect(bytesRead).toBe(5);
    expect(new TextDecoder().decode(buf)).toBe("hello");
    vfs.closeSync(fd);
  });

  it("readSync reads from position", () => {
    const fd = vfs.openSync("/test.txt", "r");
    const buf = new Uint8Array(5);
    vfs.readSync(fd, buf, 0, 5, 6);
    expect(new TextDecoder().decode(buf)).toBe("world");
    vfs.closeSync(fd);
  });

  it("writeSync writes bytes to fd", () => {
    const fd = vfs.openSync("/out.txt", "w");
    const data = new TextEncoder().encode("written");
    const bytesWritten = vfs.writeSync(fd, data, 0, data.length, 0);
    expect(bytesWritten).toBe(7);
    vfs.closeSync(fd);
    expect(vfs.readFileSync("/out.txt", "utf-8")).toBe("written");
  });

  it("fstatSync returns stats for open fd", () => {
    const fd = vfs.openSync("/test.txt", "r");
    const stat = vfs.fstatSync(fd);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBe(11); // "hello world"
    vfs.closeSync(fd);
  });
});
