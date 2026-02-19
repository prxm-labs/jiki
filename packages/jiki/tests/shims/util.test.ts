import { describe, it, expect, vi } from "vitest";
import {
  format,
  inspect,
  promisify,
  isDeepStrictEqual,
  types,
  inherits,
} from "../../src/polyfills/util";

describe("util shim", () => {
  describe("format", () => {
    it("%s %d substitution", () => {
      expect(format("%s %d", "hello", 42)).toBe("hello 42");
    });

    it("%j JSON substitution", () => {
      expect(format("%j", { a: 1 })).toBe('{"a":1}');
    });

    it("non-string first arg", () => {
      const result = format(42);
      expect(result).toBe("42");
    });
  });

  describe("inspect", () => {
    it('null returns "null"', () => {
      expect(inspect(null)).toBe("null");
    });

    it('undefined returns "undefined"', () => {
      expect(inspect(undefined)).toBe("undefined");
    });

    it("object returns representation", () => {
      const result = inspect({ a: 1 });
      expect(result).toContain("a");
    });

    it("Date returns ISO string", () => {
      const d = new Date("2024-01-01");
      expect(inspect(d)).toBe(d.toISOString());
    });

    it("RegExp returns string", () => {
      expect(inspect(/test/g)).toBe("/test/g");
    });

    it("function returns [Function: name]", () => {
      function myFunc() {}
      expect(inspect(myFunc)).toBe("[Function: myFunc]");
    });
  });

  describe("promisify", () => {
    it("converts callback function to promise-returning", async () => {
      const cbFn = (
        a: number,
        b: number,
        cb: (err: Error | null, result: number) => void,
      ) => {
        cb(null, a + b);
      };
      const promiseFn = promisify(cbFn);
      const result = await promiseFn(1, 2);
      expect(result).toBe(3);
    });

    it("rejects on error", async () => {
      const cbFn = (cb: (err: Error | null) => void) => {
        cb(new Error("fail"));
      };
      const promiseFn = promisify(cbFn);
      await expect(promiseFn()).rejects.toThrow("fail");
    });
  });

  describe("isDeepStrictEqual", () => {
    it("equal objects return true", () => {
      expect(isDeepStrictEqual({ a: 1 }, { a: 1 })).toBe(true);
    });

    it("different objects return false", () => {
      expect(isDeepStrictEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it("equal arrays return true", () => {
      expect(isDeepStrictEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it("nested objects", () => {
      expect(isDeepStrictEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(isDeepStrictEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });

    it("primitives", () => {
      expect(isDeepStrictEqual(1, 1)).toBe(true);
      expect(isDeepStrictEqual(1, 2)).toBe(false);
    });
  });

  describe("types", () => {
    it("isDate", () => {
      expect(types.isDate(new Date())).toBe(true);
      expect(types.isDate("not a date")).toBe(false);
    });

    it("isRegExp", () => {
      expect(types.isRegExp(/x/)).toBe(true);
      expect(types.isRegExp("x")).toBe(false);
    });

    it("isPromise", () => {
      expect(types.isPromise(Promise.resolve())).toBe(true);
      expect(types.isPromise({})).toBe(false);
    });
  });

  describe("inherits", () => {
    it("sets prototype chain", () => {
      function Parent(this: any) {}
      Parent.prototype.hello = () => "hi";
      function Child(this: any) {}
      inherits(Child, Parent);
      const c = new (Child as any)();
      expect(c.hello()).toBe("hi");
    });
  });
});
