// Core polyfills loaded eagerly (used by almost every container).
import * as _pathMod from "./polyfills/path";
import _eventsMod from "./polyfills/events";
import _streamMod, { bufferModule as _bufferMod } from "./polyfills/stream";

export { _bufferMod as bufferPolyfill };

// Secondary polyfills — statically imported but only evaluated via the
// registry factory on first require(). The `loaded` cache in resolveBuiltin
// ensures each factory runs at most once. While the modules themselves are
// loaded at bundle time, no per-module initialization runs until first use.
import * as _httpMod from "./polyfills/http";
import * as _netMod from "./polyfills/net";
import * as _urlMod from "./polyfills/url";
import * as _qsMod from "./polyfills/querystring";
import * as _utilMod from "./polyfills/util";
import * as _ttyMod from "./polyfills/tty";
import * as _osMod from "./polyfills/os";
import * as _cryptoMod from "./polyfills/crypto";
import * as _zlibMod from "./polyfills/zlib";
import * as _cpMod from "./polyfills/child_process";
import _assertMod from "./polyfills/assert";
import * as _readlineMod from "./polyfills/readline";
import * as _v8Mod from "./polyfills/v8";
import * as _vmMod from "./polyfills/vm";
import * as _moduleMod from "./polyfills/module";
import * as _perfHooksMod from "./polyfills/perf_hooks";
import * as _chokidarMod from "./polyfills/chokidar";
import * as _wsMod from "./polyfills/ws";
import * as _readdirpMod from "./polyfills/readdirp";

// Stubs are imported but each stub is only constructed via its IIFE when
// first accessed through the registry factory.
import * as _stubsMod from "./polyfills/stubs";
import _workerThreadsMod from "./polyfills/worker-threads";

function cloneNamespace(ns: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const k of Object.keys(ns)) copy[k] = ns[k];
  return copy;
}

class StringDecoder {
  private enc: string;
  constructor(encoding?: string) {
    this.enc = encoding || "utf8";
  }
  write(buf: Uint8Array): string {
    return new TextDecoder(this.enc).decode(buf);
  }
  end(buf?: Uint8Array): string {
    return buf ? this.write(buf) : "";
  }
}

const FS_CONSTANTS = {
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  O_CREAT: 64,
  O_EXCL: 128,
  O_TRUNC: 512,
  O_APPEND: 1024,
  O_DIRECTORY: 65536,
  O_NOFOLLOW: 131072,
  O_SYNC: 1052672,
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  S_IFMT: 61440,
  S_IFREG: 32768,
  S_IFDIR: 16384,
  S_IFLNK: 40960,
  S_IRWXU: 448,
  S_IRUSR: 256,
  S_IWUSR: 128,
  S_IXUSR: 64,
  UV_FS_COPYFILE_EXCL: 1,
  COPYFILE_EXCL: 1,
  UV_FS_COPYFILE_FICLONE: 2,
} as const;

type Loader = () => unknown;

const registry: Record<string, Loader> = {
  path: () => _pathMod,
  events: () => _eventsMod,
  stream: () => _streamMod,
  buffer: () => _bufferMod,
  http: () => cloneNamespace(_httpMod as unknown as Record<string, unknown>),
  https: () => (_httpMod as any).httpsModule,
  net: () => _netMod,
  url: () => _urlMod,
  querystring: () => _qsMod,
  util: () => _utilMod,
  tty: () => _ttyMod,
  os: () => _osMod,
  crypto: () => _cryptoMod,
  zlib: () => _zlibMod,
  child_process: () => _cpMod,
  assert: () => _assertMod,
  readline: () => _readlineMod,
  v8: () => _v8Mod,
  vm: () => _vmMod,
  module: () => _moduleMod,
  perf_hooks: () => _perfHooksMod,
  chokidar: () => _chokidarMod,
  ws: () => _wsMod,
  readdirp: () => _readdirpMod,

  async_hooks: () => _stubsMod.async_hooks,
  cluster: () => _stubsMod.cluster,
  dgram: () => _stubsMod.dgram,
  diagnostics_channel: () => _stubsMod.diagnostics_channel,
  dns: () => _stubsMod.dns,
  domain: () => _stubsMod.domain,
  esbuild: () => _stubsMod.esbuild,
  fsevents: () => _stubsMod.fsevents,
  http2: () => _stubsMod.http2,
  inspector: () => _stubsMod.inspector,
  "inspector/promises": () => _stubsMod.inspector,
  rollup: () => _stubsMod.rollup_stub,
  tls: () => _stubsMod.tls,
  worker_threads: () => _workerThreadsMod,

  constants: () => FS_CONSTANTS,
  string_decoder: () => ({ StringDecoder }),
  timers: () => ({
    setTimeout: globalThis.setTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    setImmediate: (fn: () => void) => setTimeout(fn, 0),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    clearImmediate: globalThis.clearTimeout.bind(globalThis),
  }),
  _http_common: () => ({}),
  _http_incoming: () => ({}),
  _http_outgoing: () => ({}),
  console: () => ({
    ...console,
    Console: class Console {
      log(...a: unknown[]) {
        console.log(...a);
      }
      error(...a: unknown[]) {
        console.error(...a);
      }
      warn(...a: unknown[]) {
        console.warn(...a);
      }
      info(...a: unknown[]) {
        console.info(...a);
      }
    },
  }),
  "util/types": () => _utilMod.types,
  "path/posix": () => _pathMod,
  "path/win32": () => _pathMod.win32,
  "timers/promises": () => ({
    setTimeout: (ms: number) => new Promise(r => setTimeout(r, ms)),
    setInterval: globalThis.setInterval,
    setImmediate: (v?: unknown) => new Promise(r => setTimeout(() => r(v), 0)),
    scheduler: { wait: (ms: number) => new Promise(r => setTimeout(r, ms)) },
  }),
};

const loaded: Record<string, unknown> = {};

export function resolveBuiltin(name: string): unknown | undefined {
  if (loaded[name] !== undefined) return loaded[name];
  const loader = registry[name];
  if (!loader) return undefined;
  const result = loader();
  loaded[name] = result;
  return result;
}

export function isBuiltinModule(name: string): boolean {
  return (
    name in registry ||
    name === "fs" ||
    name === "fs/promises" ||
    name === "process"
  );
}

/**
 * Register a custom polyfill for a built-in module name.
 * Replaces any existing polyfill for the same name.
 * The factory is called lazily on first `require()`.
 */
export function registerBuiltin(name: string, factory: () => unknown): void {
  registry[name] = factory;
  // Clear loaded cache so the new factory takes effect on next require().
  delete loaded[name];
}

/**
 * Register multiple custom polyfills at once.
 */
export function registerBuiltins(map: Record<string, () => unknown>): void {
  for (const [name, factory] of Object.entries(map)) {
    registerBuiltin(name, factory);
  }
}

/**
 * Unregister a custom polyfill, reverting to the default (if any was
 * overridden) or removing the module entirely.
 */
export function unregisterBuiltin(name: string): void {
  delete registry[name];
  delete loaded[name];
}

/** Return a list of all registered builtin module names. */
export function listBuiltins(): string[] {
  return Object.keys(registry);
}

export const builtinModules = loaded;
