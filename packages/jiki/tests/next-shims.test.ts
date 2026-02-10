import { describe, it, expect } from "vitest";
import { NEXT_FONT_GOOGLE_SHIM } from "../src/frameworks/next-shims";

describe("Next.js shims - Google Fonts preconnect deduplication (Finding #62)", () => {
  it("shim uses addedPreconnects Set for deduplication", () => {
    // The shim string should contain the deduplication Set
    expect(NEXT_FONT_GOOGLE_SHIM).toContain("addedPreconnects");
    expect(NEXT_FONT_GOOGLE_SHIM).toContain("new Set()");
  });

  it("shim uses addPreconnect helper function", () => {
    expect(NEXT_FONT_GOOGLE_SHIM).toContain("addPreconnect(");
    expect(NEXT_FONT_GOOGLE_SHIM).toContain(
      "if (addedPreconnects.has(url)) return",
    );
  });

  it("shim does not use inline querySelector check for preconnect", () => {
    // The old pattern was checking querySelector directly - should be replaced
    expect(NEXT_FONT_GOOGLE_SHIM).not.toContain(
      "document.querySelector('link[href=\"https://fonts.googleapis.com\"]'",
    );
  });
});
