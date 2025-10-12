import { MemFS } from "./memfs";
import { Kernel, RuntimeOptions } from "./kernel";
import {
  PackageManager,
  InstallOptions,
  InstallResult,
  NpmLayout,
} from "./npm/index";
import { PnpmLayout } from "./npm/pnpm";
import { Shell, ShellOptions, createShell } from "./shell";
import type { IExecuteResult, VFSSnapshot } from "./runtime-interface";
import * as pathShim from "./polyfills/path";
import { base64ToUint8 } from "./utils/binary-encoding";
import {
  setStreamingCallbacks,
  clearStreamingCallbacks,
  sendStdin,
} from "./polyfills/child_process";
import { SyncAutoInstaller } from "./npm/sync-installer";
import { PluginRegistry, type JikiPlugin } from "./plugin";
import type { PersistenceAdapter } from "./persistence";
import {
  registerBuiltin,
  registerBuiltins,
  unregisterBuiltin,
} from "./builtins";
import { shouldUseWorker, type WorkerMode } from "./worker-runtime";
import { SandboxGuard, type SandboxOptions } from "./sandbox";
import { Metrics } from "./metrics";
import { NetworkInterceptor, type MockResponse } from "./network-interceptor";

export interface ContainerOptions {
  cwd?: string;
  env?: Record<string, string>;
  registry?: string;
  /** `'npm'` (default) or `'pnpm'` */
  packageManager?: "npm" | "pnpm";
  /** Automatically install missing packages on require() */
  autoInstall?: boolean;
  onConsole?: (method: string, args: unknown[]) => void;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  /** Plugins to register on this container. */
  plugins?: JikiPlugin[];
  /** Persistence adapter for surviving page refreshes. */
  persistence?: PersistenceAdapter;
  /** Enable inline source maps for TypeScript/JSX transpilation (default: false). */
  sourceMaps?: boolean;
  /**
   * Worker mode for CPU-intensive operations.
   * - `false` (default) — everything on the main thread
   * - `true` — transpilation runs in a Web Worker
   * - `'auto'` — use workers when available (browser), skip in Node.js
   */
  worker?: boolean | "auto";
  /** Resource limits and access controls. */
  sandbox?: SandboxOptions;
}

export interface RunOptions extends ShellOptions {
  signal?: AbortSignal;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class Container {
  readonly vfs: MemFS;
  readonly runtime: Kernel;
  readonly packageManager: PackageManager;
  readonly shell: Shell;
  /** Plugin registry for this container. */
  readonly plugins: PluginRegistry;
  /** Sandbox guard enforcing resource limits. */
  readonly sandbox: SandboxGuard;
  /** Performance metrics for this container. */
  readonly metrics: Metrics;
  /** Network request interceptor for mocking fetch calls. */
  readonly network: NetworkInterceptor;
  private _pnpmPm?: PackageManager;
  private _containerCwd: string;
  private _containerRegistry?: string;
  private _workerMode: WorkerMode;

  constructor(options: ContainerOptions = {}) {
    const cwd = options.cwd || "/";
    const usePnpm = options.packageManager === "pnpm";
    this._containerCwd = cwd;
    this._containerRegistry = options.registry;
    this._workerMode = options.worker ?? false;

    // Initialise plugin registry, sandbox, and metrics before other subsystems.
    this.plugins = new PluginRegistry();
    this.sandbox = new SandboxGuard(options.sandbox || {});
    this.metrics = new Metrics();
    this.network = new NetworkInterceptor();
    if (options.plugins) {
      for (const p of options.plugins) this.plugins.register(p);
    }

    this.vfs = new MemFS({
      persistence: options.persistence,
      sandbox: this.sandbox,
    });

    const layout = usePnpm ? new PnpmLayout() : new NpmLayout();
    this.packageManager = new PackageManager(this.vfs, {
      cwd,
      registry: options.registry,
      layout,
    });

    const autoInstallProvider = options.autoInstall
      ? new SyncAutoInstaller(this.vfs, layout, {
          cwd,
          registry: options.registry,
        })
      : undefined;

    this.runtime = new Kernel(
      this.vfs,
      {
        cwd,
        env: options.env,
        onConsole: options.onConsole,
        onStdout: options.onStdout,
        onStderr: options.onStderr,
        autoInstall: options.autoInstall,
        autoInstallProvider,
        sourceMaps: options.sourceMaps,
      },
      this.plugins,
    );

    if (usePnpm) {
      this._pnpmPm = this.packageManager;
    }

    this.shell = createShell(this.vfs, this.runtime, this.packageManager, {
      cwd,
      env: options.env,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
      pnpmPm: usePnpm ? this.packageManager : undefined,
      lazyPnpmPm: usePnpm ? undefined : () => this.lazyPnpmPm,
    });

    // Register plugin-provided shell commands.
    for (const entry of this.plugins.getCommandHooks()) {
      this.shell.registerCommand(entry.name, entry.handler);
    }
  }

  private get lazyPnpmPm(): PackageManager {
    if (!this._pnpmPm) {
      this._pnpmPm = new PackageManager(this.vfs, {
        cwd: this._containerCwd,
        registry: this._containerRegistry,
        layout: new PnpmLayout(),
      });
    }
    return this._pnpmPm;
  }

  async init(options?: { wasmURL?: string | URL }): Promise<void> {
    await this.vfs.hydrate();
    await this.runtime.init({
      ...options,
      useWorker: shouldUseWorker(this._workerMode),
    });
    this.plugins.runBoot();
  }

  writeFile(path: string, content: string | Uint8Array): void {
    const dir = pathShim.dirname(path);
    if (dir !== "/" && !this.vfs.existsSync(dir)) {
      this.vfs.mkdirSync(dir, { recursive: true });
    }
    // Sandbox checks are enforced at the VFS level (MemFS.putFile)
    // so they apply to all write paths: Container, Shell, executed code.
    this.vfs.writeFileSync(path, content);
    this.metrics.trackWrite();
  }

  readFile(path: string): string;
  readFile(path: string, encoding: null): Uint8Array;
  readFile(path: string, encoding?: null): string | Uint8Array {
    this.metrics.trackRead();
    return encoding === null
      ? this.vfs.readFileSync(path)
      : this.vfs.readFileSync(path, "utf8");
  }

  mkdir(path: string): void {
    this.vfs.mkdirSync(path, { recursive: true });
  }
  readdir(path: string): string[] {
    return this.vfs.readdirSync(path);
  }
  exists(path: string): boolean {
    return this.vfs.existsSync(path);
  }
  rm(path: string): void {
    this.vfs.rmSync(path, { recursive: true, force: true });
  }

  execute(code: string, filename?: string): IExecuteResult {
    return this.runtime.execute(code, filename);
  }

  runFile(filename: string): IExecuteResult {
    return this.runtime.runFile(filename);
  }

  async run(command: string, options?: RunOptions): Promise<RunResult> {
    this.metrics.trackCommand();
    if (options?.onStdout || options?.onStderr || options?.signal) {
      setStreamingCallbacks({
        onStdout: options.onStdout,
        onStderr: options.onStderr,
        signal: options.signal,
      });
    }
    try {
      return await this.shell.exec(command, options);
    } finally {
      clearStreamingCallbacks();
    }
  }

  sendInput(data: string): void {
    sendStdin(data);
    // Also push to process.stdin so readline/inquirer can receive it.
    (this.runtime.process.stdin as any)?._push?.(data);
  }

  /** Register a custom polyfill for a built-in module. */
  registerPolyfill(name: string, factory: () => unknown): void {
    registerBuiltin(name, factory);
  }

  /** Register multiple custom polyfills at once. */
  registerPolyfills(map: Record<string, () => unknown>): void {
    registerBuiltins(map);
  }

  /** Unregister a custom polyfill. */
  unregisterPolyfill(name: string): void {
    unregisterBuiltin(name);
  }

  /** Mock a fetch URL with a static response. */
  mockFetch(pattern: string | RegExp, response: MockResponse): void {
    this.network.mock(pattern, response);
  }

  /** Register a dynamic fetch interceptor. */
  onFetch(
    handler: (
      url: string,
      init?: RequestInit,
    ) =>
      | MockResponse
      | null
      | undefined
      | Promise<MockResponse | null | undefined>,
  ): void {
    this.network.onFetch(handler);
  }

  /** Get a snapshot of performance metrics. */
  getMetrics() {
    return this.metrics.snapshot();
  }

  async install(
    packages: string | string[],
    options?: InstallOptions,
  ): Promise<InstallResult> {
    const start = Date.now();
    const result = await this.packageManager.install(packages, options);
    this.metrics.trackInstall(Date.now() - start);
    const names = Array.isArray(packages) ? packages : [packages];
    this.plugins.runInstall(names);
    return result;
  }

  async installDependencies(options?: InstallOptions): Promise<InstallResult> {
    const result = await this.packageManager.installFromPackageJson(options);
    this.plugins.runInstall([]);
    return result;
  }

  toSnapshot(): VFSSnapshot {
    return this.vfs.toSnapshot();
  }

  static fromSnapshot(
    snapshot: VFSSnapshot,
    options?: ContainerOptions,
  ): Container {
    const container = new Container(options);

    for (const entry of snapshot.files) {
      if (entry.path === "/") continue;
      if (entry.type === "directory") {
        container.vfs.mkdirSync(entry.path, { recursive: true });
      } else if (entry.type === "file" && entry.content) {
        const dir = pathShim.dirname(entry.path);
        if (dir !== "/") container.vfs.mkdirSync(dir, { recursive: true });
        container.vfs.writeFileSync(entry.path, base64ToUint8(entry.content));
      } else if (entry.type === "symlink" && entry.target) {
        container.vfs.symlinkSync(entry.target, entry.path);
      }
    }
    return container;
  }

  export(path = "/"): Record<string, unknown> {
    return this.vfs.export(path);
  }

  destroy(): void {
    this.runtime.clearCache();
  }
}

/** Register a plugin on an existing container (post-construction). */
export function registerPlugin(container: Container, plugin: JikiPlugin): void {
  container.plugins.register(plugin);
  for (const entry of container.plugins.getCommandHooks()) {
    container.shell.registerCommand(entry.name, entry.handler);
  }
}

export function boot(options?: ContainerOptions): Container {
  return new Container(options);
}

export { boot as createContainer };
