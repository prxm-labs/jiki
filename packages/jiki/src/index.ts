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

export { PluginRegistry } from "./plugin";

export { IndexedDBAdapter, InMemoryAdapter } from "./persistence";
export type {
  PersistenceAdapter,
  PersistedEntry,
  IndexedDBAdapterOptions,
} from "./persistence";
export type { MemFSOptions } from "./memfs";
export type {
  JikiPlugin,
  PluginHooks,
  OnResolveArgs,
  OnResolveResult,
  OnResolveCallback,
  OnLoadArgs,
  OnLoadResult,
  OnLoadCallback,
  OnTransformArgs,
  OnTransformResult,
  OnTransformCallback,
  OnInstallCallback,
  OnBootCallback,
} from "./plugin";

export { PackageManager, NpmLayout } from "./npm/index";
export type {
  LayoutStrategy,
  InstallOptions,
  InstallResult,
} from "./npm/index";
export { PnpmLayout } from "./npm/pnpm";

export { PackageCache } from "./npm/cache";
export type { PackageCacheOptions } from "./npm/cache";

export { shouldUseWorker } from "./worker-runtime";
export type { WorkerMode, WorkerRuntimeConfig } from "./worker-runtime";

export { SandboxGuard } from "./sandbox";
export type {
  SandboxOptions,
  SandboxLimits,
  SandboxNetwork,
  SandboxFs,
} from "./sandbox";

export { Metrics } from "./metrics";
export type { MetricsSnapshot } from "./metrics";

export {
  NetworkInterceptor,
  mockResponseToFetchResponse,
} from "./network-interceptor";
export type { MockResponse, FetchHandler } from "./network-interceptor";

export {
  discoverWorkspaces,
  resolveWorkspaceDep,
  isWorkspaceProtocol,
  linkWorkspaces,
} from "./npm/workspaces";
export type { WorkspacePackage } from "./npm/workspaces";

export { TypeChecker } from "./type-checker";
export type { Diagnostic, TypeCheckerOptions } from "./type-checker";

export {
  Worker as WorkerThread,
  MessageChannel,
  MessagePort,
} from "./polyfills/worker-threads";

export { Shell, ShellHistory, createShell } from "./shell";
export type {
  ShellOptions,
  ShellProcess,
  ShellContext,
  CommandHandler,
  ShellResult,
} from "./shell";

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

export { NextDevServer } from "./frameworks/next-dev-server";
export type { NextDevServerOptions } from "./frameworks/next-dev-server";
export { ViteDevServer } from "./frameworks/vite-dev-server";
export type { ViteDevServerOptions } from "./frameworks/vite-dev-server";
export { SvelteKitDevServer } from "./frameworks/sveltekit-dev-server";
export type { SvelteKitDevServerOptions } from "./frameworks/sveltekit-dev-server";
export { RemixDevServer } from "./frameworks/remix-dev-server";
export type {
  RemixDevServerOptions,
  RemixRoute,
} from "./frameworks/remix-dev-server";
export { DevServer } from "./dev-server";
export type { DevServerOptions, HMRUpdate, ResponseData } from "./dev-server";

export {
  ServerBridge,
  getServerBridge,
  resetServerBridge,
} from "./server-bridge";
export type {
  IVirtualServer,
  VirtualServer,
  BridgeOptions,
  InitServiceWorkerOptions,
} from "./server-bridge";

export {
  setServerListenCallback,
  setServerCloseCallback,
} from "./polyfills/http";

export {
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  preprocessImports,
  extractPackageName,
} from "./browser-bundle";
export type { BrowserBundle, BundleError } from "./browser-bundle";

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
