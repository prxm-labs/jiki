import { describe, it, expect } from "vitest";
import { MemFS } from "../src/memfs";
import {
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  preprocessImports,
} from "../src/browser-bundle";

function createVfs(): MemFS {
  return new MemFS();
}

function writePackage(
  vfs: MemFS,
  name: string,
  pkg: Record<string, unknown>,
  files: Record<string, string>,
) {
  const root = `/node_modules/${name}`;
  vfs.mkdirSync(root, { recursive: true });
  vfs.writeFileSync(`${root}/package.json`, JSON.stringify(pkg));
  for (const [rel, content] of Object.entries(files)) {
    const dir = rel.includes("/")
      ? `${root}/${rel.substring(0, rel.lastIndexOf("/"))}`
      : null;
    if (dir) vfs.mkdirSync(dir, { recursive: true });
    vfs.writeFileSync(`${root}/${rel}`, content);
  }
}

describe("browser-bundle", () => {
  describe("bundlePackageForBrowser", () => {
    it("resolves package entry from VFS package.json main field", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "my-lib",
        { name: "my-lib", main: "index.js" },
        {
          "index.js": 'module.exports = { hello: "world" };',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "my-lib", new Set());
      expect(bundle.entryPath).toBe("/node_modules/my-lib/index.js");
      expect(bundle.modules.has("/node_modules/my-lib/index.js")).toBe(true);
    });

    it("handles the module field", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "esm-lib",
        { name: "esm-lib", module: "dist/esm.js" },
        { "dist/esm.js": "export const x = 1;" },
      );

      const bundle = bundlePackageForBrowser(vfs, "esm-lib", new Set());
      expect(bundle.entryPath).toBe("/node_modules/esm-lib/dist/esm.js");
      expect(bundle.modules.size).toBe(1);
    });

    it("handles the browser field (string)", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "browser-lib",
        { name: "browser-lib", browser: "browser.js", main: "index.js" },
        {
          "browser.js": 'module.exports = "browser";',
          "index.js": 'module.exports = "node";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "browser-lib", new Set());
      expect(bundle.entryPath).toBe("/node_modules/browser-lib/browser.js");
    });

    it("transforms ESM to CJS", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "esm-pkg",
        { name: "esm-pkg", main: "index.js" },
        {
          "index.js": 'export function greet() { return "hi"; }',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "esm-pkg", new Set());
      const code = bundle.modules.get(bundle.entryPath)!;
      expect(code).toContain("exports");
      expect(code).not.toMatch(/^export\s/m);
    });

    it("recursively bundles local dependencies", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "pkg-a",
        { name: "pkg-a", main: "index.js" },
        {
          "index.js": 'const b = require("./util");\nmodule.exports = b;',
          "util.js": "module.exports = 42;",
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "pkg-a", new Set());
      expect(bundle.modules.size).toBe(2);
      expect(bundle.modules.has("/node_modules/pkg-a/util.js")).toBe(true);
    });

    it("recursively bundles package dependencies", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "dep-b",
        { name: "dep-b", main: "index.js" },
        {
          "index.js": 'module.exports = "dep-b";',
        },
      );
      writePackage(
        vfs,
        "dep-a",
        { name: "dep-a", main: "index.js" },
        {
          "index.js": 'const b = require("dep-b");\nmodule.exports = b;',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "dep-a", new Set());
      expect(bundle.modules.size).toBe(2);
      expect(bundle.modules.has("/node_modules/dep-b/index.js")).toBe(true);
    });

    it("skips externals", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "ui-lib",
        { name: "ui-lib", main: "index.js" },
        {
          "index.js":
            'const React = require("react");\nmodule.exports = React;',
        },
      );

      const externals = new Set(["react"]);
      const bundle = bundlePackageForBrowser(vfs, "ui-lib", externals);
      expect(bundle.modules.size).toBe(1);
      expect(bundle.modules.has("/node_modules/react/index.js")).toBeFalsy();
    });

    it("skips Node.js builtins", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "node-user",
        { name: "node-user", main: "index.js" },
        {
          "index.js":
            'const path = require("path");\nmodule.exports = path.join;',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "node-user", new Set());
      expect(bundle.modules.size).toBe(1);
    });

    it("handles JSON files", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "json-pkg",
        { name: "json-pkg", main: "index.js" },
        {
          "index.js": 'module.exports = require("./data.json");',
          "data.json": '{"key": "value"}',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "json-pkg", new Set());
      expect(bundle.modules.size).toBe(2);
      const jsonCode = bundle.modules.get("/node_modules/json-pkg/data.json")!;
      expect(jsonCode).toContain("module.exports");
    });

    it("throws when package cannot be resolved", () => {
      const vfs = createVfs();
      expect(() =>
        bundlePackageForBrowser(vfs, "nonexistent", new Set()),
      ).toThrow('Cannot resolve package "nonexistent"');
    });

    it("handles exports map in package.json", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "exports-pkg",
        {
          name: "exports-pkg",
          exports: {
            ".": { require: "./dist/cjs.js", import: "./dist/esm.js" },
          },
        },
        {
          "dist/cjs.js": 'module.exports = "cjs";',
          "dist/esm.js": 'export default "esm";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "exports-pkg", new Set());
      expect(bundle.entryPath).toBe("/node_modules/exports-pkg/dist/cjs.js");
    });

    it("does not revisit already-visited modules (handles cycles)", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "cycle-a",
        { name: "cycle-a", main: "index.js" },
        {
          "index.js": 'require("./a"); require("./b");',
          "a.js": 'require("./b");',
          "b.js": 'require("./a");',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "cycle-a", new Set());
      expect(bundle.modules.size).toBe(3);
    });

    it("handles browser field as object (field-level remapping)", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "remap-lib",
        {
          name: "remap-lib",
          main: "lib/node.js",
          browser: { "lib/node.js": "lib/browser.js" },
        },
        {
          "lib/node.js": 'module.exports = "node";',
          "lib/browser.js": 'module.exports = "browser";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "remap-lib", new Set());
      expect(bundle.entryPath).toBe("/node_modules/remap-lib/lib/browser.js");
    });

    it("prefers browser condition in exports map", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "cond-pkg",
        {
          name: "cond-pkg",
          exports: {
            ".": {
              browser: { require: "./dist/browser.cjs" },
              require: "./dist/node.cjs",
            },
          },
        },
        {
          "dist/browser.cjs": 'module.exports = "browser";',
          "dist/node.cjs": 'module.exports = "node";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "cond-pkg", new Set());
      expect(bundle.entryPath).toBe("/node_modules/cond-pkg/dist/browser.cjs");
    });

    it("survives transformEsmToCjs failure for individual files", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "bad-esm",
        { name: "bad-esm", main: "index.js" },
        {
          "index.js": 'module.exports = require("./ok");',
          "ok.js": "module.exports = 42;",
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "bad-esm", new Set());
      expect(bundle.modules.size).toBe(2);
    });
  });

  describe("generateRequireScript", () => {
    it("produces a script tag with require() shim", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "test-lib",
        { name: "test-lib", main: "index.js" },
        {
          "index.js": 'module.exports = { name: "test" };',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "test-lib", new Set());
      const bundles = new Map([["test-lib", bundle]]);
      const script = generateRequireScript(bundles, {});

      expect(script).toContain("<script>");
      expect(script).toContain("</script>");
      expect(script).toContain("window.require");
      expect(script).toContain("test-lib");
    });

    it("maps CDN globals correctly", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "my-pkg",
        { name: "my-pkg", main: "index.js" },
        {
          "index.js": "module.exports = {};",
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "my-pkg", new Set());
      const bundles = new Map([["my-pkg", bundle]]);
      const script = generateRequireScript(bundles, {
        react: "React",
        "react-dom": "ReactDOM",
      });

      expect(script).toContain('"react"');
      expect(script).toContain('"React"');
      expect(script).toContain('"react-dom"');
      expect(script).toContain('"ReactDOM"');
    });

    it("maps package names to entry paths", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "pkg-x",
        { name: "pkg-x", main: "dist/main.js" },
        {
          "dist/main.js": 'module.exports = "x";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "pkg-x", new Set());
      const bundles = new Map([["pkg-x", bundle]]);
      const script = generateRequireScript(bundles, {});

      expect(script).toContain("/node_modules/pkg-x/dist/main.js");
    });

    it("includes transformed module code in the output", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "code-lib",
        { name: "code-lib", main: "index.js" },
        {
          "index.js": "module.exports = { value: 42 };",
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "code-lib", new Set());
      const bundles = new Map([["code-lib", bundle]]);
      const script = generateRequireScript(bundles, {});

      expect(script).toContain("value: 42");
    });

    it("escapes </script> in bundled code to prevent HTML breakage", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "html-lib",
        { name: "html-lib", main: "index.js" },
        {
          "index.js": 'module.exports = "</script><script>alert(1)</script>";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "html-lib", new Set());
      const bundles = new Map([["html-lib", bundle]]);
      const script = generateRequireScript(bundles, {});

      const unescapedCount = (script.match(/<\/script>/gi) || []).length;
      expect(unescapedCount).toBe(1);
    });

    it("wraps module factory in try/catch for robustness", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "ok-mod",
        { name: "ok-mod", main: "index.js" },
        {
          "index.js": 'module.exports = "ok";',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "ok-mod", new Set());
      const bundles = new Map([["ok-mod", bundle]]);
      const script = generateRequireScript(bundles, {});

      expect(script).toContain("try {");
      expect(script).toContain("catch (e)");
    });

    it("uses 'in' operator for global checks to support falsy globals", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "g-lib",
        { name: "g-lib", main: "index.js" },
        {
          "index.js": "module.exports = {};",
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "g-lib", new Set());
      const bundles = new Map([["g-lib", bundle]]);
      const script = generateRequireScript(bundles, { react: "React" });

      expect(script).toContain("id in __g");
    });
  });

  describe("scanBareImports", () => {
    it("finds bare-specifier imports", () => {
      const sources = [
        'import { Camera } from "lucide-react";',
        'import axios from "axios";',
      ];
      const result = scanBareImports(sources);
      expect(result).toContain("lucide-react");
      expect(result).toContain("axios");
    });

    it("ignores relative imports", () => {
      const sources = ['import { foo } from "./utils";'];
      const result = scanBareImports(sources);
      expect(result.size).toBe(0);
    });

    it("handles scoped packages", () => {
      const sources = ['import { Button } from "@radix-ui/react-button";'];
      const result = scanBareImports(sources);
      expect(result).toContain("@radix-ui/react-button");
    });

    it("deduplicates imports across sources", () => {
      const sources = ['import { A } from "pkg";', 'import { B } from "pkg";'];
      const result = scanBareImports(sources);
      expect(result.size).toBe(1);
      expect(result).toContain("pkg");
    });

    it("preserves full specifier for subpath imports", () => {
      const sources = ['import { something } from "lodash/merge";'];
      const result = scanBareImports(sources);
      expect(result).toContain("lodash/merge");
      expect(result).not.toContain("lodash");
    });

    it("preserves scoped package subpath imports", () => {
      const sources = [
        'import { Checkbox } from "@base-ui/react/checkbox";',
        'import { Dialog } from "@base-ui/react/dialog";',
      ];
      const result = scanBareImports(sources);
      expect(result).toContain("@base-ui/react/checkbox");
      expect(result).toContain("@base-ui/react/dialog");
      expect(result.size).toBe(2);
    });

    it("returns empty set for no imports", () => {
      const result = scanBareImports(["const x = 1;"]);
      expect(result.size).toBe(0);
    });

    it("skips TypeScript type-only imports", () => {
      const sources = [
        'import type { Foo } from "some-types";',
        'import { Bar } from "real-pkg";',
      ];
      const result = scanBareImports(sources);
      expect(result).not.toContain("some-types");
      expect(result).toContain("real-pkg");
    });

    it("handles multi-line destructured imports", () => {
      const sources = ['import {\n  Camera,\n  Heart\n} from "lucide-react";'];
      const result = scanBareImports(sources);
      expect(result).toContain("lucide-react");
    });

    it("handles default + named imports", () => {
      const sources = ['import React, { useState } from "react";'];
      const result = scanBareImports(sources);
      expect(result).toContain("react");
    });

    it("handles namespace imports", () => {
      const sources = ['import * as icons from "my-icons";'];
      const result = scanBareImports(sources);
      expect(result).toContain("my-icons");
    });
  });

  describe("depMap (transitive dependency tracking)", () => {
    it("records bare specifier deps resolved during bundling", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "dep-inner",
        { name: "dep-inner", main: "index.js" },
        {
          "index.js": 'module.exports = "inner";',
        },
      );
      writePackage(
        vfs,
        "dep-outer",
        { name: "dep-outer", main: "index.js" },
        {
          "index.js":
            'var inner = require("dep-inner");\nmodule.exports = inner;',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "dep-outer", new Set());
      expect(bundle.depMap.get("dep-inner")).toBe(
        "/node_modules/dep-inner/index.js",
      );
    });

    it("does not record relative deps in depMap", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "rel-pkg",
        { name: "rel-pkg", main: "index.js" },
        {
          "index.js": 'var u = require("./util");\nmodule.exports = u;',
          "util.js": "module.exports = 1;",
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "rel-pkg", new Set());
      expect(bundle.depMap.size).toBe(0);
    });

    it("records scoped package deps in depMap", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "@scope/inner",
        { name: "@scope/inner", main: "index.js" },
        {
          "index.js": 'module.exports = "scoped";',
        },
      );
      writePackage(
        vfs,
        "top-pkg",
        { name: "top-pkg", main: "index.js" },
        {
          "index.js": 'module.exports = require("@scope/inner");',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "top-pkg", new Set());
      expect(bundle.depMap.get("@scope/inner")).toBe(
        "/node_modules/@scope/inner/index.js",
      );
    });

    it("does not record externals in depMap", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "uses-react",
        { name: "uses-react", main: "index.js" },
        {
          "index.js": 'var React = require("react");\nmodule.exports = React;',
        },
      );

      const bundle = bundlePackageForBrowser(
        vfs,
        "uses-react",
        new Set(["react"]),
      );
      expect(bundle.depMap.has("react")).toBe(false);
    });

    it("generateRequireScript merges depMap into __pkg", () => {
      const vfs = createVfs();
      writePackage(
        vfs,
        "deep-dep",
        { name: "deep-dep", main: "index.js" },
        {
          "index.js": 'module.exports = "deep";',
        },
      );
      writePackage(
        vfs,
        "mid-dep",
        { name: "mid-dep", main: "index.js" },
        {
          "index.js": 'module.exports = require("deep-dep");',
        },
      );
      writePackage(
        vfs,
        "root-pkg",
        { name: "root-pkg", main: "index.js" },
        {
          "index.js": 'module.exports = require("mid-dep");',
        },
      );

      const bundle = bundlePackageForBrowser(vfs, "root-pkg", new Set());
      const bundles = new Map([["root-pkg", bundle]]);
      const script = generateRequireScript(bundles, {});

      expect(script).toContain('"mid-dep"');
      expect(script).toContain('"deep-dep"');
    });
  });

  describe("preprocessImports", () => {
    it("transforms named imports to window.require()", () => {
      const code = 'import { Camera, Heart } from "lucide-react";';
      const result = preprocessImports(code);
      expect(result).toContain('window.require("lucide-react")');
      expect(result).toContain("Camera");
      expect(result).toContain("Heart");
      expect(result).not.toContain("import");
      expect(result.startsWith("var {")).toBe(true);
    });

    it("transforms default imports with __esModule interop", () => {
      const code = 'import axios from "axios";';
      const result = preprocessImports(code);
      expect(result).toContain('window.require("axios")');
      expect(result).toContain("__esModule");
      expect(result).toContain("default");
      expect(result).not.toContain("import");
    });

    it("transforms namespace imports", () => {
      const code = 'import * as icons from "my-icons";';
      const result = preprocessImports(code);
      expect(result).toBe('var icons = window.require("my-icons");');
    });

    it("strips type-only imports", () => {
      const code = 'import type { Foo } from "some-types";';
      const result = preprocessImports(code);
      expect(result.trim()).toBe("");
    });

    it("strips side-effect imports", () => {
      const code = 'import "some-polyfill";';
      const result = preprocessImports(code);
      expect(result.trim()).toBe("");
    });

    it("leaves non-import code unchanged", () => {
      const code = "const x = 1;\nfunction foo() { return x; }";
      const result = preprocessImports(code);
      expect(result).toBe(code);
    });

    it("handles combined default + named imports", () => {
      const code = 'import React, { useState, useEffect } from "react";';
      const result = preprocessImports(code);
      expect(result).toContain('window.require("react")');
      expect(result).toContain("useState");
      expect(result).toContain("useEffect");
      expect(result).toContain("React");
      expect(result).not.toContain("import");
    });

    it("handles CDN package imports (react) via window.require", () => {
      const code = 'import { useState } from "react";';
      const result = preprocessImports(code);
      expect(result).toBe('var { useState } = window.require("react");');
    });

    it("processes mixed code with imports and regular code", () => {
      const code = [
        'import { Camera } from "lucide-react";',
        "",
        "function About() {",
        "  return <Camera />;",
        "}",
      ].join("\n");
      const result = preprocessImports(code);
      expect(result).toContain('window.require("lucide-react")');
      expect(result).toContain("function About()");
      expect(result).toContain("<Camera />");
      expect(result).not.toMatch(/^import\s/m);
    });

    it("handles multiple imports from different packages", () => {
      const code = [
        'import { Camera } from "lucide-react";',
        'import axios from "axios";',
        'import * as lodash from "lodash";',
      ].join("\n");
      const result = preprocessImports(code);
      expect(result).toContain('window.require("lucide-react")');
      expect(result).toContain('window.require("axios")');
      expect(result).toContain('window.require("lodash")');
      expect(result).not.toMatch(/^import\s/m);
    });
  });
});
