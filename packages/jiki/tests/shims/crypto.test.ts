import { describe, it, expect } from "vitest";
import {
  randomBytes,
  randomUUID,
  randomInt,
  createHash,
  createHmac,
  timingSafeEqual,
  getHashes,
  createSign,
  createVerify,
} from "../../src/polyfills/crypto";
import { BufferImpl } from "../../src/polyfills/stream";

describe("crypto shim", () => {
  it("randomBytes returns BufferImpl of correct length", () => {
    const buf = randomBytes(16);
    expect(buf).toBeInstanceOf(BufferImpl);
    expect(buf.length).toBe(16);
  });

  it("randomUUID matches UUID v4 pattern", () => {
    const uuid = randomUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("randomInt returns number in range", () => {
    for (let i = 0; i < 20; i++) {
      const n = randomInt(0, 10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });

  it('createHash("sha256").update("test").digest("hex") returns hex string', () => {
    const hex = createHash("sha256").update("test").digest("hex");
    expect(typeof hex).toBe("string");
    expect(hex.length).toBeGreaterThan(0);
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it("createHmac returns string on digest", () => {
    const hex = createHmac("sha256", "key").update("data").digest("hex");
    expect(typeof hex).toBe("string");
    expect(hex.length).toBeGreaterThan(0);
  });

  it("timingSafeEqual returns true for equal buffers", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3]);
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it("timingSafeEqual returns false for different buffers", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 4]);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it("timingSafeEqual throws for different lengths", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([1, 2, 3]);
    expect(() => timingSafeEqual(a, b)).toThrow(RangeError);
  });

  it("getHashes includes sha256", () => {
    expect(getHashes()).toContain("sha256");
  });
});

describe("createHash", () => {
  it("produces correct SHA-256 hex digest", () => {
    const hash = createHash("sha256");
    hash.update("hello");
    const result = hash.digest("hex");
    // Known SHA-256 of "hello"
    expect(result).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("produces correct MD5 hex digest", () => {
    const hash = createHash("md5");
    hash.update("hello");
    expect(hash.digest("hex")).toBe("5d41402abc4b2a76b9719d911017c592");
  });

  it("supports multiple update calls", () => {
    const hash = createHash("sha256");
    hash.update("hel");
    hash.update("lo");
    expect(hash.digest("hex")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("returns Buffer when no encoding specified", () => {
    const hash = createHash("sha256");
    hash.update("hello");
    const result = hash.digest();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32); // SHA-256 = 32 bytes
  });

  it("returns base64 when encoding is base64", () => {
    const hash = createHash("sha256");
    hash.update("hello");
    const result = hash.digest("base64");
    expect(typeof result).toBe("string");
    expect(result).toBe("LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=");
  });

  it("handles empty input", () => {
    const hash = createHash("sha256");
    const result = hash.digest("hex");
    // SHA-256 of empty string
    expect(result).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("handles binary input via Uint8Array", () => {
    const hash = createHash("sha256");
    hash.update(new Uint8Array([104, 101, 108, 108, 111])); // "hello"
    expect(hash.digest("hex")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("createSign / createVerify", () => {
  it("sign produces HMAC-based signature, not plain base64", () => {
    const sign = createSign("sha256");
    sign.update("hello");
    const sig = sign.sign("secret-key", "hex");
    // Must NOT be just btoa('hello')
    expect(sig).not.toBe(btoa("hello"));
    expect(typeof sig).toBe("string");
    expect(sig.length).toBeGreaterThan(0);
  });

  it("verify validates correct signature", () => {
    const sign = createSign("sha256");
    sign.update("test data");
    const signature = sign.sign("my-key", "hex");

    const verify = createVerify("sha256");
    verify.update("test data");
    expect(verify.verify("my-key", signature, "hex")).toBe(true);
  });

  it("verify rejects wrong data", () => {
    const sign = createSign("sha256");
    sign.update("original");
    const signature = sign.sign("my-key", "hex");

    const verify = createVerify("sha256");
    verify.update("tampered");
    expect(verify.verify("my-key", signature, "hex")).toBe(false);
  });

  it("verify rejects wrong key", () => {
    const sign = createSign("sha256");
    sign.update("data");
    const signature = sign.sign("key1", "hex");

    const verify = createVerify("sha256");
    verify.update("data");
    expect(verify.verify("key2", signature, "hex")).toBe(false);
  });
});

describe("randomInt", () => {
  it("returns values within range [min, max)", () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(10);
    }
  });

  it("treats single argument as max with min=0", () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(5);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(5);
    }
  });
});

describe("randomBytes", () => {
  it("returns Uint8Array of requested size", () => {
    const bytes = randomBytes(16);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(16);
  });

  it("produces different values on consecutive calls", () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    // Extremely unlikely to be identical
    expect(a).not.toEqual(b);
  });
});
