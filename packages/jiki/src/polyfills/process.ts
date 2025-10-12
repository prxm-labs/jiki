import { EventEmitter, EventListener } from "./events";

export interface ProcessEnv {
  [key: string]: string | undefined;
}

interface ProcessStream {
  isTTY: boolean;
  on: (event: string, listener: EventListener) => ProcessStream;
  once: (event: string, listener: EventListener) => ProcessStream;
  off: (event: string, listener: EventListener) => ProcessStream;
  emit: (event: string, ...args: unknown[]) => boolean;
  addListener: (event: string, listener: EventListener) => ProcessStream;
  removeListener: (event: string, listener: EventListener) => ProcessStream;
  removeAllListeners: (event?: string) => ProcessStream;
  setMaxListeners: (n: number) => ProcessStream;
  getMaxListeners: () => number;
  listenerCount: (event: string) => number;
  listeners: (event: string) => EventListener[];
  rawListeners: (event: string) => EventListener[];
  prependListener: (event: string, listener: EventListener) => ProcessStream;
  prependOnceListener: (
    event: string,
    listener: EventListener,
  ) => ProcessStream;
  eventNames: () => string[];
  pause?: () => ProcessStream;
  resume?: () => ProcessStream;
  setEncoding?: (encoding: string) => ProcessStream;
}

interface ProcessWritableStream extends ProcessStream {
  write: (
    data: string | Buffer,
    encoding?: string,
    callback?: () => void,
  ) => boolean;
  end?: (data?: string, callback?: () => void) => void;
}

interface ProcessReadableStream extends ProcessStream {
  read?: (size?: number) => string | Buffer | null;
  setRawMode?: (mode: boolean) => ProcessReadableStream;
}

export interface Process {
  env: ProcessEnv;
  cwd: () => string;
  chdir: (directory: string) => void;
  platform: string;
  arch: string;
  version: string;
  versions: { node: string; v8: string; uv: string };
  argv: string[];
  argv0: string;
  execPath: string;
  execArgv: string[];
  pid: number;
  ppid: number;
  exit: (code?: number) => never;
  nextTick: (
    callback: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => void;
  stdout: ProcessWritableStream;
  stderr: ProcessWritableStream;
  stdin: ProcessReadableStream;
  hrtime: { (time?: [number, number]): [number, number]; bigint: () => bigint };
  memoryUsage: () => {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  uptime: () => number;
  cpuUsage: () => { user: number; system: number };
  on: (event: string, listener: EventListener) => Process;
  once: (event: string, listener: EventListener) => Process;
  off: (event: string, listener: EventListener) => Process;
  emit: (event: string, ...args: unknown[]) => boolean;
  addListener: (event: string, listener: EventListener) => Process;
  removeListener: (event: string, listener: EventListener) => Process;
  removeAllListeners: (event?: string) => Process;
  listeners: (event: string) => EventListener[];
  listenerCount: (event: string) => number;
  prependListener: (event: string, listener: EventListener) => Process;
  prependOnceListener: (event: string, listener: EventListener) => Process;
  eventNames: () => string[];
  setMaxListeners: (n: number) => Process;
  getMaxListeners: () => number;
  send?: (
    message: unknown,
    callback?: (error: Error | null) => void,
  ) => boolean;
  connected?: boolean;
  _cwdCallCount?: number;
}

function createProcessStream(
  isWritable: boolean,
  writeImpl?: (data: string) => boolean,
): ProcessWritableStream & ProcessReadableStream {
  const emitter = new EventEmitter();
  const stream: ProcessWritableStream & ProcessReadableStream = {
    isTTY: false,
    on(event, listener) {
      emitter.on(event, listener);
      return stream;
    },
    once(event, listener) {
      emitter.once(event, listener);
      return stream;
    },
    off(event, listener) {
      emitter.off(event, listener);
      return stream;
    },
    emit(event, ...args) {
      return emitter.emit(event, ...args);
    },
    addListener(event, listener) {
      emitter.addListener(event, listener);
      return stream;
    },
    removeListener(event, listener) {
      emitter.removeListener(event, listener);
      return stream;
    },
    removeAllListeners(event?) {
      emitter.removeAllListeners(event);
      return stream;
    },
    setMaxListeners(n) {
      emitter.setMaxListeners(n);
      return stream;
    },
    getMaxListeners() {
      return emitter.getMaxListeners();
    },
    listenerCount(event) {
      return emitter.listenerCount(event);
    },
    listeners(event) {
      return emitter.listeners(event);
    },
    rawListeners(event) {
      return emitter.rawListeners(event);
    },
    prependListener(event, listener) {
      emitter.prependListener(event, listener);
      return stream;
    },
    prependOnceListener(event, listener) {
      emitter.prependOnceListener(event, listener);
      return stream;
    },
    eventNames() {
      return emitter.eventNames();
    },
    pause() {
      return stream;
    },
    resume() {
      return stream;
    },
    setEncoding() {
      return stream;
    },
    write(data, _encoding?, callback?) {
      if (callback) queueMicrotask(callback);
      return true;
    },
    end(_data?, callback?) {
      if (callback) queueMicrotask(callback);
    },
    read() {
      return null;
    },
    setRawMode() {
      return stream;
    },
  };
  if (isWritable && writeImpl) {
    stream.write = (data, _encoding?, callback?) => {
      const result = writeImpl(
        typeof data === "string" ? data : data.toString(),
      );
      if (callback) queueMicrotask(callback);
      return result;
    };
  }
  return stream;
}

export function createProcess(options?: {
  cwd?: string;
  env?: ProcessEnv;
  onExit?: (code: number) => void;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}): Process {
  let currentDir = options?.cwd || "/";
  const env: ProcessEnv = {
    NODE_ENV: "development",
    PATH: "/usr/local/bin:/usr/bin:/bin:/node_modules/.bin",
    HOME: "/",
    ...options?.env,
  };
  const emitter = new EventEmitter();
  const startTime = Date.now();

  const proc: Process = {
    env,
    cwd() {
      return currentDir;
    },
    chdir(dir) {
      currentDir = dir.startsWith("/") ? dir : currentDir + "/" + dir;
    },
    platform: "linux",
    /** Set to 'wasm32' to indicate browser-based WebAssembly runtime */
    arch: "wasm32",
    version: "v20.0.0",
    versions: { node: "20.0.0", v8: "11.3.244.8", uv: "1.44.2" },
    argv: ["node", "/index.js"],
    argv0: "node",
    execPath: "/usr/local/bin/node",
    execArgv: [],
    pid: 1,
    ppid: 0,
    // process.exit() emits 'beforeExit' and 'exit' events before throwing
    // to halt execution. In a real Node.js process, 'beforeExit' fires when
    // the event loop drains. In the browser runtime, we emit it synchronously
    // before 'exit' as a best-effort approximation. The throw after events
    // is intentional — it stops execution in the browser environment where
    // we cannot actually terminate the process.
    exit(code = 0) {
      if (!(proc as any)._exiting) {
        (proc as any)._exiting = true;
        emitter.emit("beforeExit", code);
        emitter.emit("exit", code);
        options?.onExit?.(code);
      }
      throw new Error(`Process exited with code ${code}`);
    },
    nextTick(cb, ...args) {
      queueMicrotask(() => cb(...args));
    },
    stdout: createProcessStream(true, d => {
      options?.onStdout?.(d) ?? console.log(d);
      return true;
    }) as ProcessWritableStream,
    stderr: createProcessStream(true, d => {
      options?.onStderr?.(d) ?? console.error(d);
      return true;
    }) as ProcessWritableStream,
    stdin: Object.assign(createProcessStream(false), {
      /** Buffer for pending input data. */
      _buffer: [] as string[],
      /** Push data into stdin (called by Container.sendInput). */
      _push(data: string): void {
        (proc.stdin as any)._buffer.push(data);
        proc.stdin.emit("data", data);
      },
      read(): string | null {
        const buf = (proc.stdin as any)._buffer;
        return buf.length > 0 ? buf.shift() : null;
      },
    }) as ProcessReadableStream,
    hrtime: Object.assign(
      function hrtime(time?: [number, number]): [number, number] {
        const now = performance.now();
        const s = Math.floor(now / 1000);
        const ns = Math.floor((now % 1000) * 1e6);
        if (time) return [s - time[0], ns - time[1]];
        return [s, ns];
      },
      { bigint: (): bigint => BigInt(Math.floor(performance.now() * 1e6)) },
    ),
    connected: false,
    send: (_message: unknown, _callback?: (error: Error | null) => void) =>
      false,
    memoryUsage: () => ({
      rss: 50 * 1024 * 1024,
      heapTotal: 30 * 1024 * 1024,
      heapUsed: 20 * 1024 * 1024,
      external: 1024 * 1024,
      arrayBuffers: 0,
    }),
    uptime: () => (Date.now() - startTime) / 1000,
    cpuUsage: () => ({ user: 0, system: 0 }),
    on(event, listener) {
      emitter.on(event, listener);
      return proc;
    },
    once(event, listener) {
      emitter.once(event, listener);
      return proc;
    },
    off(event, listener) {
      emitter.off(event, listener);
      return proc;
    },
    emit(event, ...args) {
      return emitter.emit(event, ...args);
    },
    addListener(event, listener) {
      emitter.addListener(event, listener);
      return proc;
    },
    removeListener(event, listener) {
      emitter.removeListener(event, listener);
      return proc;
    },
    removeAllListeners(event?) {
      emitter.removeAllListeners(event);
      return proc;
    },
    listeners(event) {
      return emitter.listeners(event);
    },
    listenerCount(event) {
      return emitter.listenerCount(event);
    },
    prependListener(event, listener) {
      emitter.prependListener(event, listener);
      return proc;
    },
    prependOnceListener(event, listener) {
      emitter.prependOnceListener(event, listener);
      return proc;
    },
    eventNames() {
      return emitter.eventNames();
    },
    setMaxListeners(n) {
      emitter.setMaxListeners(n);
      return proc;
    },
    getMaxListeners() {
      return emitter.getMaxListeners();
    },
  };
  return proc;
}

export const process = createProcess();
export default process;
