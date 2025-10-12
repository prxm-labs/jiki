import { MemFS } from "./memfs";
import type { PackageJson } from "./types/package-json";
import type { FsShim } from "./polyfills/fs";
import type { Process } from "./polyfills/process";
import * as pathShim from "./polyfills/path";
import { resolveBuiltin, isBuiltinModule } from "./builtins";
import { getProcessedSource } from "./code-transform";
import {
  wrapDynamicImport,
  buildConsoleProxy,
  buildModuleWrapper,
} from "./runtime-helpers";
import {
  resolve as resolveExports,
  imports as resolveImports,
} from "resolve.exports";
import type { PluginRegistry } from "./plugin";

export interface Module {
  id: string;
  filename: string;
  exports: unknown;
  loaded: boolean;
  children: Module[];
  paths: string[];
}

export interface AutoInstallProvider {
  installSync(name: string): void;
}

export interface RuntimeOptions {
  cwd?: string;
  env?: Record<string, string>;
  onConsole?: (method: string, args: unknown[]) => void;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  autoInstall?: boolean;
  autoInstallProvider?: AutoInstallProvider;
  /** Enable inline source maps for TypeScript/JSX transpilation. */
  sourceMaps?: boolean;
}

export interface RequireFunction {
  (id: string): unknown;
  resolve: ((id: string) => string) & {
    paths: (id: string) => string[] | null;
  };
  cache: Record<string, Module>;
}

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
const ENTRY_FIELDS = ["main", "module"] as const;

export class ModuleResolver {
  private vfs: MemFS;
  private fsShim: FsShim;
  private proc: Process;
  private opts: RuntimeOptions;
  private cache: Record<string, Module>;
  private transformedCache: Map<string, string>;
  private debug: boolean;
  private pluginRegistry?: PluginRegistry;

  private pkgJsonMemo = new Map<string, PackageJson | null>();
  private resolveMemo = new Map<string, string | null>();

  clearMemos(): void {
    this.pkgJsonMemo.clear();
    this.resolveMemo.clear();
  }

  /** Invalidate cached resolution entries that match the given file path.
   *  This enables per-entry cache invalidation when a file changes on disk. */
  invalidate(path: string): void {
    // Remove any resolveMemo entries whose resolved value matches this path
    for (const [key, value] of this.resolveMemo) {
      if (value === path) this.resolveMemo.delete(key);
    }
    // Remove the module from the require cache so it gets re-evaluated
    if (this.cache[path]) delete this.cache[path];
    // Remove any pkgJsonMemo that matches this path (e.g. if a package.json was edited)
    if (this.pkgJsonMemo.has(path)) this.pkgJsonMemo.delete(path);
    // Remove transformed source cache
    if (this.transformedCache.has(path)) this.transformedCache.delete(path);
  }

  constructor(
    vfs: MemFS,
    fsShim: FsShim,
    proc: Process,
    cache: Record<string, Module>,
    opts: RuntimeOptions,
    transformedCache: Map<string, string>,
    pluginRegistry?: PluginRegistry,
  ) {
    this.vfs = vfs;
    this.fsShim = fsShim;
    this.proc = proc;
    this.cache = cache;
    this.opts = opts;
    this.transformedCache = transformedCache;
    this.debug = !!(opts.env && opts.env.DEBUG_RESOLVER);
    this.pluginRegistry = pluginRegistry;
  }

  makeRequire(fromDir: string): RequireFunction {
    const self = this;

    const fn = ((id: string): unknown => {
      const resolved = self.resolve(id, fromDir);
      return self.load(resolved).exports;
    }) as RequireFunction;

    const resolveFn = (id: string): string => self.resolve(id, fromDir);
    (resolveFn as any).paths = (id: string): string[] | null => {
      const bare = id.startsWith("node:") ? id.slice(5) : id;
      if (isBuiltinModule(bare)) return null;
      const dirs: string[] = [];
      let d = fromDir;
      while (d !== "/") {
        dirs.push(pathShim.join(d, "node_modules"));
        d = pathShim.dirname(d);
      }
      dirs.push("/node_modules");
      return dirs;
    };
    fn.resolve = resolveFn as RequireFunction["resolve"];
    fn.cache = this.cache;
    return fn;
  }

  resolve(id: string, fromDir: string): string {
    if (id.startsWith("node:")) id = id.slice(5);
    if (isBuiltinModule(id)) return id;

    // --- Plugin onResolve hooks (first match wins) ---
    if (this.pluginRegistry) {
      const pluginResult = this.pluginRegistry.runResolve(id, fromDir);
      if (pluginResult && pluginResult.path) return pluginResult.path;
    }

    if (id.startsWith("#")) return this.resolvePackageImport(id, fromDir);

    const memoKey = `${fromDir}|${id}`;
    const memoized = this.resolveMemo.get(memoKey);
    if (memoized !== undefined) {
      if (memoized === null) throw new Error(`Cannot find module '${id}'`);
      return memoized;
    }

    let found: string | null = null;

    if (
      id === "." ||
      id === ".." ||
      id.startsWith("./") ||
      id.startsWith("../") ||
      id.startsWith("/")
    ) {
      const abs = id.startsWith("/") ? id : pathShim.resolve(fromDir, id);
      found = this.probeFile(abs);
      if (!found) {
        this.resolveMemo.set(memoKey, null);
        throw new Error(`Cannot find module '${id}' from '${fromDir}'`);
      }
    } else {
      if (id === "rollup" || id.startsWith("rollup/")) return "rollup";
      found = this.resolveFromNodeModules(id, fromDir);
      if (!found && this.opts.autoInstall && this.opts.autoInstallProvider) {
        const pkgName = this.extractPackageName(id);
        try {
          this.opts.autoInstallProvider.installSync(pkgName);
          this.resolveMemo.delete(memoKey);
          found = this.resolveFromNodeModules(id, fromDir);
        } catch (e) {
          if (this.debug) {
            console.warn(
              `[jiki:resolver] auto-install failed for '${pkgName}': ${(e as Error).message}`,
            );
          }
        }
      }
      if (!found) {
        this.resolveMemo.set(memoKey, null);
        throw new Error(`Cannot find module '${id}' from '${fromDir}'`);
      }
    }

    this.resolveMemo.set(memoKey, found);
    return found;
  }

  load(resolved: string): Module {
    if (this.cache[resolved]) return this.cache[resolved];

    const builtin = resolveBuiltin(resolved);
    if (builtin !== undefined) return this.cacheAndReturn(resolved, builtin);

    if (resolved === "fs" || resolved === "fs/promises") {
      const exp =
        resolved === "fs/promises" ? this.fsShim.promises : this.fsShim;
      return this.cacheAndReturn(resolved, exp);
    }
    if (resolved === "process") {
      return this.cacheAndReturn("process", this.proc);
    }

    // --- Plugin onLoad hooks (first match wins) ---
    if (this.pluginRegistry) {
      const pluginResult = this.pluginRegistry.runLoad(resolved);
      if (pluginResult && pluginResult.contents !== undefined) {
        const entry: Module = {
          id: resolved,
          filename: resolved,
          exports: {},
          loaded: false,
          children: [],
          paths: [pathShim.dirname(resolved)],
        };
        this.cache[resolved] = entry;

        try {
          let source = getProcessedSource(
            pluginResult.contents,
            resolved,
            this.transformedCache,
            this.opts.sourceMaps,
          );
          // Run plugin transform pipeline on the loaded source.
          source = this.pluginRegistry.runTransform(resolved, source);
          const dir = pathShim.dirname(resolved);
          const childRequire = this.makeRequire(dir);
          const meta = {
            url: `file://${resolved}`,
            dirname: dir,
            filename: resolved,
          };
          const dynImport = wrapDynamicImport(childRequire);
          const consoleFacade = buildConsoleProxy(this.opts.onConsole);
          const wrapper = buildModuleWrapper(source, resolved);

          wrapper(
            entry.exports,
            childRequire,
            entry,
            resolved,
            dir,
            this.proc,
            consoleFacade,
            meta,
            dynImport,
          );
          entry.loaded = true;
          return entry;
        } catch (err) {
          delete this.cache[resolved];
          throw new Error(
            `Error loading module '${resolved}': ${(err as Error).message}`,
          );
        }
      }
    }

    const entry: Module = {
      id: resolved,
      filename: resolved,
      exports: {},
      loaded: false,
      children: [],
      paths: [pathShim.dirname(resolved)],
    };
    this.cache[resolved] = entry;

    try {
      if (resolved.endsWith(".json")) {
        entry.exports = JSON.parse(this.vfs.readFileSync(resolved, "utf8"));
        entry.loaded = true;
        return entry;
      }

      const rawSource = this.vfs.readFileSync(resolved, "utf8");
      let source = getProcessedSource(
        rawSource,
        resolved,
        this.transformedCache,
        this.opts.sourceMaps,
      );
      // Run plugin transform pipeline on VFS-loaded source.
      if (this.pluginRegistry) {
        source = this.pluginRegistry.runTransform(resolved, source);
      }

      const dir = pathShim.dirname(resolved);
      const childRequire = this.makeRequire(dir);
      const meta = {
        url: `file://${resolved}`,
        dirname: dir,
        filename: resolved,
      };
      const dynImport = wrapDynamicImport(childRequire);
      const consoleFacade = buildConsoleProxy(this.opts.onConsole);
      const wrapper = buildModuleWrapper(source, resolved);

      wrapper(
        entry.exports,
        childRequire,
        entry,
        resolved,
        dir,
        this.proc,
        consoleFacade,
        meta,
        dynImport,
      );

      entry.loaded = true;
      return entry;
    } catch (err) {
      delete this.cache[resolved];
      throw new Error(
        `Error loading module '${resolved}': ${(err as Error).message}`,
      );
    }
  }

  private cacheAndReturn(id: string, exports: unknown): Module {
    const m: Module = {
      id,
      filename: id,
      exports,
      loaded: true,
      children: [],
      paths: [],
    };
    this.cache[id] = m;
    return m;
  }

  private readPkg(pkgPath: string): PackageJson | null {
    if (this.pkgJsonMemo.has(pkgPath)) return this.pkgJsonMemo.get(pkgPath)!;
    try {
      const data = JSON.parse(
        this.vfs.readFileSync(pkgPath, "utf8"),
      ) as PackageJson;
      this.pkgJsonMemo.set(pkgPath, data);
      return data;
    } catch {
      this.pkgJsonMemo.set(pkgPath, null);
      return null;
    }
  }

  probeFile(base: string): string | null {
    if (this.vfs.existsSync(base)) {
      const st = this.vfs.statSync(base);
      if (st.isFile()) return base;
      if (st.isDirectory()) {
        const pkg = this.readPkg(pathShim.join(base, "package.json"));
        if (pkg) {
          for (const field of ENTRY_FIELDS) {
            const val = (pkg as Record<string, unknown>)[field];
            if (typeof val === "string") {
              const hit = this.probeFile(pathShim.join(base, val));
              if (hit) return hit;
            }
          }
        }
        for (const idx of INDEX_NAMES) {
          const p = pathShim.join(base, idx);
          if (this.vfs.existsSync(p)) return p;
        }
      }
    }
    for (const ext of FILE_EXTENSIONS) {
      const p = base + ext;
      if (this.vfs.existsSync(p)) return p;
    }
    return null;
  }

  private resolvePackageImport(id: string, fromDir: string): string {
    let dir = fromDir;
    while (dir !== "/") {
      const pkg = this.readPkg(pathShim.join(dir, "package.json"));
      if (pkg?.imports) {
        try {
          const resolved = resolveImports(pkg, id, { require: true });
          if (resolved && resolved.length > 0) {
            const full = pathShim.join(dir, resolved[0]);
            if (this.vfs.existsSync(full)) return full;
          }
        } catch (e) {
          if (this.debug) {
            console.warn(
              `[jiki:resolver] imports resolution failed for '${id}' in ${dir}: ${(e as Error).message}`,
            );
          }
        }
      }
      dir = pathShim.dirname(dir);
    }
    throw new Error(`Cannot find module '${id}'`);
  }

  private extractPackageName(id: string): string {
    const segments = id.split("/");
    if (segments[0].startsWith("@") && segments.length > 1) {
      return `${segments[0]}/${segments[1]}`;
    }
    return segments[0];
  }

  private resolveFromNodeModules(id: string, fromDir: string): string | null {
    const segments = id.split("/");
    const pkgName =
      segments[0].startsWith("@") && segments.length > 1
        ? `${segments[0]}/${segments[1]}`
        : segments[0];
    const subpath = segments.slice(pkgName.split("/").length).join("/");

    let dir = fromDir;
    while (true) {
      const nm = pathShim.join(dir, "node_modules");
      if (this.vfs.existsSync(nm)) {
        const pkgRoot = pathShim.join(nm, pkgName);
        const hit = this.tryPackageEntry(pkgRoot, pkgName, subpath);
        if (hit) return hit;
      }
      if (dir === "/") break;
      dir = pathShim.dirname(dir);
    }
    return null;
  }

  private tryPackageEntry(
    pkgRoot: string,
    pkgName: string,
    subpath: string,
  ): string | null {
    const pkg = this.readPkg(pathShim.join(pkgRoot, "package.json"));

    if (pkg) {
      if (pkg.exports) {
        const target = subpath ? `${pkgName}/${subpath}` : pkgName;
        for (const cond of [
          { require: true }, // node + require + default (auto)
          { import: true }, // node + import + default (auto)
          { browser: true, require: true }, // browser + require + default
          { browser: true, import: true }, // browser + import + default
          { require: true, conditions: ["production"] }, // production builds
        ] as const) {
          try {
            const resolved = resolveExports(pkg, target, cond);
            if (resolved?.length) {
              const hit = this.probeFile(pathShim.join(pkgRoot, resolved[0]));
              if (hit) return hit;
            }
          } catch (e) {
            if (this.debug) {
              console.warn(
                `[jiki:resolver] exports resolution failed for '${target}' in ${pkgRoot} with conditions ${JSON.stringify(cond)}: ${(e as Error).message}`,
              );
            }
          }
        }
        // If exports is defined, do NOT fall through to main/module/browser
        // per Node.js module resolution spec
        return null;
      }

      if (subpath) {
        const hit = this.probeFile(pathShim.join(pkgRoot, subpath));
        if (hit) return hit;
      }

      if (typeof pkg.browser === "string") {
        const hit = this.probeFile(pathShim.join(pkgRoot, pkg.browser));
        if (hit) return hit;
      }

      if (pkg.main) {
        const hit = this.probeFile(pathShim.join(pkgRoot, pkg.main));
        if (hit) return hit;
      }

      if (pkg.module) {
        const hit = this.probeFile(pathShim.join(pkgRoot, pkg.module));
        if (hit) return hit;
      }
    }

    return this.probeFile(subpath ? pathShim.join(pkgRoot, subpath) : pkgRoot);
  }
}
