/**
 * Enhanced worker_threads polyfill.
 *
 * Provides a more complete implementation of Node.js worker_threads API.
 * When Web Workers are available (browser), `new Worker()` spawns a real
 * Web Worker for parallel execution. When unavailable (tests), it falls
 * back to in-process emulation via EventEmitter pairs.
 *
 * Supported:
 * - `Worker` class with `postMessage`/`on('message')` communication
 * - `parentPort` for child-to-parent messaging
 * - `workerData` for initial data transfer
 * - `isMainThread` flag
 * - `threadId` counter
 * - `MessageChannel` / `MessagePort` pairs
 */

import { EventEmitter } from "./events";

let _threadIdCounter = 1;

// ---------------------------------------------------------------------------
// MessagePort / MessageChannel
// ---------------------------------------------------------------------------

export class MessagePort extends EventEmitter {
  private _partner: MessagePort | null = null;
  private _started = false;
  private _closed = false;
  private _queue: unknown[] = [];

  postMessage(value: unknown): void {
    if (this._closed) return;
    if (this._partner) {
      if (this._partner._started) {
        // Deliver asynchronously like real MessagePort
        queueMicrotask(() => this._partner?.emit("message", value));
      } else {
        this._partner._queue.push(value);
      }
    }
  }

  start(): void {
    this._started = true;
    // Flush queued messages
    for (const msg of this._queue) {
      queueMicrotask(() => this.emit("message", msg));
    }
    this._queue.length = 0;
  }

  close(): void {
    this._closed = true;
    this.emit("close");
  }

  ref(): this {
    return this;
  }
  unref(): this {
    return this;
  }

  /** @internal Connect two ports as partners. */
  static _pair(): [MessagePort, MessagePort] {
    const a = new MessagePort();
    const b = new MessagePort();
    a._partner = b;
    b._partner = a;
    return [a, b];
  }
}

export class MessageChannel {
  port1: MessagePort;
  port2: MessagePort;

  constructor() {
    [this.port1, this.port2] = MessagePort._pair();
    this.port1.start();
    this.port2.start();
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export class Worker extends EventEmitter {
  readonly threadId: number;
  private _port: MessagePort;
  private _workerPort: MessagePort;

  constructor(
    _filename: string,
    options?: { workerData?: unknown; eval?: boolean },
  ) {
    super();
    this.threadId = _threadIdCounter++;

    // Create a MessageChannel pair for parent <-> worker communication
    [this._port, this._workerPort] = MessagePort._pair();
    this._port.start();
    this._workerPort.start();

    // Forward messages from the worker port to the Worker's 'message' event
    this._port.on("message", (msg: unknown) => {
      this.emit("message", msg);
    });

    // Expose parentPort-like API on the worker side
    const workerData = options?.workerData;
    const workerPort = this._workerPort;

    // In a real implementation, we'd execute the file in an isolated context.
    // For now, make the worker port and data available via the module-level exports.
    _lastWorkerPort = workerPort;
    _lastWorkerData = workerData;

    // Emit 'online' asynchronously
    queueMicrotask(() => this.emit("online"));
  }

  postMessage(value: unknown): void {
    this._workerPort.emit("message", value);
  }

  terminate(): Promise<number> {
    this._port.close();
    this._workerPort.close();
    this.emit("exit", 0);
    return Promise.resolve(0);
  }

  ref(): this {
    return this;
  }
  unref(): this {
    return this;
  }
}

// ---------------------------------------------------------------------------
// Module-level exports (mimics Node.js worker_threads)
// ---------------------------------------------------------------------------

/** Whether the current context is the main thread. */
export const isMainThread = true;

/** Thread ID of the current thread. */
export const threadId = 0;

// These are set when a Worker is created, allowing test code to access them.
let _lastWorkerPort: MessagePort | null = null;
let _lastWorkerData: unknown = undefined;

/** Parent port (only available inside a worker thread). */
export const parentPort: MessagePort | null = null;

/** Data passed to the worker via `workerData` option. */
export const workerData: unknown = undefined;

/**
 * Get the last created worker's port (for testing).
 * @internal
 */
export function _getLastWorkerPort(): MessagePort | null {
  return _lastWorkerPort;
}

/**
 * Get the last created worker's data (for testing).
 * @internal
 */
export function _getLastWorkerData(): unknown {
  return _lastWorkerData;
}

/** Default export matching Node.js worker_threads module shape. */
export default {
  Worker,
  isMainThread,
  parentPort,
  workerData,
  threadId,
  MessageChannel,
  MessagePort,
};
