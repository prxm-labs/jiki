/**
 * Browser polyfill for Node.js `vm` module.
 *
 * **IMPORTANT: Security Limitation**
 *
 * This is NOT a true sandbox. In Node.js, `vm` creates a V8 context with its own
 * global object, providing isolation from the host environment. In the browser,
 * this polyfill uses `new Function()` which executes code in the same JavaScript
 * realm as the host page.
 *
 * Implications:
 * - Code executed via `runInContext()` / `runInNewContext()` can access and modify
 *   global browser objects (window, document, etc.) through prototype chain traversal.
 * - There is NO memory isolation — the executed code shares the same heap.
 * - `createContext()` simply returns the sandbox object without creating an isolated context.
 * - The `Script` class wraps code in `new Function()`, not a separate V8 context.
 *
 * This polyfill is suitable for:
 * - Module evaluation (CommonJS require simulation)
 * - Template rendering that expects vm-like API
 * - Code that uses vm for convenience, not security
 *
 * This polyfill is NOT suitable for:
 * - Untrusted code execution
 * - Security sandboxing
 * - Scenarios requiring true memory/scope isolation
 *
 * @module vm
 */

/**
 * Create a "context" from a sandbox object.
 * In the browser, this simply returns the sandbox as-is since we cannot
 * create a true V8 context. The returned object is used as the scope
 * for `runInContext()`.
 */
export function createContext(
  sandbox?: Record<string, unknown>,
): Record<string, unknown> {
  return sandbox || {};
}

/**
 * Execute code in the given context.
 * Uses `new Function()` — does NOT provide true V8 context isolation.
 * @see Module-level JSDoc for security limitations.
 */
export function runInContext(
  code: string,
  context: Record<string, unknown>,
): unknown {
  const keys = Object.keys(context);
  const values = keys.map(k => context[k]);
  const fn = new Function(...keys, `return (${code})`);
  return fn(...values);
}

/**
 * Execute code in a new context created from the sandbox.
 * Equivalent to `runInContext(code, createContext(sandbox))`.
 * @see Module-level JSDoc for security limitations.
 */
export function runInNewContext(
  code: string,
  sandbox?: Record<string, unknown>,
): unknown {
  return runInContext(code, sandbox || {});
}

/**
 * Execute code in the current global context via `new Function()`.
 * @see Module-level JSDoc for security limitations.
 */
export function runInThisContext(code: string): unknown {
  return new Function(`return (${code})`)();
}

/** Always returns true since we cannot distinguish real V8 contexts in the browser. */
export function isContext(_sandbox: unknown): boolean {
  return true;
}

/**
 * Wraps code in a `new Function()` call for deferred execution.
 * Does NOT create a V8 Script object — no compilation caching occurs.
 * @see Module-level JSDoc for security limitations.
 */
export class Script {
  private code: string;
  constructor(code: string, _options?: unknown) {
    this.code = code;
  }
  runInContext(context: Record<string, unknown>): unknown {
    return runInContext(this.code, context);
  }
  runInNewContext(sandbox?: Record<string, unknown>): unknown {
    return runInNewContext(this.code, sandbox);
  }
  runInThisContext(): unknown {
    return runInThisContext(this.code);
  }
}

export default {
  createContext,
  runInContext,
  runInNewContext,
  runInThisContext,
  isContext,
  Script,
};
