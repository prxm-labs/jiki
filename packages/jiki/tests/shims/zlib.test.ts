import { describe, it, expect } from "vitest";
import {
  brotliCompressSync,
  brotliDecompressSync,
  gzipSync,
  gunzipSync,
  createGzip,
  createGunzip,
} from "../../src/polyfills/zlib";

describe("brotli", () => {
  it("brotliCompressSync produces different output than input", () => {
    const input = new TextEncoder().encode(
      "hello world hello world hello world",
    );
    const compressed = brotliCompressSync(input);
    // Must actually compress — output should differ from input
    expect(compressed.length).not.toBe(input.length);
  });

  it("brotliDecompressSync reverses brotliCompressSync", () => {
    const input = "hello world hello world hello world";
    const compressed = brotliCompressSync(input);
    const decompressed = brotliDecompressSync(compressed);
    expect(new TextDecoder().decode(decompressed)).toBe(input);
  });
});

describe("zlib streams", () => {
  it("createGzip returns a Transform-like stream", () => {
    const gz = createGzip();
    expect(typeof gz.write).toBe("function");
    expect(typeof gz.end).toBe("function");
    expect(typeof gz.on).toBe("function");
    expect(typeof gz.pipe).toBe("function");
  });

  it("gzip stream compresses data", () => {
    return new Promise<void>(resolve => {
      const gz = createGzip();
      const chunks: Uint8Array[] = [];
      gz.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      gz.on("end", () => {
        // Concatenate all chunks
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const compressed = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          compressed.set(
            c instanceof Uint8Array ? c : new Uint8Array(c as ArrayBuffer),
            offset,
          );
          offset += c.length;
        }
        expect(compressed.length).toBeGreaterThan(0);
        resolve();
      });
      gz.write(new TextEncoder().encode("hello world"));
      gz.end();
    });
  });

  it("gzip then gunzip roundtrips data", () => {
    return new Promise<void>(resolve => {
      const gz = createGzip();
      const gunz = createGunzip();
      const chunks: Uint8Array[] = [];

      gunz.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      gunz.on("end", () => {
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          result.set(
            c instanceof Uint8Array ? c : new Uint8Array(c as ArrayBuffer),
            offset,
          );
          offset += c.length;
        }
        const text = new TextDecoder().decode(result);
        expect(text).toBe("hello world");
        resolve();
      });

      gz.pipe(gunz);
      gz.write(new TextEncoder().encode("hello world"));
      gz.end();
    });
  });
});
