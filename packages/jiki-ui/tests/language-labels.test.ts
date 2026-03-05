import { describe, it, expect } from "vitest";
import { getLanguageLabel } from "../src/language-labels";

describe("getLanguageLabel", () => {
  it.each([
    ["index.js", "JavaScript"],
    ["app.ts", "TypeScript"],
    ["Component.tsx", "TSX"],
    ["Component.jsx", "JSX"],
    ["data.json", "JSON"],
    ["README.md", "Markdown"],
    ["index.html", "HTML"],
    ["style.css", "CSS"],
    ["App.vue", "Vue SFC"],
    ["App.svelte", "Svelte"],
    ["page.astro", "Astro"],
  ])("returns %s for %s", (filename, expected) => {
    expect(getLanguageLabel(filename)).toBe(expected);
  });

  it("returns Plain Text for unknown extensions", () => {
    expect(getLanguageLabel("file.xyz")).toBe("Plain Text");
  });

  it("returns Plain Text for extensionless files", () => {
    expect(getLanguageLabel("Makefile")).toBe("Plain Text");
  });
});
