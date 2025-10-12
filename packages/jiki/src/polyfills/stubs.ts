/**
 * Consolidated stubs for Node.js modules that cannot run in the browser.
 * Each export is a minimal shim that satisfies import resolution without real functionality.
 *
 * Each stub emits a one-time console.warn when first used, so developers are aware
 * that the module is not fully functional in the browser environment.
 */

import { EventEmitter } from "./events";

/**
 * Tracks which stub module warnings have already been emitted.
 * Each warning is shown only once per session to avoid flooding the console.
 */
export const _warnedStubs = new Set<string>();

/**
 * Emit a one-time warning that a stub module is being used.
 * @param moduleName - The name of the Node.js module being stubbed.
 */
function warnStub(moduleName: string): void {
  if (_warnedStubs.has(moduleName)) return;
  _warnedStubs.add(moduleName);
  console.warn(
    `[jiki] "${moduleName}" is a stub module — it provides no real functionality in the browser runtime.`,
  );
}

// --- async_hooks ---

export const async_hooks = (() => {
  warnStub("async_hooks");
  class AsyncLocalStorage<T = unknown> {
    #store: T | undefined;

    getStore(): T | undefined {
      return this.#store;
    }

    run<R>(
      store: T,
      callback: (...args: unknown[]) => R,
      ...args: unknown[]
    ): R {
      const prev = this.#store;
      this.#store = store;
      try {
        return callback(...args);
      } finally {
        this.#store = prev;
      }
    }

    exit<R>(callback: (...args: unknown[]) => R, ...args: unknown[]): R {
      const prev = this.#store;
      this.#store = undefined;
      try {
        return callback(...args);
      } finally {
        this.#store = prev;
      }
    }

    enterWith(store: T): void {
      this.#store = store;
    }
    disable(): void {
      this.#store = undefined;
    }

    snapshot(): <R>(fn: (...args: unknown[]) => R, ...args: unknown[]) => R {
      const captured = this.#store;
      return <R>(fn: (...args: unknown[]) => R, ...args: unknown[]): R => {
        const prev = this.#store;
        this.#store = captured;
        try {
          return fn(...args);
        } finally {
          this.#store = prev;
        }
      };
    }

    static bind<F extends (...args: unknown[]) => unknown>(fn: F): F {
      return fn;
    }

    static snapshot(): <R>(
      fn: (...args: unknown[]) => R,
      ...args: unknown[]
    ) => R {
      return <R>(fn: (...args: unknown[]) => R, ...args: unknown[]): R =>
        fn(...args);
    }
  }

  class AsyncResource {
    type: string;
    constructor(type: string, _opts?: unknown) {
      this.type = type;
    }
    runInAsyncScope<R>(
      fn: (...args: unknown[]) => R,
      thisArg?: unknown,
      ...args: unknown[]
    ): R {
      return fn.apply(thisArg, args);
    }
    emitDestroy(): this {
      return this;
    }
    asyncId(): number {
      return 0;
    }
    triggerAsyncId(): number {
      return 0;
    }
    bind<F extends (...args: unknown[]) => unknown>(fn: F): F {
      return fn;
    }
    static bind<F extends (...args: unknown[]) => unknown>(
      fn: F,
      _type?: string,
    ): F {
      return fn;
    }
  }

  return {
    AsyncLocalStorage,
    AsyncResource,
    executionAsyncId: () => 0,
    triggerAsyncId: () => 0,
    executionAsyncResource: () => ({}),
    createHook: () => ({ enable() {}, disable() {} }),
  };
})();

// --- cluster ---

export const cluster = (() => {
  warnStub("cluster");
  return {
    isWorker: false,
    isMaster: true,
    isPrimary: true,
    workers: {} as Record<string, unknown>,
    fork: () => new EventEmitter(),
    setupMaster() {},
    setupPrimary() {},
    disconnect() {},
    settings: {},
    SCHED_NONE: 1,
    SCHED_RR: 2,
    schedulingPolicy: 2,
  };
})();

// --- dgram ---

export const dgram = (() => {
  warnStub("dgram");
  class Socket extends EventEmitter {
    bind() {
      return this;
    }
    send() {}
    close() {
      this.emit("close");
    }
    address() {
      return { address: "0.0.0.0", family: "IPv4", port: 0 };
    }
    setBroadcast() {}
    setTTL() {}
    setMulticastTTL() {}
    addMembership() {}
    dropMembership() {}
    ref() {
      return this;
    }
    unref() {
      return this;
    }
  }
  return { Socket, createSocket: () => new Socket() };
})();

// --- diagnostics_channel ---

export const diagnostics_channel = (() => {
  warnStub("diagnostics_channel");
  class Channel {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    get hasSubscribers() {
      return false;
    }
    subscribe() {}
    unsubscribe() {
      return false;
    }
    publish() {}
  }

  class TracingChannel {
    start: Channel;
    end: Channel;
    asyncStart: Channel;
    asyncEnd: Channel;
    error: Channel;
    constructor(name: string) {
      this.start = new Channel(`tracing:${name}:start`);
      this.end = new Channel(`tracing:${name}:end`);
      this.asyncStart = new Channel(`tracing:${name}:asyncStart`);
      this.asyncEnd = new Channel(`tracing:${name}:asyncEnd`);
      this.error = new Channel(`tracing:${name}:error`);
    }
    subscribe(_subscribers: Record<string, unknown>) {}
    unsubscribe(_subscribers: Record<string, unknown>) {}
    traceSync(
      fn: (...a: unknown[]) => unknown,
      _ctx?: object,
      thisArg?: unknown,
      ...args: unknown[]
    ) {
      return fn.apply(thisArg, args);
    }
    tracePromise(
      fn: (...a: unknown[]) => unknown,
      _ctx?: object,
      thisArg?: unknown,
      ...args: unknown[]
    ) {
      return fn.apply(thisArg, args);
    }
    traceCallback(
      fn: (...a: unknown[]) => unknown,
      _pos?: number,
      _ctx?: object,
      thisArg?: unknown,
      ...args: unknown[]
    ) {
      return fn.apply(thisArg, args);
    }
  }

  return {
    Channel,
    TracingChannel,
    channel: (n: string) => new Channel(n),
    tracingChannel: (n: string) => new TracingChannel(n),
    hasSubscribers: () => false,
  };
})();

// --- dns ---

export const dns = (() => {
  warnStub("dns");
  return {
    lookup: (_h: string, optsOrCb: unknown, maybeCb?: unknown) => {
      const cb = typeof optsOrCb === "function" ? optsOrCb : maybeCb;
      const opts =
        typeof optsOrCb === "object" && optsOrCb !== null
          ? (optsOrCb as Record<string, unknown>)
          : {};
      if (typeof cb !== "function") return;
      if (opts.all) {
        cb(null, [{ address: "127.0.0.1", family: 4 }]);
      } else {
        cb(null, "127.0.0.1", 4);
      }
    },
    resolve: (_h: string, cb: (e: Error | null, a: string[]) => void) =>
      cb(null, ["127.0.0.1"]),
    resolve4: (_h: string, cb: (e: Error | null, a: string[]) => void) =>
      cb(null, ["127.0.0.1"]),
    resolve6: (_h: string, cb: (e: Error | null, a: string[]) => void) =>
      cb(null, ["::1"]),
    reverse: (_ip: string, cb: (e: Error | null, h: string[]) => void) =>
      cb(null, ["localhost"]),
    getServers: () => ["8.8.8.8"],
    setServers() {},
    NODATA: "ENODATA",
    FORMERR: "EFORMERR",
    SERVFAIL: "ESERVFAIL",
    NOTFOUND: "ENOTFOUND",
    promises: {
      lookup: async (_h: string, opts?: Record<string, unknown>) => {
        if (opts?.all) return [{ address: "127.0.0.1", family: 4 }];
        return { address: "127.0.0.1", family: 4 };
      },
      resolve: async () => ["127.0.0.1"],
      resolve4: async () => ["127.0.0.1"],
      resolve6: async () => ["::1"],
    },
  };
})();

// --- domain ---

export const domain = (() => {
  warnStub("domain");
  class Domain extends EventEmitter {
    members: unknown[] = [];
    add() {}
    remove() {}
    bind(cb: Function) {
      return cb;
    }
    intercept(cb: Function) {
      return cb;
    }
    run(fn: Function) {
      fn();
    }
    dispose() {}
    enter() {}
    exit() {}
  }
  return { Domain, create: () => new Domain() };
})();

// --- esbuild (delegates to real esbuild-wasm) ---

import * as _esbuildWasm from "esbuild-wasm";
import { initTranspiler } from "../transpiler";

export const esbuild = {
  initialize: (opts?: Record<string, unknown>) => initTranspiler(),
  build: (...args: Parameters<typeof _esbuildWasm.build>) => {
    return _esbuildWasm.build(...args);
  },
  transform: (...args: Parameters<typeof _esbuildWasm.transform>) => {
    return _esbuildWasm.transform(...args);
  },
  buildSync: (...args: Parameters<typeof _esbuildWasm.buildSync>) => {
    return _esbuildWasm.buildSync(...args);
  },
  transformSync: (...args: Parameters<typeof _esbuildWasm.transformSync>) => {
    return _esbuildWasm.transformSync(...args);
  },
  formatMessages: (...args: Parameters<typeof _esbuildWasm.formatMessages>) => {
    return _esbuildWasm.formatMessages(...args);
  },
  analyzeMetafile: (
    ...args: Parameters<typeof _esbuildWasm.analyzeMetafile>
  ) => {
    return _esbuildWasm.analyzeMetafile(...args);
  },
  stop: () => _esbuildWasm.stop(),
  version: _esbuildWasm.version,
};

// --- fsevents ---

export const fsevents = (() => {
  warnStub("fsevents");
  return {
    watch: () => ({ stop() {} }),
    getInfo: () => ({ event: "", path: "", type: "", changes: {} }),
    constants: {
      None: 0,
      MustScanSubDirs: 1,
      UserDropped: 2,
      KernelDropped: 4,
      EventIdsWrapped: 8,
    },
  };
})();

// --- http2 ---

export const http2 = (() => {
  warnStub("http2");
  return {
    createServer: () => ({ listen() {}, close() {}, on() {} }),
    createSecureServer: () => ({ listen() {}, close() {}, on() {} }),
    connect: () => ({ on() {}, close() {} }),
    getDefaultSettings: () => ({}),
    getPackedSettings: () => new Uint8Array(0),
    getUnpackedSettings: () => ({}),
    constants: {
      NGHTTP2_SESSION_SERVER: 0,
      NGHTTP2_SESSION_CLIENT: 1,
      HTTP2_HEADER_STATUS: ":status",
      HTTP2_HEADER_METHOD: ":method",
      HTTP2_HEADER_PATH: ":path",
    },
    sensitiveHeaders: Symbol("sensitiveHeaders"),
  };
})();

// --- inspector ---

export const inspector = (() => {
  warnStub("inspector");
  return {
    Session: class {
      connect() {}
      connectToMainThread() {}
      disconnect() {}
      post(_m: string, _p?: unknown, cb?: () => void) {
        if (cb) setTimeout(cb, 0);
      }
      on() {}
    },
    open() {},
    close() {},
    url: () => undefined as string | undefined,
    waitForDebugger() {},
    console: globalThis.console,
  };
})();

// --- rollup ---

function rollupParseAst(code: string, _options?: Record<string, unknown>) {
  // Use acorn as the parser (ESTree-compatible like Rollup's native parser)
  try {
    const acorn = require("acorn");
    if (acorn && acorn.parse) {
      return acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
        allowReturnOutsideFunction: true,
        locations: true,
      });
    }
  } catch {}
  return { type: "Program", body: [], sourceType: "module" };
}

export const rollup_stub = {
  async rollup() {
    return {
      async generate() {
        return { output: [] };
      },
      async write() {
        return { output: [] };
      },
      async close() {},
    };
  },
  watch: () => ({ on() {}, close() {} }),
  VERSION: "4.0.0",
  parseAst: rollupParseAst,
  parseAstAsync: async (code: string, opts?: Record<string, unknown>) =>
    rollupParseAst(code, opts),
};

export const rollup_parseAst_stub = {
  parseAst: rollupParseAst,
  parseAstAsync: async (code: string, opts?: Record<string, unknown>) =>
    rollupParseAst(code, opts),
};

export const rollup_native_stub = {
  parse: rollupParseAst,
  parseAsync: async (code: string, opts?: Record<string, unknown>) =>
    rollupParseAst(code, opts),
};

// --- tls ---

export const tls = (() => {
  warnStub("tls");
  return {
    TLSSocket: class TLSSocket extends EventEmitter {
      authorized = true;
      encrypted = true;
    },
    connect: (_opts: unknown, cb?: () => void) => {
      const s = new EventEmitter();
      if (cb) setTimeout(cb, 0);
      return s;
    },
    createServer: () => ({ listen() {}, close() {}, on() {} }),
    createSecureContext: () => ({}),
    DEFAULT_MIN_VERSION: "TLSv1.2",
    DEFAULT_MAX_VERSION: "TLSv1.3",
    DEFAULT_ECDH_CURVE: "auto",
    rootCertificates: [] as string[],
  };
})();

// --- worker_threads ---

export const worker_threads = (() => {
  warnStub("worker_threads");
  let nextThreadId = 1;

  class WTMessagePort extends EventEmitter {
    #peer: WTMessagePort | null = null;
    #started = false;

    postMessage(value: unknown) {
      if (this.#peer) {
        const target = this.#peer;
        setTimeout(() => target.emit("message", value), 0);
      }
    }
    close() {
      this.#peer = null;
      this.emit("close");
    }
    start() {
      this.#started = true;
    }
    ref() {
      return this;
    }
    unref() {
      return this;
    }

    static createPair(): [WTMessagePort, WTMessagePort] {
      const a = new WTMessagePort();
      const b = new WTMessagePort();
      a.#peer = b;
      b.#peer = a;
      return [a, b];
    }
  }

  class WTMessageChannel {
    port1: WTMessagePort;
    port2: WTMessagePort;
    constructor() {
      [this.port1, this.port2] = WTMessagePort.createPair();
    }
  }

  class Worker extends EventEmitter {
    threadId: number;
    #parentPort: WTMessagePort;
    #childPort: WTMessagePort;

    constructor(_filename: string, _opts?: Record<string, unknown>) {
      super();
      this.threadId = nextThreadId++;
      [this.#parentPort, this.#childPort] = WTMessagePort.createPair();

      this.#parentPort.on("message", (msg: unknown) => {
        this.emit("message", msg);
      });
    }

    postMessage(value: unknown) {
      this.#parentPort.postMessage(value);
    }

    terminate() {
      this.#parentPort.close();
      this.#childPort.close();
      this.emit("exit", 0);
      return Promise.resolve(0);
    }

    ref() {
      return this;
    }
    unref() {
      return this;
    }

    getChildPort(): WTMessagePort {
      return this.#childPort;
    }
  }

  class BroadcastChannel extends EventEmitter {
    name: string;
    constructor(name: string) {
      super();
      this.name = name;
    }
    postMessage() {}
    close() {}
  }

  return {
    isMainThread: true,
    parentPort: null as WTMessagePort | null,
    workerData: null as unknown,
    threadId: 0,
    resourceLimits: {},
    Worker,
    MessageChannel: WTMessageChannel,
    MessagePort: WTMessagePort,
    BroadcastChannel,
    markAsUntransferable() {},
    moveMessagePortToContext: (p: unknown) => p,
    receiveMessageOnPort: () => undefined,
  };
})();
