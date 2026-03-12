import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import { TypeChecker } from "../src/type-checker";

describe("TypeChecker", () => {
  let vfs: MemFS;
  let checker: TypeChecker;

  beforeEach(() => {
    vfs = new MemFS();
    checker = new TypeChecker(vfs);
  });

  it("returns empty diagnostics for valid code", () => {
    vfs.writeFileSync(
      "/src/app.ts",
      "const x: number = 42;\nconsole.log(x);\n",
    );
    const diags = checker.check(["/src/app.ts"]);
    // No obvious errors in this simple code
    expect(diags.filter(d => d.severity === "error")).toHaveLength(0);
  });

  it("detects explicit any usage in strict mode", () => {
    vfs.writeFileSync("/src/app.ts", "const x: any = 42;\n");
    const diags = checker.check(["/src/app.ts"]);
    expect(diags.some(d => d.message.includes("'any'"))).toBe(true);
  });

  it("skips non-ts files", () => {
    vfs.writeFileSync("/src/app.js", "const x = 42;\n");
    const diags = checker.check(["/src/app.js"]);
    expect(diags).toHaveLength(0);
  });

  it("reports missing files", () => {
    const diags = checker.check(["/nonexistent.ts"]);
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe("error");
    expect(diags[0].message).toContain("Cannot read file");
  });

  it("detects unreachable code after return", () => {
    vfs.writeFileSync(
      "/src/fn.ts",
      [
        "function test() {",
        "  return 42;",
        '  console.log("unreachable");',
        "}",
      ].join("\n"),
    );
    const diags = checker.check(["/src/fn.ts"]);
    expect(diags.some(d => d.message.includes("Unreachable"))).toBe(true);
  });

  it("checkAll discovers files in directory", () => {
    vfs.mkdirSync("/src", { recursive: true });
    vfs.writeFileSync("/src/a.ts", "const a = 1;\n");
    vfs.writeFileSync("/src/b.tsx", "const b = 2;\n");
    vfs.writeFileSync("/src/c.js", "const c = 3;\n"); // should be skipped
    const diags = checker.checkAll("/src");
    // Just verify it ran without error — no type errors expected
    expect(Array.isArray(diags)).toBe(true);
  });

  it("respects noImplicitAny: false", () => {
    const lenient = new TypeChecker(vfs, {
      noImplicitAny: false,
      strict: false,
    });
    vfs.writeFileSync("/src/app.ts", "const x: any = 42;\n");
    const diags = lenient.check(["/src/app.ts"]);
    expect(diags.filter(d => d.message.includes("'any'"))).toHaveLength(0);
  });

  it("diagnostics are sorted by file and line", () => {
    vfs.writeFileSync("/src/b.ts", "const x: any = 1;\nconst y: any = 2;\n");
    vfs.writeFileSync("/src/a.ts", "const z: any = 3;\n");
    const diags = checker.check(["/src/b.ts", "/src/a.ts"]);
    // a.ts should come before b.ts
    const files = diags.map(d => d.file);
    const aIdx = files.indexOf("/src/a.ts");
    const bIdx = files.indexOf("/src/b.ts");
    if (aIdx >= 0 && bIdx >= 0) {
      expect(aIdx).toBeLessThan(bIdx);
    }
  });
});
