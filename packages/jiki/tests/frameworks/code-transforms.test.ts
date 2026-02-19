import { describe, it, expect } from "vitest";
import { transformEsmToCjsSimple } from "../../src/frameworks/code-transforms";

describe("transformEsmToCjsSimple", () => {
  it('import default: import x from "y"', () => {
    const result = transformEsmToCjsSimple('import x from "y";');
    expect(result).toContain('const x = require("y")');
  });

  it('import named: import { a, b as c } from "y"', () => {
    const result = transformEsmToCjsSimple('import { a, b as c } from "y";');
    expect(result).toContain('require("y")');
    expect(result).toContain("a");
    expect(result).toContain("c");
  });

  it('import namespace: import * as x from "y"', () => {
    const result = transformEsmToCjsSimple('import * as x from "y";');
    expect(result).toContain('const x = require("y")');
  });

  it('import side-effect: import "y"', () => {
    const result = transformEsmToCjsSimple('import "y";');
    expect(result).toContain('require("y")');
  });

  it("export default expression", () => {
    const result = transformEsmToCjsSimple("export default 42;");
    expect(result).toContain("module.exports");
    expect(result).toContain("exports.default");
    expect(result).toContain("42");
  });

  it("export const x = 1", () => {
    const result = transformEsmToCjsSimple("export const x = 1;");
    expect(result).toContain("const x = 1");
    expect(result).toContain("defineProperty");
    expect(result).toContain('"x"');
  });

  it("export { a, b }", () => {
    const code = "const a = 1;\nconst b = 2;\nexport { a, b };";
    const result = transformEsmToCjsSimple(code);
    expect(result).toContain("defineProperty");
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
  });

  it('export * from "y" uses filtered assignment (not plain Object.assign)', () => {
    const result = transformEsmToCjsSimple('export * from "y";');
    // Should NOT use plain Object.assign (prototype pollution risk)
    expect(result).not.toContain("Object.assign(exports, require(");
    // Should contain a require call for the module
    expect(result).toContain('require("y")');
  });

  it("export * from does not re-export default", () => {
    // ESM spec: export * does NOT include the default export
    const result = transformEsmToCjsSimple(`export * from 'mod';`);
    expect(result).toContain('"default"');
    // The transformed code should filter out "default"
  });

  it("export * from filters __proto__", () => {
    const result = transformEsmToCjsSimple(`export * from 'evil';`);
    expect(result).toContain("__proto__");
    // The transformed code should filter out "__proto__"
  });

  it("export * from filters constructor and prototype", () => {
    const result = transformEsmToCjsSimple(`export * from 'pkg';`);
    expect(result).toContain('"constructor"');
    expect(result).toContain('"prototype"');
  });

  it("export * from uses hasOwnProperty check", () => {
    const result = transformEsmToCjsSimple(`export * from 'pkg';`);
    expect(result).toContain("hasOwnProperty");
  });

  it("mixed imports and exports", () => {
    const code = `import path from 'path';
import { readFile } from 'fs';
export const x = path.join('a', 'b');
export default x;`;
    const result = transformEsmToCjsSimple(code);
    expect(result).toContain('require("path")');
    expect(result).toContain('require("fs")');
    expect(result).toContain("module.exports");
  });

  it("export function name()", () => {
    const result = transformEsmToCjsSimple(
      "export function hello() { return 42; }",
    );
    expect(result).toContain("function hello()");
    expect(result).toContain("defineProperty");
    expect(result).toContain('"hello"');
  });

  it("export class name", () => {
    const result = transformEsmToCjsSimple("export class Foo {}");
    expect(result).toContain("class Foo");
    expect(result).toContain("defineProperty");
    expect(result).toContain('"Foo"');
  });

  it("preserves non-module code unchanged", () => {
    const code = "const x = 42;\nconsole.log(x);";
    expect(transformEsmToCjsSimple(code)).toBe(code);
  });

  describe("multiline imports", () => {
    it("handles import { ... } spanning multiple lines", () => {
      const code = `import {\n  a,\n  b,\n  c\n} from 'module';`;
      const result = transformEsmToCjsSimple(code);
      expect(result).toContain('require("module")');
      expect(result).toContain("a");
      expect(result).toContain("b");
      expect(result).toContain("c");
    });

    it("handles multiline named imports with aliases", () => {
      const code = `import {\n  foo as bar,\n  baz\n} from 'pkg';`;
      const result = transformEsmToCjsSimple(code);
      expect(result).toContain('require("pkg")');
      expect(result).toContain("bar");
      expect(result).toContain("baz");
    });

    it("handles multiline export { ... }", () => {
      const code = `const a = 1;\nconst b = 2;\nexport {\n  a,\n  b\n};`;
      const result = transformEsmToCjsSimple(code);
      expect(result).toContain("defineProperty");
      expect(result).toContain('"a"');
      expect(result).toContain('"b"');
    });

    it("handles multiline export { ... } from", () => {
      const code = `export {\n  x,\n  y\n} from 'other';`;
      const result = transformEsmToCjsSimple(code);
      expect(result).toContain('require("other")');
      expect(result).toContain('"x"');
      expect(result).toContain('"y"');
    });

    it("handles multiline combined default + named import", () => {
      const code = `import React, {\n  useState,\n  useEffect\n} from 'react';`;
      const result = transformEsmToCjsSimple(code);
      expect(result).toContain('require("react")');
      expect(result).toContain("React");
      expect(result).toContain("useState");
      expect(result).toContain("useEffect");
    });
  });
});
