import { MemFS } from "./memfs";
import type { IExecuteResult } from "./runtime-interface";
import { simpleHash } from "./utils/hash";
import { createFsShim, FsShim } from "./polyfills/fs";
import * as pathShim from "./polyfills/path";
import { createProcess, Process } from "./polyfills/process";
import { initChildProcess } from "./polyfills/child_process";
import { initChokidar } from "./polyfills/chokidar";
import { initReaddirp } from "./polyfills/readdirp";
import { initModule } from "./polyfills/module";
import { bufferPolyfill } from "./builtins";
import {
  initTranspiler,
  isInitialized,
  needsTranspilation,
  type InitOptions,
} from "./transpiler";
import {
  transpileCache,
  ensureTranspiled,
  transformEsmToCjs,
  getProcessedSource,
} from "./code-transform";
import {
  ModuleResolver,
  type Module,
  type RuntimeOptions,
  type RequireFunction,
} from "./module-resolver";
import {
  wrapDynamicImport,
  buildConsoleProxy,
  buildModuleWrapper,
} from "./runtime-helpers";
import { builtinModules } from "./builtins";
import type { PluginRegistry } from "./plugin";

export type { Module, RuntimeOptions, RequireFunction };

function createRequire(
  vfs: MemFS,
  fsShim: FsShim,
  process: Process,
  currentDir: string,
  moduleCache: Record<string, Module>,
  options: RuntimeOptions,
  processedCodeCache?: Map<string, string>,
  pluginRegistry?: PluginRegistry,
): RequireFunction {
  const resolver = new ModuleResolver(
    vfs,
    fsShim,
    process,
    moduleCache,
    options,
    processedCodeCache || new Map(),
    pluginRegistry,
  );
  return resolver.makeRequire(currentDir);
}

export class Kernel {
  vfs: MemFS;
  fsShim: FsShim;
  process: Process;
  moduleCache: Record<string, Module> = {};
  processedCodeCache = new Map<string, string>();
  private options: RuntimeOptions;
  private maxCacheSize = 4000;
  private cacheAccessTime = new Map<string, number>();
  private resolver: ModuleResolver;
  /** Plugin registry for this kernel (shared with child kernels). */
  readonly pluginRegistry?: PluginRegistry;

  constructor(
    vfs: MemFS,
    options: RuntimeOptions = {},
    pluginRegistry?: PluginRegistry,
  ) {
    this.vfs = vfs;
    this.options = options;
    this.pluginRegistry = pluginRegistry;
    this.process = createProcess({
      cwd: options.cwd || "/",
      env: options.env,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
    });
    this.fsShim = createFsShim(vfs, () => this.process.cwd());
    this.resolver = new ModuleResolver(
      vfs,
      this.fsShim,
      this.process,
      this.moduleCache,
      this.options,
      this.processedCodeCache,
      pluginRegistry,
    );
    initChildProcess(
      vfs,
      (v, opts) => new Kernel(v, opts as RuntimeOptions, pluginRegistry),
    );
    initChokidar(vfs);
    initReaddirp(vfs);
    initModule(dir => this.resolver.makeRequire(dir));
    this.patchGlobals();
  }

  async init(options?: InitOptions): Promise<void> {
    await initTranspiler(options);
  }

  async prepareFile(filename: string): Promise<void> {
    if (!isInitialized()) await initTranspiler();
    await this.walkImports(filename, new Set());
  }

  private async walkImports(file: string, seen: Set<string>): Promise<void> {
    if (seen.has(file)) return;
    seen.add(file);
    if (!this.vfs.existsSync(file)) return;

    const source = this.vfs.readFileSync(file, "utf8");
    await ensureTranspiled(file, source);

    const hash = simpleHash(source);
    const processed = transpileCache.get(`${file}:${hash}`) || source;

    const importPattern =
      /(?:require\s*\(\s*['"]|from\s+['"]|import\s+['"])([^'"]+)['"]/g;
    const dir = pathShim.dirname(file);

    let m;
    while ((m = importPattern.exec(processed)) !== null) {
      const spec = m[1];
      if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
      const abs = spec.startsWith("/") ? spec : pathShim.resolve(dir, spec);
      const resolved = this.resolver.probeFile(abs);
      if (resolved) await this.walkImports(resolved, seen);
    }
  }

  private patchGlobals(): void {
    const inBrowser =
      typeof window !== "undefined" || typeof importScripts === "function";

    if (!globalThis.Buffer || inBrowser) {
      (globalThis as any).Buffer = bufferPolyfill.Buffer;
    }

    if (typeof globalThis.setImmediate === "undefined") {
      (globalThis as any).setImmediate = (fn: () => void, ...args: unknown[]) =>
        setTimeout(fn, 0, ...args);
      (globalThis as any).clearImmediate = clearTimeout;
    }

    if (inBrowser && !(globalThis.setTimeout as any).__patched) {
      const origTimeout = globalThis.setTimeout;
      const origInterval = globalThis.setInterval;
      const timerExtras = () => ({
        ref() {
          return this;
        },
        unref() {
          return this;
        },
        refresh() {
          return this;
        },
        hasRef() {
          return true;
        },
      });
      (globalThis as any).setTimeout = Object.assign(
        (fn: () => void, ms?: number, ...args: unknown[]) => {
          const id = origTimeout(fn, ms, ...args);
          return Object.assign(id, {
            ...timerExtras(),
            [Symbol.toPrimitive]() {
              return id;
            },
          });
        },
        { __patched: true },
      );
      (globalThis as any).setInterval = Object.assign(
        (fn: () => void, ms?: number, ...args: unknown[]) => {
          const id = origInterval(fn, ms, ...args);
          return Object.assign(id, {
            ...timerExtras(),
            [Symbol.toPrimitive]() {
              return id;
            },
          });
        },
        { __patched: true },
      );
    }

    if (!(Error as any).captureStackTrace) {
      (Error as any).captureStackTrace = (target: Error) => {
        const trace = new Error().stack;
        if (trace)
          Object.defineProperty(target, "stack", {
            value: trace,
            writable: true,
            configurable: true,
          });
      };
    }
    if (!(Error as any).prepareStackTrace) {
      (Error as any).prepareStackTrace = undefined;
    }
  }

  execute(code: string, filename?: string): IExecuteResult {
    const fname = filename || `/__exec_${simpleHash(code)}.js`;
    this.vfs.writeFileSync(fname, code);
    return this.runFileSync(fname);
  }

  executeSync(code: string, filename?: string): IExecuteResult {
    return this.execute(code, filename);
  }

  async executeAsync(code: string, filename?: string): Promise<IExecuteResult> {
    return this.execute(code, filename);
  }

  runFile(filename: string): IExecuteResult {
    return this.runFileSync(filename);
  }

  runFileSync(filename: string): IExecuteResult {
    const dir = pathShim.dirname(filename);
    const localRequire = this.resolver.makeRequire(dir);

    this.trimCacheIfOversized();

    const entry: Module = {
      id: filename,
      filename,
      exports: {},
      loaded: false,
      children: [],
      paths: [dir],
    };

    const rawSource = this.vfs.readFileSync(filename, "utf8");
    let source = getProcessedSource(
      rawSource,
      filename,
      this.processedCodeCache,
      this.options.sourceMaps,
    );
    // Run plugin transform pipeline on the executed file.
    if (this.pluginRegistry) {
      source = this.pluginRegistry.runTransform(filename, source);
    }

    const meta = { url: `file://${filename}`, dirname: dir, filename };
    const dynImport = wrapDynamicImport(localRequire);
    const consoleFacade = buildConsoleProxy(this.options.onConsole);
    const wrapper = buildModuleWrapper(source, filename);

    wrapper(
      entry.exports,
      localRequire,
      entry,
      filename,
      dir,
      this.process,
      consoleFacade,
      meta,
      dynImport,
    );

    entry.loaded = true;
    this.moduleCache[filename] = entry;
    this.cacheAccessTime.set(filename, Date.now());
    return { exports: entry.exports, module: entry };
  }

  async runFileAsync(filename: string): Promise<IExecuteResult> {
    return this.runFileSync(filename);
  }

  clearCache(): void {
    for (const key of Object.keys(this.moduleCache)) {
      delete this.moduleCache[key];
    }
    this.cacheAccessTime.clear();
    this.processedCodeCache.clear();
    this.resolver.clearMemos();
  }

  invalidateModule(path: string): void {
    delete this.moduleCache[path];
    const prefix = `${path}:`;
    for (const key of this.processedCodeCache.keys()) {
      if (key.startsWith(prefix)) this.processedCodeCache.delete(key);
    }
  }

  invalidateModulesMatching(predicate: (path: string) => boolean): void {
    for (const key of Object.keys(this.moduleCache)) {
      if (predicate(key)) delete this.moduleCache[key];
    }
    for (const key of this.processedCodeCache.keys()) {
      if (predicate(key.split(":")[0])) this.processedCodeCache.delete(key);
    }
  }

  getVFS(): MemFS {
    return this.vfs;
  }
  getProcess(): Process {
    return this.process;
  }

  private trimCacheIfOversized(): void {
    const keys = Object.keys(this.moduleCache);
    if (keys.length > this.maxCacheSize) {
      // Sort by last-access time (LRU first) and evict least recently used
      const sorted = keys.sort((a, b) => {
        const aTime = this.cacheAccessTime.get(a) || 0;
        const bTime = this.cacheAccessTime.get(b) || 0;
        return aTime - bTime;
      });
      const evictCount = keys.length - this.maxCacheSize + 100;
      const stale = sorted.slice(0, evictCount);
      for (const k of stale) {
        delete this.moduleCache[k];
        this.cacheAccessTime.delete(k);
      }
    }
  }

  /** Record access time for a module cache entry */
  touchCacheEntry(key: string): void {
    this.cacheAccessTime.set(key, Date.now());
  }

  createREPL(): { eval: (code: string) => unknown } {
    const scope: Record<string, unknown> = {};
    const dir = this.process.cwd();
    const localRequire = this.resolver.makeRequire(dir);
    const VALID_IDENT = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

    return {
      eval: (input: string): unknown => {
        const adapted = input.replace(/^(const|let)\s+/gm, "var ");
        // Filter scope keys to only valid JS identifiers to prevent code injection
        const safeKeys = Object.keys(scope).filter(k => VALID_IDENT.test(k));
        const safeValues = safeKeys.map(k => scope[k]);
        try {
          const fn = new Function(
            "require",
            "process",
            "console",
            ...safeKeys,
            `return (${adapted})`,
          );
          return fn(localRequire, this.process, console, ...safeValues);
        } catch {
          const fn = new Function(
            "require",
            "process",
            "console",
            ...safeKeys,
            adapted,
          );
          return fn(localRequire, this.process, console, ...safeValues);
        }
      },
    };
  }
}

export { transformEsmToCjs, createRequire, builtinModules };
export { Kernel as Runtime };
