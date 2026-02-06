import { MemFS } from "./memfs";
import { transformEsmToCjs, removeShebang } from "./code-transform";
import { isBuiltinModule } from "./builtins";
import * as pathShim from "./polyfills/path";
import type { PackageJson } from "./types/package-json";
import { resolve as resolveExports } from "resolve.exports";

const FILE_EXTENSIONS = [
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".node",
  ".mjs",
  ".cjs",
];
const INDEX_NAMES = [
  "index.js",
  "index.ts",
  "index.tsx",
  "index.json",
  "index.node",
];

export interface BrowserBundle {
  modules: Map<string, string>;
  entryPath: string;
  depMap: Map<string, string>;
}

export interface BundleError {
  packageName: string;
  message: string;
}

function readPkg(vfs: MemFS, pkgPath: string): PackageJson | null {
  try {
    if (!vfs.existsSync(pkgPath)) return null;
    return JSON.parse(vfs.readFileSync(pkgPath, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

function probeFile(vfs: MemFS, base: string): string | null {
  if (vfs.existsSync(base)) {
    const st = vfs.statSync(base);
    if (st.isFile()) return base;
    if (st.isDirectory()) {
      const pkg = readPkg(vfs, pathShim.join(base, "package.json"));
      if (pkg) {
        for (const field of ["main", "module"] as const) {
          const val = pkg[field];
          if (typeof val === "string") {
            const hit = probeFile(vfs, pathShim.join(base, val));
            if (hit) return hit;
          }
        }
      }
      for (const idx of INDEX_NAMES) {
        const p = pathShim.join(base, idx);
        if (vfs.existsSync(p)) return p;
      }
    }
  }
  for (const ext of FILE_EXTENSIONS) {
    const p = base + ext;
    if (vfs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Apply the `browser` field (object form) remapping for a given require id.
 * Returns the remapped path, `false` (meaning "ignore this module"), or `null`
 * (no remapping applies).
 */
function applyBrowserFieldRemap(
  browserMap: Record<string, string | false>,
  id: string,
  pkgRoot: string,
): string | false | null {
  if (id in browserMap) {
    const mapped = browserMap[id];
    if (mapped === false) return false;
    return pathShim.join(pkgRoot, mapped);
  }
  const relative = "./" + id;
  if (relative in browserMap) {
    const mapped = browserMap[relative];
    if (mapped === false) return false;
    return pathShim.join(pkgRoot, mapped);
  }
  return null;
}

function resolvePackageEntry(
  vfs: MemFS,
  pkgRoot: string,
  pkgName: string,
  subpath: string,
): string | null {
  const pkg = readPkg(vfs, pathShim.join(pkgRoot, "package.json"));
  if (pkg) {
    if (pkg.exports) {
      const target = subpath ? `${pkgName}/${subpath}` : pkgName;
      for (const cond of [
        { browser: true, require: true } as const,
        { require: true } as const,
        { browser: true, import: true } as const,
        { import: true } as const,
      ]) {
        try {
          const resolved = resolveExports(pkg, target, cond);
          if (resolved?.length) {
            const hit = probeFile(vfs, pathShim.join(pkgRoot, resolved[0]));
            if (hit) return hit;
          }
        } catch {
          /* continue */
        }
      }
    }
    if (subpath) {
      const hit = probeFile(vfs, pathShim.join(pkgRoot, subpath));
      if (hit) return hit;
    }

    if (typeof pkg.browser === "object" && pkg.browser !== null) {
      const mainField = pkg.main || "index.js";
      const remap = applyBrowserFieldRemap(
        pkg.browser as Record<string, string | false>,
        mainField,
        pkgRoot,
      );
      if (typeof remap === "string") {
        const hit = probeFile(vfs, remap);
        if (hit) return hit;
      }
    }
    if (typeof pkg.browser === "string") {
      const hit = probeFile(vfs, pathShim.join(pkgRoot, pkg.browser));
      if (hit) return hit;
    }
    if (pkg.main) {
      const hit = probeFile(vfs, pathShim.join(pkgRoot, pkg.main));
      if (hit) return hit;
    }
    if (pkg.module) {
      const hit = probeFile(vfs, pathShim.join(pkgRoot, pkg.module));
      if (hit) return hit;
    }
  }
  return probeFile(vfs, subpath ? pathShim.join(pkgRoot, subpath) : pkgRoot);
}

export function extractPackageName(id: string): string {
  const segments = id.split("/");
  if (segments[0].startsWith("@") && segments.length > 1) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

function resolveModuleId(
  vfs: MemFS,
  id: string,
  fromDir: string,
): string | null {
  if (id.startsWith("./") || id.startsWith("../") || id.startsWith("/")) {
    const abs = id.startsWith("/") ? id : pathShim.resolve(fromDir, id);
    return probeFile(vfs, abs);
  }

  const pkgName = extractPackageName(id);
  const segments = id.split("/");
  const subpath = segments.slice(pkgName.split("/").length).join("/");

  let dir = fromDir;
  while (true) {
    const nm = pathShim.join(dir, "node_modules");
    if (vfs.existsSync(nm)) {
      const pkgRoot = pathShim.join(nm, pkgName);
      const hit = resolvePackageEntry(vfs, pkgRoot, pkgName, subpath);
      if (hit) return hit;
    }
    if (dir === "/") break;
    dir = pathShim.dirname(dir);
  }
  return null;
}

const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_PATTERN = /__dynamicImport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Bundle a package from the VFS for browser consumption.
 * Reads the package entry point, transforms ESM to CJS, and recursively
 * bundles all local dependencies. External packages and Node builtins are skipped.
 */
export function bundlePackageForBrowser(
  vfs: MemFS,
  packageName: string,
  externals: Set<string>,
): BrowserBundle {
  const modules = new Map<string, string>();
  const visited = new Set<string>();
  const depMap = new Map<string, string>();

  const entryPath = resolveModuleId(vfs, packageName, "/");
  if (!entryPath) {
    throw new Error(
      `Cannot resolve package "${packageName}" from /node_modules`,
    );
  }

  function walk(filePath: string): void {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    let source: string;
    try {
      const raw = vfs.readFileSync(filePath, "utf8");
      source = removeShebang(raw);
    } catch {
      return;
    }

    if (filePath.endsWith(".json")) {
      modules.set(filePath, `module.exports = ${source};`);
      return;
    }

    let transformed: string;
    try {
      transformed = transformEsmToCjs(source, filePath);
    } catch {
      transformed = source;
    }
    modules.set(filePath, transformed);

    const depPatterns = [
      new RegExp(REQUIRE_PATTERN.source, "g"),
      new RegExp(DYNAMIC_IMPORT_PATTERN.source, "g"),
    ];
    for (const pattern of depPatterns) {
      let match;
      while ((match = pattern.exec(transformed)) !== null) {
        const dep = match[1];

        if (isBuiltinModule(dep)) continue;

        const depPkgName = extractPackageName(dep);
        if (externals.has(depPkgName)) continue;

        const resolved = resolveModuleId(vfs, dep, pathShim.dirname(filePath));
        if (resolved) {
          if (
            !dep.startsWith("./") &&
            !dep.startsWith("../") &&
            !dep.startsWith("/")
          ) {
            depMap.set(dep, resolved);
          }
          walk(resolved);
        }
      }
    }
  }

  walk(entryPath);
  return { modules, entryPath, depMap };
}

/**
 * Escape code for safe embedding inside an HTML `<script>` tag.
 * Only needs to prevent premature closing of the script element.
 */
function escapeForScriptEmbed(code: string): string {
  return code.replace(/<\/script>/gi, "<\\/script>");
}

/**
 * Generate a `<script>` containing a require() shim and all bundled modules.
 * Globals map package names to window properties (e.g. { "react": "React" }).
 */
export function generateRequireScript(
  bundles: Map<string, BrowserBundle>,
  globals: Record<string, string>,
): string {
  const pkgMap: Record<string, string> = {};
  const dedupedModules = new Map<string, string>();

  for (const [pkgName, bundle] of bundles) {
    pkgMap[pkgName] = bundle.entryPath;
    for (const [specifier, resolvedPath] of bundle.depMap) {
      if (!(specifier in pkgMap)) {
        pkgMap[specifier] = resolvedPath;
      }
    }
    for (const [modPath, code] of bundle.modules) {
      dedupedModules.set(modPath, code);
    }
  }

  if ("react" in globals) {
    pkgMap["react/jsx-runtime"] = "__jsx_runtime__";
    pkgMap["react/jsx-dev-runtime"] = "__jsx_runtime__";
  }

  const allModules = [...dedupedModules.entries()].map(([path, code]) => ({
    path,
    code,
  }));

  const globalsJson = JSON.stringify(globals);
  const pkgMapJson = JSON.stringify(pkgMap);

  const moduleRegistrations = allModules
    .map(({ path, code }) => {
      const escaped = escapeForScriptEmbed(code);
      return (
        "__m[" +
        JSON.stringify(path) +
        "] = function(module, exports, require) {\n" +
        escaped +
        "\n};"
      );
    })
    .join("\n");

  const jsxRuntimeShim =
    "react" in globals
      ? '\n  __m["__jsx_runtime__"] = function(module, exports, require) {\n' +
        '    var React = require("react");\n' +
        "    function jsx(type, props, key) {\n" +
        "      if (key !== undefined && props) props.key = key;\n" +
        "      return React.createElement(type, props);\n" +
        "    }\n" +
        "    exports.jsx = jsx;\n" +
        "    exports.jsxs = jsx;\n" +
        "    exports.jsxDEV = jsx;\n" +
        "    exports.Fragment = React.Fragment;\n" +
        "  };\n"
      : "";

  return (
    "<script>\n" +
    "(function() {\n" +
    "  var __m = {};\n" +
    "  var __c = {};\n" +
    "  var __pkg = " +
    pkgMapJson +
    ";\n" +
    "  var __g = " +
    globalsJson +
    ";\n" +
    '  var process = { env: { NODE_ENV: "production" } };\n' +
    "\n" +
    "  function __dirname(p) {\n" +
    '    var idx = p.lastIndexOf("/");\n' +
    '    return idx > 0 ? p.substring(0, idx) : "/";\n' +
    "  }\n" +
    "\n" +
    "  function __resolve(from, rel) {\n" +
    '    var parts = from.split("/").filter(Boolean);\n' +
    '    var segs = rel.split("/");\n' +
    "    for (var i = 0; i < segs.length; i++) {\n" +
    '      if (segs[i] === "..") parts.pop();\n' +
    '      else if (segs[i] !== ".") parts.push(segs[i]);\n' +
    "    }\n" +
    '    return "/" + parts.join("/");\n' +
    "  }\n" +
    "\n" +
    "  function __probe(id) {\n" +
    "    if (__m[id]) return id;\n" +
    '    var exts = [".js", ".cjs", ".mjs", ".json", "/index.js", "/index.cjs", "/index.mjs"];\n' +
    "    for (var i = 0; i < exts.length; i++) {\n" +
    "      if (__m[id + exts[i]]) return id + exts[i];\n" +
    "    }\n" +
    "    return null;\n" +
    "  }\n" +
    "\n" +
    "  function require(id) {\n" +
    "    if (id in __g) return window[__g[id]];\n" +
    "\n" +
    "    var resolved = __pkg[id] || id;\n" +
    "    if (!__m[resolved]) {\n" +
    "      var probed = __probe(resolved);\n" +
    "      if (probed) resolved = probed;\n" +
    "    }\n" +
    "\n" +
    "    if (__c[resolved]) return __c[resolved].exports;\n" +
    "\n" +
    "    var fn = __m[resolved];\n" +
    "    if (!fn) {\n" +
    "      if (id in __g) return window[__g[id]];\n" +
    '      console.warn("[require] Cannot find module: " + id + " (resolved: " + resolved + ")");\n' +
    "      return {};\n" +
    "    }\n" +
    "    var mod = { exports: {} };\n" +
    "    __c[resolved] = mod;\n" +
    "    try {\n" +
    "      fn(mod, mod.exports, function localRequire(dep) {\n" +
    '        if (dep.startsWith(".") || dep.startsWith("/")) {\n' +
    '          var base = dep.startsWith("/") ? dep : __resolve(__dirname(resolved), dep);\n' +
    "          var found = __probe(base);\n" +
    "          if (found) return require(found);\n" +
    '          console.warn("[require] Cannot resolve: " + dep + " from " + resolved);\n' +
    "          return {};\n" +
    "        }\n" +
    "        return require(dep);\n" +
    "      });\n" +
    "    } catch (e) {\n" +
    '      console.error("[require] Error executing module: " + resolved, e);\n' +
    "    }\n" +
    "    return mod.exports;\n" +
    "  }\n" +
    "\n" +
    "  " +
    moduleRegistrations +
    "\n" +
    jsxRuntimeShim +
    "\n" +
    "  window.require = require;\n" +
    "  window.__dynamicImport = function(id) {\n" +
    "    return Promise.resolve().then(function() {\n" +
    "      var mod = require(id);\n" +
    '      if (mod && typeof mod === "object" && ("default" in mod || "__esModule" in mod)) {\n' +
    "        return mod;\n" +
    "      }\n" +
    '      return Object.assign({ default: mod }, mod && typeof mod === "object" ? mod : {});\n' +
    "    });\n" +
    "  };\n" +
    "})();\n" +
    "</script>"
  );
}

/**
 * Transform ES module `import` statements into `window.require()` calls.
 * Used to pre-process component source before host-side JSX transpilation
 * via esbuild. The output is plain JS that can run in a regular `<script>` tag.
 *
 * Uses `var` (not `const`) so declarations hoist to function/global scope.
 * Uses `window.require` (not bare `require`) to avoid strict-mode scoping issues.
 */
export function preprocessImports(code: string): string {
  return code
    .replace(
      /^import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm,
      "",
    )
    .replace(
      /^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
      (_, def, named, mod) =>
        `var __imp = window.require("${mod}"); var ${def} = __imp && __imp.__esModule ? __imp.default : __imp; var {${named}} = __imp;`,
    )
    .replace(
      /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
      (_, imports, mod) => `var {${imports}} = window.require("${mod}");`,
    )
    .replace(
      /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
      (_, name, mod) => `var ${name} = window.require("${mod}");`,
    )
    .replace(
      /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
      (_, name, mod) =>
        `var ${name} = (function(m){return m&&m.__esModule?m.default:m})(window.require("${mod}"));`,
    )
    .replace(/^import\s+['"][^'"]+['"]\s*;?\s*$/gm, "");
}

/**
 * Scan source files for bare-specifier imports (e.g. `import { X } from 'pkg'`
 * or `import { Y } from '@scope/pkg/subpath'`).
 * Returns a set of unique full import specifiers found, preserving subpaths
 * so they can be individually resolved and bundled.
 * Handles: named imports, default imports, namespace imports, multi-line destructuring.
 * Skips: `import type` (TS type-only imports), side-effect imports without a specifier.
 */
export function scanBareImports(sources: string[]): Set<string> {
  const found = new Set<string>();
  const pattern =
    /import\s+(?:type\s+)?(?:[\w{},*\s]+)\s+from\s+['"]([^./][^'"]*)['"]/g;
  for (const src of sources) {
    let match;
    const re = new RegExp(pattern.source, "g");
    while ((match = re.exec(src)) !== null) {
      const full = match[0];
      if (/^import\s+type\s/.test(full)) continue;
      found.add(match[1]);
    }
  }
  return found;
}
