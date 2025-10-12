/**
 * Code transformation utilities for ESM/CJS conversion, CSS imports,
 * npm import redirection, and React Refresh registration.
 */

import * as acorn from "acorn";
import acornJsx from "acorn-jsx";
import { simpleHash } from "../utils/hash";
import { REACT_CDN, REACT_DOM_CDN } from "../config/cdn";

const jsxParser = acorn.Parser.extend(acornJsx());

let _varCounter = 0;

// JS identifiers can contain $, so we use [\w$]+ instead of \w+
const ID = "[\\w$]+";

export interface CssModuleContext {
  readFile: (path: string) => string;
  exists: (path: string) => boolean;
}

export function transformEsmToCjsSimple(code: string): string {
  let result = code;

  // Transform: import defaultExport, { named } from 'module' (combined)
  result = result.replace(
    new RegExp(
      `^([ \\t]*)import\\s+(${ID})\\s*,\\s*\\{([\\s\\S]+?)\\}\\s+from\\s+['\"]([^'\"]+)['\"]\\s*;?`,
      "gm",
    ),
    (_, indent, defaultName, imports, mod) => {
      const parts = imports
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const bindings = parts.map((p: string) => {
        const [name, alias] = p.split(/\s+as\s+/).map((s: string) => s.trim());
        return alias ? `${name}: ${alias}` : name;
      });
      const tmpVar = `_mod_${(++_varCounter).toString(36)}`;
      return `${indent}const ${tmpVar} = require("${mod}");\n${indent}const ${defaultName} = ${tmpVar}.default || ${tmpVar};\n${indent}const { ${bindings.join(
        ", ",
      )} } = ${tmpVar};`;
    },
  );

  // Transform: import defaultExport, * as name from 'module' (combined)
  result = result.replace(
    new RegExp(
      `^([ \\t]*)import\\s+(${ID})\\s*,\\s*\\*\\s+as\\s+(${ID})\\s+from\\s+['\"]([^'\"]+)['\"]\\s*;?`,
      "gm",
    ),
    (_, indent, defaultName, nsName, mod) => {
      return `${indent}const ${nsName} = require("${mod}");\n${indent}const ${defaultName} = ${nsName}.default || ${nsName};`;
    },
  );

  // Transform: import defaultExport from 'module'
  result = result.replace(
    new RegExp(
      `^([ \\t]*)import\\s+(${ID})\\s+from\\s+['\"]([^'\"]+)['\"]\\s*;?`,
      "gm",
    ),
    (_, indent, name, mod) => `${indent}const ${name} = require("${mod}");`,
  );

  // Transform: import { a, b as c } from 'module'
  result = result.replace(
    /^([ \t]*)import\s+\{([\s\S]+?)\}\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_, indent, imports, mod) => {
      const parts = imports
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const bindings = parts.map((p: string) => {
        const [name, alias] = p.split(/\s+as\s+/).map((s: string) => s.trim());
        return alias ? `${name}: ${alias}` : name;
      });
      return `${indent}const { ${bindings.join(", ")} } = require("${mod}");`;
    },
  );

  // Transform: import * as name from 'module'
  result = result.replace(
    new RegExp(
      `^([ \\t]*)import\\s+\\*\\s+as\\s+(${ID})\\s+from\\s+['\"]([^'\"]+)['\"]\\s*;?`,
      "gm",
    ),
    (_, indent, name, mod) => `${indent}const ${name} = require("${mod}");`,
  );

  // Transform: import 'module' (side-effect only)
  result = result.replace(
    /^([ \t]*)import\s+['"]([^'"]+)['"]\s*;?/gm,
    (_, indent, mod) => `${indent}require("${mod}");`,
  );

  // Transform: export default expr
  result = result.replace(
    /^([ \t]*)export\s+default\s+(?=class\s|function\s)/gm,
    "$1module.exports = exports.default = ",
  );
  result = result.replace(
    /^([ \t]*)export\s+default\s+/gm,
    "$1module.exports = exports.default = ",
  );

  // Transform: export { a, b as c }
  result = result.replace(
    /^([ \t]*)export\s+\{([\s\S]+?)\}\s*(?:from\s+['"]([^'"]+)['"])?\s*;?/gm,
    (_, indent, exportsList, mod) => {
      const parts = exportsList
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (mod) {
        const tmpVar = `_re_export_${(++_varCounter).toString(36)}`;
        const lines = [`${indent}const ${tmpVar} = require("${mod}");`];
        for (const part of parts) {
          const [name, alias] = part
            .split(/\s+as\s+/)
            .map((s: string) => s.trim());
          lines.push(
            `${indent}Object.defineProperty(exports, "${
              alias || name
            }", { enumerable: true, get: function() { return ${tmpVar}.${name}; } });`,
          );
        }
        return lines.join("\n");
      }
      return parts
        .map((part: string) => {
          const [name, alias] = part
            .split(/\s+as\s+/)
            .map((s: string) => s.trim());
          return `${indent}Object.defineProperty(exports, "${
            alias || name
          }", { enumerable: true, get: function() { return ${name}; } });`;
        })
        .join("\n");
    },
  );

  // Transform: export const/let/var name = ...
  result = result.replace(/^([ \t]*)export\s+(const|let|var)\s+/gm, "$1$2 ");
  const declMatch = code.matchAll(
    new RegExp(`^[ \\t]*export\\s+(?:const|let|var)\\s+(${ID})`, "gm"),
  );
  for (const m of declMatch) {
    const name = m[1];
    result += `\nObject.defineProperty(exports, "${name}", { enumerable: true, get: function() { return ${name}; } });`;
  }

  // Transform: export function name() / export class name / export async function
  result = result.replace(
    new RegExp(
      `^([ \\t]*)export\\s+(async\\s+)?(function|class)\\s+(${ID})`,
      "gm",
    ),
    (_, indent, async_, type, name) =>
      `${indent}${async_ || ""}${type} ${name}`,
  );
  const funcClassMatch = code.matchAll(
    new RegExp(
      `^[ \\t]*export\\s+(?:async\\s+)?(?:function|class)\\s+(${ID})`,
      "gm",
    ),
  );
  for (const m of funcClassMatch) {
    const name = m[1];
    result += `\nObject.defineProperty(exports, "${name}", { enumerable: true, get: function() { return ${name}; } });`;
  }

  // Transform: export * as name from 'module' (must come before export * from)
  result = result.replace(
    new RegExp(
      `^([ \\t]*)export\\s+\\*\\s+as\\s+(${ID})\\s+from\\s+['\"]([^'\"]+)['\"]\\s*;?`,
      "gm",
    ),
    (_, indent, name, mod) => `${indent}exports.${name} = require("${mod}");`,
  );

  // Transform: export * from 'module' — filter dangerous keys and default
  result = result.replace(
    /^([ \t]*)export\s+\*\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_, indent, mod) =>
      `${indent}(function(m) { for (var k in m) if (k !== "default" && k !== "__proto__" && k !== "constructor" && k !== "prototype" && Object.prototype.hasOwnProperty.call(m, k)) exports[k] = m[k]; })(require("${mod}"));`,
  );

  return result;
}

// ── CSS Import Handling ──────────────────────────────────────────────

export function resolveRelativePath(dir: string, relativePath: string): string {
  const parts = dir.split("/").filter(Boolean);
  const relParts = relativePath.split("/");

  for (const part of relParts) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }

  return "/" + parts.join("/");
}

export function resolveCssModulePath(
  cssPath: string,
  currentFile: string | undefined,
  ctx: CssModuleContext,
): string | null {
  if (currentFile && (cssPath.startsWith("./") || cssPath.startsWith("../"))) {
    const dir = currentFile.replace(/\/[^/]+$/, "");
    const resolved = resolveRelativePath(dir, cssPath);
    if (ctx.exists(resolved)) return resolved;
  }

  if (ctx.exists(cssPath)) return cssPath;

  const withSlash = "/" + cssPath.replace(/^\.\//, "");
  if (ctx.exists(withSlash)) return withSlash;

  return null;
}

/**
 * Generate replacement code for a CSS Module import.
 * Parses the CSS file, extracts class names via regex (no css-tree dependency),
 * generates scoped names, and injects the scoped CSS via a style tag.
 */
export function generateCssModuleReplacement(
  varName: string,
  cssPath: string,
  currentFile: string | undefined,
  ctx: CssModuleContext,
): string {
  try {
    const resolvedPath = resolveCssModulePath(cssPath, currentFile, ctx);
    if (!resolvedPath) return `const ${varName} = {};`;

    const cssContent = ctx.readFile(resolvedPath);
    const fileHash = simpleHash(resolvedPath + cssContent).slice(0, 6);

    const classMap: Record<string, string> = {};

    // Extract class names via regex and build scoped names
    const classRegex = /\.([a-zA-Z_][\w-]*)/g;
    let m;
    while ((m = classRegex.exec(cssContent)) !== null) {
      if (!classMap[m[1]]) {
        classMap[m[1]] = `${m[1]}_${fileHash}`;
      }
    }

    // Replace class names in CSS to create scoped version
    let scopedCss = cssContent;
    for (const [original, scoped] of Object.entries(classMap)) {
      scopedCss = scopedCss.replace(
        new RegExp(
          `\\.${original.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&",
          )}(?=[\\s{:,>+~])`,
          "g",
        ),
        `.${scoped}`,
      );
    }

    const escapedCss = scopedCss
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");

    const mapEntries = Object.entries(classMap)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(", ");

    return `const ${varName} = {${mapEntries}};
(function() {
  if (typeof document !== 'undefined') {
    var id = ${JSON.stringify("cssmod-" + fileHash)};
    if (!document.getElementById(id)) {
      var s = document.createElement('style');
      s.id = id;
      s.textContent = \`${escapedCss}\`;
      document.head.appendChild(s);
    }
  }
})();`;
  } catch {
    return `const ${varName} = {};`;
  }
}

/**
 * Strip CSS imports from code. CSS Module imports (*.module.css) are converted
 * to inline objects with class name mappings. Regular CSS imports are removed.
 */
export function stripCssImports(
  code: string,
  currentFile: string | undefined,
  ctx: CssModuleContext,
): string {
  // CSS Module default imports
  code = code.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.css)['"]\s*;?/g,
    (_match, varName, cssPath) => {
      return generateCssModuleReplacement(varName, cssPath, currentFile, ctx);
    },
  );

  // Destructured CSS Module imports
  code = code.replace(
    /import\s+\{([\s\S]+?)\}\s+from\s+['"]([^'"]+\.module\.css)['"]\s*;?/g,
    (_match, names, cssPath) => {
      const varName = "__cssModule_" + simpleHash(cssPath);
      const replacement = generateCssModuleReplacement(
        varName,
        cssPath,
        currentFile,
        ctx,
      );
      const namedExports = (names as string)
        .split(",")
        .map((n: string) => {
          const trimmed = n.trim();
          const parts = trimmed.split(/\s+as\s+/);
          const key = parts[0].trim();
          const alias = parts[1]?.trim() || key;
          return `const ${alias} = ${varName}[${JSON.stringify(key)}];`;
        })
        .join("\n");
      return `${replacement}\n${namedExports}`;
    },
  );

  // Strip remaining plain CSS imports
  return code.replace(/import\s+['"][^'"]+\.css['"]\s*;?/g, "");
}

// ── NPM Import Redirection ──────────────────────────────────────────

const EXPLICIT_MAPPINGS: Record<string, string> = {
  react: `${REACT_CDN}?dev`,
  "react/jsx-runtime": `${REACT_CDN}&dev/jsx-runtime`,
  "react/jsx-dev-runtime": `${REACT_CDN}&dev/jsx-dev-runtime`,
  "react-dom": `${REACT_DOM_CDN}?dev`,
  "react-dom/client": `${REACT_DOM_CDN}/client?dev`,
};

const LOCAL_PACKAGES = new Set([
  "next/link",
  "next/router",
  "next/head",
  "next/navigation",
  "next/dynamic",
  "next/image",
  "next/script",
  "next/font/google",
  "next/font/local",
]);

function extractMajorVersion(range: string): string | null {
  const match = range.match(/(\d+)\.\d+/);
  return match ? match[1] : null;
}

function resolveNpmPackage(
  packageName: string,
  extraLocalPackages?: Set<string>,
  dependencies?: Record<string, string>,
  esmShDeps?: string,
  installedPackages?: Set<string>,
): string | null {
  if (
    packageName.startsWith(".") ||
    packageName.startsWith("/") ||
    packageName.startsWith("http://") ||
    packageName.startsWith("https://") ||
    packageName.startsWith("/__virtual__")
  ) {
    return null;
  }

  if (EXPLICIT_MAPPINGS[packageName]) return EXPLICIT_MAPPINGS[packageName];
  if (LOCAL_PACKAGES.has(packageName)) return null;
  if (extraLocalPackages?.has(packageName)) return null;

  const basePkg = packageName.includes("/")
    ? packageName.split("/")[0]
    : packageName;
  const isScoped = basePkg.startsWith("@");
  const scopedBasePkg =
    isScoped && packageName.includes("/")
      ? packageName.split("/").slice(0, 2).join("/")
      : basePkg;

  if (LOCAL_PACKAGES.has(scopedBasePkg)) return null;
  if (extraLocalPackages?.has(scopedBasePkg)) return null;

  if (installedPackages?.has(scopedBasePkg)) return `/_npm/${packageName}`;

  let esmPkg = packageName;
  if (dependencies) {
    const depVersion = dependencies[scopedBasePkg];
    if (depVersion) {
      const major = extractMajorVersion(depVersion);
      if (major) {
        const subpath = packageName.slice(scopedBasePkg.length);
        esmPkg = `${scopedBasePkg}@${major}${subpath}`;
      }
    }
  }

  const depsParam = esmShDeps ? `&deps=${esmShDeps}` : "";
  return `https://esm.sh/${esmPkg}?external=react${depsParam}`;
}

/**
 * Redirect bare npm package imports to esm.sh CDN URLs.
 * Uses acorn AST for precision, falls back to regex.
 */
export function redirectNpmImports(
  code: string,
  additionalLocalPackages?: string[],
  dependencies?: Record<string, string>,
  esmShDeps?: string,
  installedPackages?: Set<string>,
): string {
  const extraSet = additionalLocalPackages?.length
    ? new Set(additionalLocalPackages)
    : undefined;
  try {
    return redirectNpmImportsAst(
      code,
      extraSet,
      dependencies,
      esmShDeps,
      installedPackages,
    );
  } catch {
    return redirectNpmImportsRegex(
      code,
      extraSet,
      dependencies,
      esmShDeps,
      installedPackages,
    );
  }
}

function redirectNpmImportsAst(
  code: string,
  extraLocalPackages?: Set<string>,
  dependencies?: Record<string, string>,
  esmShDeps?: string,
  installedPackages?: Set<string>,
): string {
  const ast = jsxParser.parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
  const replacements: Array<[number, number, string]> = [];

  function processSource(sourceNode: any) {
    if (!sourceNode || sourceNode.type !== "Literal") return;
    const resolved = resolveNpmPackage(
      sourceNode.value,
      extraLocalPackages,
      dependencies,
      esmShDeps,
      installedPackages,
    );
    if (resolved) {
      replacements.push([
        sourceNode.start,
        sourceNode.end,
        JSON.stringify(resolved),
      ]);
    }
  }

  for (const node of (ast as any).body) {
    if (node.type === "ImportDeclaration") processSource(node.source);
    else if (node.type === "ExportNamedDeclaration" && node.source)
      processSource(node.source);
    else if (node.type === "ExportAllDeclaration") processSource(node.source);
  }

  if (replacements.length === 0) return code;

  let result = code;
  replacements.sort((a, b) => b[0] - a[0]);
  for (const [start, end, replacement] of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

function redirectNpmImportsRegex(
  code: string,
  extraLocalPackages?: Set<string>,
  dependencies?: Record<string, string>,
  esmShDeps?: string,
  installedPackages?: Set<string>,
): string {
  const importPattern = /(from\s*['"])([^'"./][^'"]*?)(['"])/g;
  return code.replace(importPattern, (match, prefix, packageName, suffix) => {
    const resolved = resolveNpmPackage(
      packageName,
      extraLocalPackages,
      dependencies,
      esmShDeps,
      installedPackages,
    );
    if (!resolved) return match;
    return `${prefix}${resolved}${suffix}`;
  });
}

// ── React Refresh Registration ───────────────────────────────────────

/**
 * Add React Refresh registration to transformed code.
 * Enables true HMR (state-preserving) for React components.
 */
export function addReactRefresh(code: string, filename: string): string {
  const components = detectReactComponents(code);

  if (components.length === 0) {
    return `// HMR Setup
import.meta.hot = window.__vite_hot_context__("${filename}");

${code}

// HMR Accept
if (import.meta.hot) {
  import.meta.hot.accept();
}
`;
  }

  const registrations = components
    .map(name => `  $RefreshReg$(${name}, "${filename} ${name}");`)
    .join("\n");

  return `// HMR Setup
import.meta.hot = window.__vite_hot_context__("${filename}");

${code}

// React Refresh Registration
if (import.meta.hot) {
${registrations}
  import.meta.hot.accept(() => {
    if (window.$RefreshRuntime$) {
      window.$RefreshRuntime$.performReactRefresh();
    }
  });
}
`;
}

function isUppercaseStart(name: string): boolean {
  return name.length > 0 && name[0] >= "A" && name[0] <= "Z";
}

function detectReactComponents(code: string): string[] {
  try {
    return detectReactComponentsAst(code);
  } catch {
    return detectReactComponentsRegex(code);
  }
}

function detectReactComponentsAst(code: string): string[] {
  const ast = jsxParser.parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
  const components: string[] = [];

  for (const node of (ast as any).body) {
    if (
      node.type === "FunctionDeclaration" &&
      node.id &&
      isUppercaseStart(node.id.name)
    ) {
      if (!components.includes(node.id.name)) components.push(node.id.name);
    }

    if (
      node.type === "ExportDefaultDeclaration" &&
      node.declaration?.type === "FunctionDeclaration" &&
      node.declaration.id &&
      isUppercaseStart(node.declaration.id.name)
    ) {
      if (!components.includes(node.declaration.id.name))
        components.push(node.declaration.id.name);
    }

    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration" &&
      node.declaration.id &&
      isUppercaseStart(node.declaration.id.name)
    ) {
      if (!components.includes(node.declaration.id.name))
        components.push(node.declaration.id.name);
    }

    const varDecl =
      node.type === "VariableDeclaration"
        ? node
        : node.type === "ExportNamedDeclaration" &&
            node.declaration?.type === "VariableDeclaration"
          ? node.declaration
          : null;

    if (varDecl) {
      for (const declarator of varDecl.declarations) {
        if (
          declarator.id?.name &&
          isUppercaseStart(declarator.id.name) &&
          declarator.init
        ) {
          const initType = declarator.init.type;
          if (
            initType === "ArrowFunctionExpression" ||
            initType === "FunctionExpression" ||
            initType === "CallExpression"
          ) {
            if (!components.includes(declarator.id.name))
              components.push(declarator.id.name);
          }
        }
      }
    }
  }

  return components;
}

function detectReactComponentsRegex(code: string): string[] {
  const components: string[] = [];

  const funcDeclRegex =
    /(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*\(/g;
  let match;
  while ((match = funcDeclRegex.exec(code)) !== null) {
    if (!components.includes(match[1])) components.push(match[1]);
  }

  const arrowRegex =
    /(?:^|\n)(?:export\s+)?(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    if (!components.includes(match[1])) components.push(match[1]);
  }

  return components;
}
