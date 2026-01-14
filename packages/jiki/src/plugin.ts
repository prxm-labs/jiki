/**
 * Plugin system for jiki.
 *
 * Provides lifecycle hooks that let external code intercept and extend
 * jiki's behaviour at key points: module resolution, module loading,
 * code transformation, shell command registration, package installation,
 * and container boot.
 *
 * The API mirrors esbuild's plugin conventions so it feels familiar to
 * most JavaScript developers.
 *
 * @example
 * ```ts
 * const myPlugin: JikiPlugin = {
 *   name: 'my-plugin',
 *   setup(hooks) {
 *     hooks.onResolve(/^virtual:/, (args) => ({
 *       path: `/virtual/${args.path.slice(8)}`,
 *     }));
 *     hooks.onLoad(/^\/virtual\//, (args) => ({
 *       contents: `module.exports = "hello from ${args.path}";`,
 *     }));
 *   },
 * };
 *
 * const container = boot({ plugins: [myPlugin] });
 * ```
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Arguments passed to an `onResolve` callback. */
export interface OnResolveArgs {
  /** The raw module specifier (e.g. `"virtual:config"` or `"./foo"`). */
  path: string;
  /** Directory the import originates from. */
  resolveDir: string;
}

/** Return value from an `onResolve` callback. */
export interface OnResolveResult {
  /** Resolved absolute path. Returning this skips the default resolver. */
  path: string;
}

/** Arguments passed to an `onLoad` callback. */
export interface OnLoadArgs {
  /** The fully-resolved module path. */
  path: string;
}

/** Return value from an `onLoad` callback. */
export interface OnLoadResult {
  /** Source code to use instead of reading from the VFS. */
  contents: string;
}

/** Arguments passed to an `onTransform` callback. */
export interface OnTransformArgs {
  /** The fully-resolved file path. */
  path: string;
  /** Source code *after* previous transforms in the pipeline. */
  contents: string;
}

/** Return value from an `onTransform` callback. */
export interface OnTransformResult {
  /** Transformed source code. */
  contents: string;
}

/** Callback types for lifecycle hooks. */
export type OnResolveCallback = (
  args: OnResolveArgs,
) => OnResolveResult | null | undefined | void;
export type OnLoadCallback = (
  args: OnLoadArgs,
) => OnLoadResult | null | undefined | void;
export type OnTransformCallback = (
  args: OnTransformArgs,
) => OnTransformResult | null | undefined | void;
export type OnInstallCallback = (packages: string[]) => void;
export type OnBootCallback = () => void;

import type { CommandHandler } from "./shell";

/** Hook registration API handed to {@link JikiPlugin.setup}. */
export interface PluginHooks {
  /**
   * Intercept module resolution.  The first callback whose `filter` matches
   * **and** returns a non-null result wins — later callbacks are skipped.
   */
  onResolve(filter: RegExp, callback: OnResolveCallback): void;
  /**
   * Intercept module loading.  The first callback whose `filter` matches
   * **and** returns a non-null result wins — later callbacks are skipped.
   */
  onLoad(filter: RegExp, callback: OnLoadCallback): void;
  /**
   * Intercept code transformation.  Unlike resolve/load, this is a
   * **pipeline**: every matching callback runs in registration order,
   * each receiving the output of the previous one.
   */
  onTransform(filter: RegExp, callback: OnTransformCallback): void;
  /** Register a custom shell command. */
  onCommand(name: string, handler: CommandHandler): void;
  /** Called after packages are installed. */
  onInstall(callback: OnInstallCallback): void;
  /** Called after the container is fully initialised. */
  onBoot(callback: OnBootCallback): void;
}

/** A jiki plugin. */
export interface JikiPlugin {
  /** Human-readable name (used in error messages and debugging). */
  name: string;
  /** Called once during container construction. Register hooks here. */
  setup(hooks: PluginHooks): void;
}

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

interface ResolveEntry {
  filter: RegExp;
  callback: OnResolveCallback;
  plugin: string;
}
interface LoadEntry {
  filter: RegExp;
  callback: OnLoadCallback;
  plugin: string;
}
interface TransformEntry {
  filter: RegExp;
  callback: OnTransformCallback;
  plugin: string;
}
interface CommandEntry {
  name: string;
  handler: CommandHandler;
  plugin: string;
}
interface InstallEntry {
  callback: OnInstallCallback;
  plugin: string;
}
interface BootEntry {
  callback: OnBootCallback;
  plugin: string;
}

/**
 * Central registry that collects hooks from all plugins and exposes
 * methods for the runtime to invoke them.
 *
 * Intentionally not a singleton — each {@link Container} gets its own
 * `PluginRegistry` so plugins cannot leak between containers.
 */
export class PluginRegistry {
  private resolveHooks: ResolveEntry[] = [];
  private loadHooks: LoadEntry[] = [];
  private transformHooks: TransformEntry[] = [];
  private commandHooks: CommandEntry[] = [];
  private installHooks: InstallEntry[] = [];
  private bootHooks: BootEntry[] = [];

  /** True if at least one plugin has been registered. */
  get hasPlugins(): boolean {
    return (
      this.resolveHooks.length > 0 ||
      this.loadHooks.length > 0 ||
      this.transformHooks.length > 0 ||
      this.commandHooks.length > 0 ||
      this.installHooks.length > 0 ||
      this.bootHooks.length > 0
    );
  }

  /** Number of registered resolve hooks. */
  get resolveHookCount(): number {
    return this.resolveHooks.length;
  }
  /** Number of registered load hooks. */
  get loadHookCount(): number {
    return this.loadHooks.length;
  }
  /** Number of registered transform hooks. */
  get transformHookCount(): number {
    return this.transformHooks.length;
  }
  /** Number of registered command hooks. */
  get commandHookCount(): number {
    return this.commandHooks.length;
  }

  // -- Registration ---------------------------------------------------------

  /** Register all hooks from a single plugin. */
  register(plugin: JikiPlugin): void {
    const hooks: PluginHooks = {
      onResolve: (filter, callback) => {
        this.resolveHooks.push({ filter, callback, plugin: plugin.name });
      },
      onLoad: (filter, callback) => {
        this.loadHooks.push({ filter, callback, plugin: plugin.name });
      },
      onTransform: (filter, callback) => {
        this.transformHooks.push({ filter, callback, plugin: plugin.name });
      },
      onCommand: (name, handler) => {
        this.commandHooks.push({ name, handler, plugin: plugin.name });
      },
      onInstall: callback => {
        this.installHooks.push({ callback, plugin: plugin.name });
      },
      onBoot: callback => {
        this.bootHooks.push({ callback, plugin: plugin.name });
      },
    };
    plugin.setup(hooks);
  }

  // -- Invocation -----------------------------------------------------------

  /**
   * Run resolve hooks.  First matching callback that returns a result wins.
   * Returns `null` if no plugin handled the specifier.
   */
  runResolve(path: string, resolveDir: string): OnResolveResult | null {
    for (const entry of this.resolveHooks) {
      if (entry.filter.test(path)) {
        const result = entry.callback({ path, resolveDir });
        if (result && result.path) return result;
      }
    }
    return null;
  }

  /**
   * Run load hooks.  First matching callback that returns a result wins.
   * Returns `null` if no plugin provided contents.
   */
  runLoad(path: string): OnLoadResult | null {
    for (const entry of this.loadHooks) {
      if (entry.filter.test(path)) {
        const result = entry.callback({ path });
        if (result && result.contents !== undefined) return result;
      }
    }
    return null;
  }

  /**
   * Run transform hooks as a pipeline.
   * Every matching callback runs in order, each receiving the output of the
   * previous one.  Returns the final transformed source.
   */
  runTransform(path: string, contents: string): string {
    let current = contents;
    for (const entry of this.transformHooks) {
      if (entry.filter.test(path)) {
        const result = entry.callback({ path, contents: current });
        if (result && result.contents !== undefined) {
          current = result.contents;
        }
      }
    }
    return current;
  }

  /** Return all command hooks so the shell can register them. */
  getCommandHooks(): CommandEntry[] {
    return this.commandHooks;
  }

  /** Notify all install hooks. */
  runInstall(packages: string[]): void {
    for (const entry of this.installHooks) {
      entry.callback(packages);
    }
  }

  /** Notify all boot hooks. */
  runBoot(): void {
    for (const entry of this.bootHooks) {
      entry.callback();
    }
  }
}
