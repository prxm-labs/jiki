/**
 * Worker runtime configuration.
 *
 * When `worker` mode is enabled, CPU-intensive operations (transpilation via
 * esbuild-wasm) are offloaded to a Web Worker. This prevents UI freezes
 * during TypeScript/JSX compilation.
 *
 * The `worker` option on Container controls this:
 * - `false` (default) — everything runs on the main thread
 * - `true` — enable worker-based transpilation
 * - `'auto'` — use workers when `Worker` is available (browser), skip in Node.js
 *
 * Full kernel isolation (executing `require()` and `new Function()` in a
 * worker) is planned for a future release and requires SharedArrayBuffer
 * for synchronous VFS access from the worker.
 *
 * @module
 */

export type WorkerMode = boolean | "auto";

/**
 * Determine whether to use worker-based transpilation.
 * Returns `true` if workers should be enabled based on the mode
 * and the current runtime environment.
 */
export function shouldUseWorker(mode: WorkerMode): boolean {
  if (mode === false) return false;
  if (mode === true) return true;
  // 'auto' — use workers in browser environments where Worker is available
  return typeof Worker !== "undefined" && typeof window !== "undefined";
}

/**
 * Configuration for the worker runtime.
 * Currently only affects transpilation; future versions will support
 * full kernel isolation.
 */
export interface WorkerRuntimeConfig {
  /** Whether to use Web Workers for transpilation. */
  useWorker: boolean;
}
