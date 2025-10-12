export const sep = "/";
export const delimiter = ":";

export function normalize(path: string): string {
  if (!path) return ".";
  const isAbs = path.startsWith("/");
  const parts = path.split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== "..")
        resolved.pop();
      else if (!isAbs) resolved.push("..");
    } else if (part !== ".") {
      resolved.push(part);
    }
  }
  let result = resolved.join("/");
  if (isAbs) result = "/" + result;
  return result || ".";
}

export function join(...paths: string[]): string {
  if (paths.length === 0) return ".";
  return normalize(paths.filter(Boolean).join("/"));
}

export function resolve(...paths: string[]): string {
  let resolvedPath = "";
  for (let i = paths.length - 1; i >= 0 && !resolvedPath.startsWith("/"); i--) {
    const p = paths[i];
    if (!p) continue;
    resolvedPath = p + (resolvedPath ? "/" + resolvedPath : "");
  }
  if (!resolvedPath.startsWith("/")) {
    const cwd =
      (typeof globalThis !== "undefined" && globalThis.process?.cwd?.()) || "/";
    resolvedPath = cwd + (resolvedPath ? "/" + resolvedPath : "");
  }
  return normalize(resolvedPath);
}

export function isAbsolute(path: string): boolean {
  return path.startsWith("/");
}

export function dirname(path: string): string {
  if (!path) return ".";
  const n = normalize(path);
  const last = n.lastIndexOf("/");
  if (last === -1) return ".";
  if (last === 0) return "/";
  return n.slice(0, last);
}

export function basename(path: string, ext?: string): string {
  if (!path) return "";
  const n = normalize(path);
  let base = n.slice(n.lastIndexOf("/") + 1);
  if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length);
  return base;
}

export function extname(path: string): string {
  const base = basename(path);
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return base.slice(dotIndex);
}

export function relative(from: string, to: string): string {
  from = resolve(from);
  to = resolve(to);
  if (from === to) return "";
  const fromParts = from.split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let common = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] !== toParts[i]) break;
    common++;
  }
  return (
    [
      ...Array(fromParts.length - common).fill(".."),
      ...toParts.slice(common),
    ].join("/") || "."
  );
}

export function parse(path: string): {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
} {
  const n = normalize(path);
  const dir = dirname(n);
  const base = basename(n);
  const ext = extname(n);
  return {
    root: isAbsolute(n) ? "/" : "",
    dir,
    base,
    ext,
    name: base.slice(0, base.length - ext.length),
  };
}

export function format(obj: {
  root?: string;
  dir?: string;
  base?: string;
  ext?: string;
  name?: string;
}): string {
  const dir = obj.dir || obj.root || "";
  const base = obj.base || (obj.name || "") + (obj.ext || "");
  if (!dir) return base;
  if (dir === obj.root) return dir + base;
  return dir + "/" + base;
}

export const posix = {
  sep,
  delimiter,
  normalize,
  join,
  resolve,
  isAbsolute,
  dirname,
  basename,
  extname,
  relative,
  parse,
  format,
};
/** @note win32 uses posix implementation — Windows paths not supported in browser */
export const win32 = {
  sep: "\\",
  delimiter: ";",
  normalize,
  join,
  resolve,
  isAbsolute,
  dirname,
  basename,
  extname,
  relative,
  parse,
  format,
};

export default {
  sep,
  delimiter,
  normalize,
  join,
  resolve,
  isAbsolute,
  dirname,
  basename,
  extname,
  relative,
  parse,
  format,
  posix,
  win32,
};
