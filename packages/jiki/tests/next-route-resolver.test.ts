import { describe, it, expect } from "vitest";
import {
  resolveFileWithExtension,
  resolvePageFile,
  resolveApiFile,
  type RouteResolverContext,
} from "../src/frameworks/next-route-resolver";

function makeCtx(files: string[]): RouteResolverContext {
  const fileSet = new Set(files);
  const dirs = new Set<string>();
  for (const f of files) {
    let cur = f;
    while (cur !== "/") {
      cur = cur.replace(/\/[^/]+$/, "") || "/";
      dirs.add(cur);
    }
  }
  return {
    exists: (p: string) => fileSet.has(p) || dirs.has(p),
    isDirectory: (p: string) => dirs.has(p),
    readdir: (p: string) => {
      const prefix = p === "/" ? "/" : p + "/";
      const entries = new Set<string>();
      for (const f of [...files, ...dirs]) {
        if (f.startsWith(prefix) && f !== p) {
          const rest = f.slice(prefix.length);
          const seg = rest.split("/")[0];
          if (seg) entries.add(seg);
        }
      }
      return [...entries];
    },
  };
}

describe("Next.js route resolver - extension priority (Finding #61)", () => {
  it("prefers .ts over .js for page resolution", () => {
    const ctx = makeCtx(["/pages/index.js", "/pages/index.ts"]);
    const result = resolvePageFile("/pages", "/", ctx);
    // .ts should be preferred (comes first in extension order)
    expect(result).toBe("/pages/index.ts");
  });

  it("prefers .tsx over .jsx for page resolution", () => {
    const ctx = makeCtx(["/pages/about.jsx", "/pages/about.tsx"]);
    const result = resolvePageFile("/pages", "/about", ctx);
    expect(result).toBe("/pages/about.tsx");
  });

  it("prefers .ts over .js for API resolution", () => {
    const ctx = makeCtx(["/pages/api/hello.js", "/pages/api/hello.ts"]);
    const result = resolveApiFile("/pages", "/api/hello", ctx);
    expect(result).toBe("/pages/api/hello.ts");
  });

  it("prefers .ts/.tsx for resolveFileWithExtension", () => {
    const ctx = makeCtx(["/src/utils.js", "/src/utils.ts"]);
    const result = resolveFileWithExtension("/src/utils", ctx);
    expect(result).toBe("/src/utils.ts");
  });
});
