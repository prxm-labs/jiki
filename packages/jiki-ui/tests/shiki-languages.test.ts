import { describe, it, expect } from "vitest";
import { getShikiLang } from "../src/shiki-languages";

describe("getShikiLang", () => {
  it.each([
    ["index.js", "javascript"],
    ["utils.mjs", "javascript"],
    ["config.cjs", "javascript"],
    ["app.ts", "typescript"],
    ["app.mts", "typescript"],
    ["Component.jsx", "jsx"],
    ["Component.tsx", "tsx"],
    ["data.json", "json"],
    ["index.html", "html"],
    ["style.css", "css"],
    ["README.md", "markdown"],
    ["App.vue", "vue"],
    ["App.svelte", "svelte"],
    ["page.astro", "astro"],
    ["config.yaml", "yaml"],
    ["config.yml", "yaml"],
    ["config.toml", "toml"],
    ["script.sh", "shellscript"],
  ])("maps %s to %s", (filename, expected) => {
    expect(getShikiLang(filename)).toBe(expected);
  });

  it("returns plaintext for unknown extensions", () => {
    expect(getShikiLang("file.xyz")).toBe("plaintext");
  });

  it("returns plaintext for null", () => {
    expect(getShikiLang(null)).toBe("plaintext");
  });
});
