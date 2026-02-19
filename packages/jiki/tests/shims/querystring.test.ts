import { describe, it, expect } from "vitest";
import {
  stringify,
  parse,
  escape,
  unescape,
} from "../../src/polyfills/querystring";

describe("querystring shim", () => {
  it("stringify simple object", () => {
    expect(stringify({ a: "1", b: "2" })).toBe("a=1&b=2");
  });

  it("parse simple string", () => {
    expect(parse("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });

  it("stringify arrays", () => {
    const result = stringify({ a: [1, 2] as any });
    expect(result).toBe("a=1&a=2");
  });

  it("parse repeated keys into arrays", () => {
    const result = parse("a=1&a=2");
    expect(result).toEqual({ a: ["1", "2"] });
  });

  it("custom separators", () => {
    expect(stringify({ a: "1", b: "2" }, ";", ":")).toBe("a:1;b:2");
  });

  it("parse with custom separators", () => {
    expect(parse("a:1;b:2", ";", ":")).toEqual({ a: "1", b: "2" });
  });

  it("escape encodes special chars", () => {
    expect(escape("hello world")).toBe("hello%20world");
  });

  it("unescape decodes special chars", () => {
    expect(unescape("hello%20world")).toBe("hello world");
  });

  it("handles empty input", () => {
    expect(stringify(null as any)).toBe("");
    expect(parse("")).toEqual({});
  });
});
