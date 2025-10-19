import { describe, it, expect } from "vitest";
import { simpleHash } from "../../src/utils/hash";

describe("simpleHash", () => {
  it("produces consistent results", () => {
    expect(simpleHash("hello")).toBe(simpleHash("hello"));
  });

  it("produces different results for different inputs", () => {
    expect(simpleHash("hello")).not.toBe(simpleHash("world"));
  });

  it("produces output longer than 6 chars (not 32-bit)", () => {
    const hash = simpleHash("test");
    expect(hash.length).toBeGreaterThan(6);
  });

  it("handles empty string", () => {
    const hash = simpleHash("");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("handles long strings", () => {
    const long = "x".repeat(100000);
    const hash = simpleHash(long);
    expect(typeof hash).toBe("string");
  });

  it("differentiates similar strings", () => {
    // These are common collision vectors for weak hashes
    const a = simpleHash("ab");
    const b = simpleHash("ba");
    expect(a).not.toBe(b);
  });
});
