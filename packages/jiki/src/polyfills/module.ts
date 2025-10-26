import * as pathShim from "./path";

export const builtinModules = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
];

export function isBuiltin(moduleName: string): boolean {
  const name = moduleName.startsWith("node:")
    ? moduleName.slice(5)
    : moduleName;
  return builtinModules.includes(name);
}

let _requireFactory: ((dir: string) => (id: string) => unknown) | null = null;

export function initModule(
  requireFactory: (dir: string) => (id: string) => unknown,
): void {
  _requireFactory = requireFactory;
}

export function createRequire(filename: string): (id: string) => unknown {
  if (_requireFactory) {
    const dir = pathShim.dirname(filename);
    return _requireFactory(dir);
  }
  return (_id: string) => {
    throw new Error(`createRequire is not supported in browser runtime`);
  };
}

export class Module {
  id: string;
  filename: string;
  exports: unknown = {};
  loaded = false;
  children: Module[] = [];
  paths: string[] = [];
  parent: Module | null = null;

  constructor(id?: string) {
    this.id = id || "";
    this.filename = id || "";
  }

  static _resolveFilename(request: string, _parent?: unknown): string {
    return request;
  }
  static _cache: Record<string, Module> = {};
  static _extensions: Record<string, unknown> = {
    ".js": null,
    ".json": null,
    ".node": null,
  };
  static builtinModules = builtinModules;
  static isBuiltin = isBuiltin;
  static createRequire = createRequire;
  static wrap(code: string): string {
    return `(function (exports, require, module, __filename, __dirname) { ${code}\n});`;
  }
  static Module = Module;
}

export default { Module, builtinModules, isBuiltin, createRequire };
