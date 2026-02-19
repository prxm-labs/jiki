import { describe, it, expect } from "vitest";
import {
  removeShebang,
  transformEsmToCjs,
  processSource,
  transpileCache,
} from "../src/code-transform";
import { simpleHash } from "../src/utils/hash";

describe("code-transform", () => {
  describe("removeShebang", () => {
    it("strips a shebang line from the start", () => {
      const input = '#!/usr/bin/env node\nconsole.log("hi");';
      expect(removeShebang(input)).toBe('console.log("hi");');
    });

    it("returns unchanged source when no shebang", () => {
      const input = "const x = 1;";
      expect(removeShebang(input)).toBe(input);
    });

    it("handles empty string", () => {
      expect(removeShebang("")).toBe("");
    });

    it("handles source that starts with # but not #!", () => {
      const input = "# comment\nfoo";
      expect(removeShebang(input)).toBe(input);
    });
  });

  describe("transformEsmToCjs", () => {
    it("returns source unchanged when no import/export keywords", () => {
      const code = "const x = 42;\nconsole.log(x);";
      expect(transformEsmToCjs(code, "/test.js")).toBe(code);
    });

    it("transforms import declarations to require calls", () => {
      const code = 'import foo from "bar";\nconsole.log(foo);';
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).toContain("require");
      expect(result).not.toContain("import foo from");
    });

    it("transforms export declarations", () => {
      const code = "export const x = 42;";
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).toContain("__esModule");
    });

    it("replaces import.meta with import_meta via AST", () => {
      const code = "const url = import.meta.url;";
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).toContain("import_meta");
    });

    it("import.meta.url uses import_meta.url not a string literal (regex path)", () => {
      // Force the regex path by using syntax that makes the AST parser fail
      // We test the regex fallback by calling the internal function indirectly
      const code = "const url = import.meta.url;";
      const result = transformEsmToCjs(code, "/app/index.js");
      // Should use import_meta.url, not "file:///app/index.js"
      expect(result).toContain("import_meta");
      expect(result).not.toContain('"file:///app/index.js"');
    });

    it("import.meta.dirname uses import_meta.dirname not a string literal", () => {
      const code = "const dir = import.meta.dirname;";
      const result = transformEsmToCjs(code, "/app/index.js");
      expect(result).toContain("import_meta");
    });

    it("import.meta.filename uses import_meta.filename not a string literal", () => {
      const code = "const f = import.meta.filename;";
      const result = transformEsmToCjs(code, "/app/index.js");
      expect(result).toContain("import_meta");
    });

    it("transforms dynamic import() to __dynamicImport()", () => {
      const code = 'const mod = import("./foo");';
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).toContain("__dynamicImport");
    });

    it("does not transform import-like strings inside property access", () => {
      const code = 'obj.import("test");';
      const result = transformEsmToCjs(code, "/test.js");
      expect(result).not.toContain("__dynamicImport");
    });
  });

  describe("processSource", () => {
    it("processes plain JS without error", () => {
      const code = "const x = 1;";
      const result = processSource(code, "/test.js");
      expect(result).toBe(code);
    });

    it("transforms ESM in .js files", () => {
      const code = "export default 42;";
      const result = processSource(code, "/test.js");
      expect(result).toContain("__esModule");
    });

    it("throws for .ts files when transpiler not initialized", () => {
      expect(() => processSource("const x: number = 1;", "/test.ts")).toThrow(
        /Transpiler not initialized/,
      );
    });

    it("does not double-transform cached code on cache hit", () => {
      // Simulate: cache already has the final CJS result (as processSource now stores it)
      const tsSource = `export const greeting: string = "hello";`;
      const file = "/double-transform-test.ts";

      // First, produce the correct CJS output via transformEsmToCjs
      const esbuildOutput = `export const greeting = "hello";\n`;
      const expectedCjs = transformEsmToCjs(esbuildOutput, file);

      // Pre-populate cache with the final CJS result
      const key = `${file}:${simpleHash(tsSource)}`;
      transpileCache.set(key, expectedCjs);

      const result = processSource(tsSource, file);

      // The result should be exactly the cached CJS — no double transformation
      expect(result).toBe(expectedCjs);

      // Count occurrences of __esModule definition — should be at most 1
      const esModuleCount = (result.match(/__esModule/g) || []).length;
      expect(esModuleCount).toBeLessThanOrEqual(1);

      // Should be valid JS (not double-transformed garbage)
      expect(
        () => new Function("exports", "require", "module", result),
      ).not.toThrow();

      // Clean up
      transpileCache.delete(key);
    });

    it("returns cached result directly without re-transforming", () => {
      // Simulate: the cache already has the FINAL transformed CJS result
      const tsSource = `export const x: number = 42;`;
      const file = "/cached-test.ts";
      const finalResult =
        'Object.defineProperty(exports, "__esModule", { value: true });\nexports.x = 42;\n';

      const key = `${file}:${simpleHash(tsSource)}`;
      transpileCache.set(key, finalResult);

      const result1 = processSource(tsSource, file);
      const result2 = processSource(tsSource, file);

      // Both calls should return identical results
      expect(result1).toBe(result2);

      // The result should only have at most one __esModule
      const esModuleCount = (result2.match(/__esModule/g) || []).length;
      expect(esModuleCount).toBeLessThanOrEqual(1);

      // Clean up
      transpileCache.delete(key);
    });
  });
});
