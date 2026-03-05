import { describe, it, expect } from "vitest";
import { escapeHtml, buildFallbackHtml } from "../src/use-shiki-highlighter";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all HTML entities in code", () => {
    expect(escapeHtml("if (a < b && c > d) {}")).toBe(
      "if (a &lt; b &amp;&amp; c &gt; d) {}",
    );
  });
});

describe("buildFallbackHtml", () => {
  it("wraps escaped code in pre/code tags with transparent bg", () => {
    const html = buildFallbackHtml("<div>");
    expect(html).toContain("&lt;div&gt;");
    expect(html).toContain("background:transparent");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
  });

  it("uses zinc-200 equivalent color for plain text", () => {
    const html = buildFallbackHtml("hello");
    expect(html).toContain("color:#e4e4e7");
  });
});
