import { describe, it, expect } from "vitest";
import {
  parse,
  format,
  resolve,
  fileURLToPath,
  pathToFileURL,
} from "../../src/polyfills/url";

describe("url shim", () => {
  it("parse returns correct fields", () => {
    const u = parse("http://example.com:8080/path?q=1#hash");
    expect(u.protocol).toBe("http:");
    expect(u.hostname).toBe("example.com");
    expect(u.port).toBe("8080");
    expect(u.pathname).toBe("/path");
    expect(u.hash).toBe("#hash");
  });

  it("parse with parseQueryString returns object for query", () => {
    const u = parse("http://example.com/path?a=1&b=2", true);
    expect(u.query).toEqual({ a: "1", b: "2" });
  });

  it("format constructs URL from parts", () => {
    const result = format({
      protocol: "https:",
      slashes: true,
      hostname: "example.com",
      pathname: "/foo",
    });
    expect(result).toBe("https://example.com/foo");
  });

  it("resolve resolves relative URL", () => {
    const result = resolve("http://a.com/b", "/c");
    expect(result).toBe("http://a.com/c");
  });

  it("fileURLToPath converts file URL", () => {
    expect(fileURLToPath("file:///tmp/test.txt")).toBe("/tmp/test.txt");
  });

  it("fileURLToPath throws on non-file URL", () => {
    expect(() => fileURLToPath("http://example.com")).toThrow();
  });

  it("pathToFileURL returns URL with file: protocol", () => {
    const url = pathToFileURL("/tmp/test.txt");
    expect(url.protocol).toBe("file:");
    expect(url.href).toContain("/tmp/test.txt");
  });
});
