import * as acorn from "acorn";
import acornJsx from "acorn-jsx";
import * as pathShim from "./polyfills/path";
import { transformEsmToCjsSimple } from "./frameworks/code-transforms";
import { simpleHash } from "./utils/hash";

const jsxParser = acorn.Parser.extend(acornJsx());
import {
  needsTranspilation,
  transpileSync,
  transpile,
  isInitialized,
  hasSyncSupport,
} from "./transpiler";

const tsCache = new Map<string, string>();

export { tsCache as transpileCache };

export function removeShebang(source: string): string {
  return source.charCodeAt(0) === 0x23 && source.charCodeAt(1) === 0x21
    ? source.slice(source.indexOf("\n") + 1)
    : source;
}

function rewriteDynamicImports(source: string): string {
  return source.replace(/(?<![.$\w])import\s*\(/g, "__dynamicImport(");
}

function visitAstNodes(root: any, fn: (n: any) => void): void {
  if (!root || typeof root !== "object") return;
  if (typeof root.type === "string") fn(root);
  const skip = new Set(["type", "start", "end", "loc", "range"]);
  for (const prop of Object.keys(root)) {
    if (skip.has(prop)) continue;
    const val = root[prop];
    if (!val || typeof val !== "object") continue;
    if (Array.isArray(val)) {
      for (const el of val) {
        if (el && typeof el === "object" && typeof el.type === "string") {
          visitAstNodes(el, fn);
        }
      }
    } else if (typeof val.type === "string") {
      visitAstNodes(val, fn);
    }
  }
}

function esmToCjsViaAst(source: string, _file: string): string {
  const tree = jsxParser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as any;

  const patches: { from: number; to: number; text: string }[] = [];

  visitAstNodes(tree, (node: any) => {
    if (
      node.type === "MetaProperty" &&
      node.meta?.name === "import" &&
      node.property?.name === "meta"
    ) {
      patches.push({ from: node.start, to: node.end, text: "import_meta" });
    }
    if (node.type === "ImportExpression") {
      patches.push({
        from: node.start,
        to: node.start + 6,
        text: "__dynamicImport",
      });
    }
  });

  const usesImportDecl = tree.body.some(
    (n: any) => n.type === "ImportDeclaration",
  );
  const usesExportDecl = tree.body.some((n: any) =>
    n.type?.startsWith("Export"),
  );

  let result = source;
  patches.sort((a, b) => b.from - a.from);
  for (const { from, to, text } of patches) {
    result = result.slice(0, from) + text + result.slice(to);
  }

  if (usesImportDecl || usesExportDecl) {
    result = transformEsmToCjsSimple(result);
    if (usesExportDecl) {
      result =
        'Object.defineProperty(exports, "__esModule", { value: true });\n' +
        result;
    }
  }
  return result;
}

function esmToCjsViaRegex(source: string, file: string): string {
  let out = source;
  const dir = pathShim.dirname(file);
  out = out.replace(/\bimport\.meta\.url\b/g, `import_meta.url`);
  out = out.replace(/\bimport\.meta\.dirname\b/g, `import_meta.dirname`);
  out = out.replace(/\bimport\.meta\.filename\b/g, `import_meta.filename`);
  out = out.replace(/\bimport\.meta\b/g, `import_meta`);
  out = rewriteDynamicImports(out);
  const hasImport = /\bimport\s+[\w{*'"]/m.test(source);
  const hasExport =
    /\bexport\s+(?:default|const|let|var|function|class|{|\*)/m.test(source);
  if (hasImport || hasExport) {
    out = transformEsmToCjsSimple(out);
    if (hasExport) {
      out =
        'Object.defineProperty(exports, "__esModule", { value: true });\n' +
        out;
    }
  }
  return out;
}

export function transformEsmToCjs(source: string, file: string): string {
  if (!/\bimport\b|\bexport\b/.test(source)) return source;
  try {
    return esmToCjsViaAst(source, file);
  } catch {
    return esmToCjsViaRegex(source, file);
  }
}

export function processSource(
  source: string,
  file: string,
  sourceMaps?: boolean,
): string {
  if (needsTranspilation(file)) {
    const key = `${file}:${simpleHash(source)}`;
    const hit = tsCache.get(key);
    if (hit !== undefined) return hit;
    if (!isInitialized()) {
      throw new Error(
        `Transpiler not initialized. Call kernel.init() before loading TypeScript files (${file}).`,
      );
    }
    if (hasSyncSupport()) {
      const compiled = transpileSync(source, file, { sourcemap: sourceMaps });
      const result = transformEsmToCjs(compiled, file);
      tsCache.set(key, result);
      return result;
    }
    throw new Error(
      `File "${file}" has not been pre-transpiled. Call kernel.prepareFile("${file}") before running TypeScript in the browser.`,
    );
  }
  return transformEsmToCjs(source, file);
}

export function getProcessedSource(
  rawSource: string,
  filepath: string,
  cache: Map<string, string>,
  sourceMaps?: boolean,
): string {
  let source = removeShebang(rawSource);
  const hash = simpleHash(source);
  const key = `${filepath}:${hash}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const result = processSource(source, filepath, sourceMaps);
  cache.set(key, result);
  return result;
}

export async function ensureTranspiled(
  file: string,
  source: string,
): Promise<void> {
  if (!needsTranspilation(file)) return;
  const key = `${file}:${simpleHash(source)}`;
  if (tsCache.has(key)) return;
  const compiled = await transpile(source, file);
  const result = transformEsmToCjs(compiled, file);
  tsCache.set(key, result);
}
