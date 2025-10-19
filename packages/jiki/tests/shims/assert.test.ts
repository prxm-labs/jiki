import { describe, it, expect } from "vitest";
import assert from "../../src/polyfills/assert";

describe("assert shim", () => {
  it("assert(true) passes", () => {
    expect(() => assert(true)).not.toThrow();
  });

  it("assert(false) throws", () => {
    expect(() => assert(false)).toThrow();
  });

  it("assert.ok(1) passes", () => {
    expect(() => assert.ok(1)).not.toThrow();
  });

  it("assert.strictEqual(1, 1) passes", () => {
    expect(() => assert.strictEqual(1, 1)).not.toThrow();
  });

  it("assert.strictEqual(1, 2) throws", () => {
    expect(() => assert.strictEqual(1, 2)).toThrow();
  });

  it("assert.deepEqual with equal objects passes", () => {
    expect(() => assert.deepEqual({ a: 1 }, { a: 1 })).not.toThrow();
  });

  it("assert.deepEqual with different objects throws", () => {
    expect(() => assert.deepEqual({ a: 1 }, { a: 2 })).toThrow();
  });

  it("assert.throws catches thrown error", () => {
    expect(() =>
      assert.throws(() => {
        throw new Error("test");
      }),
    ).not.toThrow();
  });

  it("assert.throws throws when function does not throw", () => {
    expect(() => assert.throws(() => {})).toThrow();
  });

  it("assert.doesNotThrow passes for non-throwing fn", () => {
    expect(() => assert.doesNotThrow(() => {})).not.toThrow();
  });

  it("assert.doesNotThrow throws for throwing fn", () => {
    expect(() =>
      assert.doesNotThrow(() => {
        throw new Error("oops");
      }),
    ).toThrow();
  });

  it("assert.match passes for matching", () => {
    expect(() => assert.match("hello", /ell/)).not.toThrow();
  });

  it("assert.match throws for non-matching", () => {
    expect(() => assert.match("hello", /xyz/)).toThrow();
  });

  it("assert.fail always throws", () => {
    expect(() => assert.fail()).toThrow();
    expect(() => assert.fail("custom message")).toThrow("custom message");
  });

  it("assert.equal uses loose equality", () => {
    expect(() => assert.equal(1, "1" as any)).not.toThrow();
  });

  it("assert.notEqual", () => {
    expect(() => assert.notEqual(1, 2)).not.toThrow();
    expect(() => assert.notEqual(1, 1)).toThrow();
  });

  it("assert.notStrictEqual", () => {
    expect(() => assert.notStrictEqual(1, 2)).not.toThrow();
    expect(() => assert.notStrictEqual(1, 1)).toThrow();
  });
});
