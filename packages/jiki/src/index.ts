// jiki - Lightweight browser-based Node.js runtime (MIT)

export { MemFS } from "./memfs";
export { MemFS as VirtualFS } from "./memfs";
export type {
  FSNode,
  Stats,
  WatchEventType,
  WatchListener,
  FSWatcher,
  NodeError,
  MemFSOptions,
} from "./memfs";
export { createNodeError } from "./memfs";

export { Kernel, Runtime } from "./kernel";
export type { Module, RuntimeOptions, RequireFunction } from "./kernel";
export type { AutoInstallProvider } from "./module-resolver";
export type {
  IRuntime,
  IExecuteResult,
  IRuntimeOptions,
  VFSSnapshot,
  VFSFileEntry,
} from "./runtime-interface";

export {
  registerBuiltin,
  registerBuiltins,
  unregisterBuiltin,
  listBuiltins,
} from "./builtins";

export {
  initTranspiler,
  transpile,
  transpileSync,
  bundle,
  stopTranspiler,
  needsTranspilation,
  setWasmURL,
  hasSyncSupport,
} from "./transpiler";
export type {
  TranspileOptions,
  BundleOptions,
  BundleResult,
  InitOptions,
} from "./transpiler";

export * as pathShim from "./polyfills/path";
export { EventEmitter } from "./polyfills/events";
export { createProcess } from "./polyfills/process";
export type { Process, ProcessEnv } from "./polyfills/process";
export { createFsShim } from "./polyfills/fs";
export type { FsShim } from "./polyfills/fs";
