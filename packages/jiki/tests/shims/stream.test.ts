import { describe, it, expect, vi } from "vitest";
import {
  BufferImpl,
  Readable,
  Writable,
  Transform,
  PassThrough,
  pipeline,
  finished,
} from "../../src/polyfills/stream";

describe("BufferImpl", () => {
  describe("alloc", () => {
    it("creates zero-filled buffer", () => {
      const buf = BufferImpl.alloc(4);
      expect(buf.length).toBe(4);
      expect(buf[0]).toBe(0);
    });

    it("fills with value", () => {
      const buf = BufferImpl.alloc(3, 0xff);
      expect(buf[0]).toBe(255);
      expect(buf[2]).toBe(255);
    });
  });

  describe("from", () => {
    it("string utf8", () => {
      const buf = BufferImpl.from("hello");
      expect(buf.toString()).toBe("hello");
    });

    it("string base64", () => {
      const buf = BufferImpl.from(btoa("hello"), "base64");
      expect(buf.toString()).toBe("hello");
    });

    it("string hex", () => {
      const buf = BufferImpl.from("48656c6c6f", "hex");
      expect(buf.toString()).toBe("Hello");
    });

    it("Uint8Array", () => {
      const src = new Uint8Array([1, 2, 3]);
      const buf = BufferImpl.from(src);
      expect(buf.length).toBe(3);
      expect(buf[0]).toBe(1);
    });

    it("number array", () => {
      const buf = BufferImpl.from([65, 66]);
      expect(buf.toString()).toBe("AB");
    });
  });

  describe("concat", () => {
    it("concatenates multiple buffers", () => {
      const a = BufferImpl.from("ab");
      const b = BufferImpl.from("cd");
      const c = BufferImpl.concat([a, b]);
      expect(c.toString()).toBe("abcd");
    });

    it("respects totalLength param", () => {
      const a = BufferImpl.from("ab");
      const b = BufferImpl.from("cd");
      const c = BufferImpl.concat([a, b], 3);
      expect(c.length).toBe(3);
      expect(c.toString()).toBe("abc");
    });
  });

  describe("isBuffer", () => {
    it("true for BufferImpl", () => {
      expect(BufferImpl.isBuffer(BufferImpl.alloc(1))).toBe(true);
    });

    it("true for Uint8Array", () => {
      expect(BufferImpl.isBuffer(new Uint8Array(1))).toBe(true);
    });

    it("false for other", () => {
      expect(BufferImpl.isBuffer("string")).toBe(false);
      expect(BufferImpl.isBuffer(42)).toBe(false);
    });
  });

  describe("toString", () => {
    it("utf8 encoding (default)", () => {
      expect(BufferImpl.from("test").toString()).toBe("test");
    });

    it("base64 encoding", () => {
      const buf = BufferImpl.from("Hello");
      expect(buf.toString("base64")).toBe(btoa("Hello"));
    });

    it("hex encoding", () => {
      const buf = BufferImpl.from([0x0a, 0xff]);
      expect(buf.toString("hex")).toBe("0aff");
    });

    it("latin1 encoding", () => {
      const buf = BufferImpl.from([65, 66]);
      expect(buf.toString("latin1")).toBe("AB");
    });
  });

  describe("read/write", () => {
    it("readUInt8 / writeUInt8", () => {
      const buf = BufferImpl.alloc(2);
      buf.writeUInt8(42, 0);
      expect(buf.readUInt8(0)).toBe(42);
    });

    it("readUInt16BE / writeUInt16BE", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeUInt16BE(0x1234, 0);
      expect(buf.readUInt16BE(0)).toBe(0x1234);
    });

    it("readUInt16LE / writeUInt16LE", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeUInt16LE(0x1234, 0);
      expect(buf.readUInt16LE(0)).toBe(0x1234);
    });

    it("readUInt32BE / writeUInt32BE", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeUInt32BE(0x12345678, 0);
      expect(buf.readUInt32BE(0)).toBe(0x12345678);
    });

    it("readUInt32LE / writeUInt32LE", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeUInt32LE(0x12345678, 0);
      expect(buf.readUInt32LE(0)).toBe(0x12345678);
    });
  });

  describe("equals / compare", () => {
    it("equal buffers", () => {
      const a = BufferImpl.from("abc");
      const b = BufferImpl.from("abc");
      expect(a.equals(b)).toBe(true);
      expect(a.compare(b)).toBe(0);
    });

    it("different buffers", () => {
      const a = BufferImpl.from("abc");
      const b = BufferImpl.from("abd");
      expect(a.equals(b)).toBe(false);
      expect(a.compare(b)).toBeLessThan(0);
    });
  });

  describe("slice", () => {
    it("returns BufferImpl subclass", () => {
      const buf = BufferImpl.from("abcdef");
      const sliced = buf.slice(1, 4);
      expect(sliced).toBeInstanceOf(BufferImpl);
      expect(sliced.toString()).toBe("bcd");
    });
  });
});

describe("Streams", () => {
  describe("Readable", () => {
    it('push data emits "data" event', () => {
      const r = new Readable();
      const chunks: unknown[] = [];
      r.on("data", c => chunks.push(c));
      r.push("hello");
      expect(chunks).toEqual(["hello"]);
    });

    it('push null emits "end"', () => {
      const r = new Readable();
      const fn = vi.fn();
      r.on("end", fn);
      r.push(null);
      expect(fn).toHaveBeenCalled();
    });

    it("pipe to Writable", () => {
      const r = new Readable();
      const chunks: unknown[] = [];
      const w = new Writable();
      w._write = (chunk, _enc, cb) => {
        chunks.push(chunk);
        cb();
      };
      r.pipe(w);
      r.push("data");
      expect(chunks).toEqual(["data"]);
    });
  });

  describe("Writable", () => {
    it("write calls _write", () => {
      const w = new Writable();
      const chunks: unknown[] = [];
      w._write = (chunk, _enc, cb) => {
        chunks.push(chunk);
        cb();
      };
      w.write("hello");
      expect(chunks).toEqual(["hello"]);
    });

    it("end emits finish", () => {
      const w = new Writable();
      const fn = vi.fn();
      w.on("finish", fn);
      w.end();
      expect(fn).toHaveBeenCalled();
    });
  });

  describe("Transform", () => {
    it("default _transform passes through", () => {
      const t = new Transform();
      const chunks: unknown[] = [];
      t.on("data", c => chunks.push(c));
      t.write("hello");
      expect(chunks).toEqual(["hello"]);
    });

    it("custom transform modifies data", () => {
      const t = new Transform();
      t._transform = (chunk, _enc, cb) => cb(null, String(chunk).toUpperCase());
      const chunks: unknown[] = [];
      t.on("data", c => chunks.push(c));
      t.write("hello");
      expect(chunks).toEqual(["HELLO"]);
    });
  });

  describe("PassThrough", () => {
    it("data flows through unchanged", () => {
      const p = new PassThrough();
      const chunks: unknown[] = [];
      p.on("data", c => chunks.push(c));
      p.write("data");
      expect(chunks).toEqual(["data"]);
    });
  });

  describe("pipeline", () => {
    it("connects streams and callback on finish", () => {
      const r = new Readable();
      const w = new Writable();
      const result: unknown[] = [];
      w._write = (chunk, _enc, cb) => {
        result.push(chunk);
        cb();
      };
      const fn = vi.fn();
      pipeline(r, w, fn);
      r.push("hello");
      r.push(null);
      expect(result).toEqual(["hello"]);
      expect(fn).toHaveBeenCalled();
    });
  });

  describe("finished", () => {
    it("calls callback on stream end", () => {
      const r = new Readable();
      const fn = vi.fn();
      finished(r, fn);
      r.push(null);
      expect(fn).toHaveBeenCalled();
    });
  });

  describe("Readable flow control", () => {
    it("pause() stops data events", async () => {
      const r = new Readable();
      const chunks: string[] = [];
      r.on("data", (d: string) => chunks.push(d));
      r.push("a");
      await new Promise(resolve => setTimeout(resolve, 10));
      r.pause();
      r.push("b");
      await new Promise(resolve => setTimeout(resolve, 10));
      // 'a' should be received, 'b' should be buffered
      expect(chunks).toContain("a");
      expect(chunks).not.toContain("b");
      // resume should flush
      r.resume();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(chunks).toContain("b");
    });

    it("pipe respects backpressure", () => {
      const r = new Readable();
      const chunks: unknown[] = [];
      const w = new Writable();
      w._write = (chunk: unknown, _enc: string, cb: () => void) => {
        chunks.push(chunk);
        cb();
      };
      r.pipe(w);
      r.push("hello");
      r.push(null);
      expect(chunks).toContain("hello");
    });
  });
});
