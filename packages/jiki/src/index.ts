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

export type {
  IRuntime,
  IExecuteResult,
  IRuntimeOptions,
  VFSSnapshot,
  VFSFileEntry,
} from "./runtime-interface";

export * as pathShim from "./polyfills/path";
export { EventEmitter } from "./polyfills/events";
export { createProcess } from "./polyfills/process";
export type { Process, ProcessEnv } from "./polyfills/process";
