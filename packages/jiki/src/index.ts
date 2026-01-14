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

export { Container, boot, createContainer, registerPlugin } from "./container";
export type { ContainerOptions, RunResult } from "./container";

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

export { PackageManager, NpmLayout } from "./npm/index";
export type {
  LayoutStrategy,
  InstallOptions,
  InstallResult,
} from "./npm/index";
export { PnpmLayout } from "./npm/pnpm";

export { PackageCache } from "./npm/cache";
export type { PackageCacheOptions } from "./npm/cache";

export {
  discoverWorkspaces,
  resolveWorkspaceDep,
  isWorkspaceProtocol,
  linkWorkspaces,
} from "./npm/workspaces";
export type { WorkspacePackage } from "./npm/workspaces";

export { Shell, ShellHistory, createShell } from "./shell";
export type {
  ShellOptions,
  ShellProcess,
  ShellContext,
  CommandHandler,
  ShellResult,
} from "./shell";

export {
  parseError,
  formatErrorText,
  formatErrorHtml,
  errorOverlayScript,
} from "./errors";
export type { ContainerError, ErrorCategory } from "./errors";

export * as pathShim from "./polyfills/path";
export { EventEmitter } from "./polyfills/events";
export { createProcess } from "./polyfills/process";
export type { Process, ProcessEnv } from "./polyfills/process";
export { createFsShim } from "./polyfills/fs";
export type { FsShim } from "./polyfills/fs";
