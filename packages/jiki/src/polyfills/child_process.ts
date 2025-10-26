import { EventEmitter } from "./events";
import type { MemFS } from "../memfs";

let _vfs: MemFS | null = null;
let _runtimeFactory:
  | ((vfs: MemFS, options?: Record<string, unknown>) => KernelLike)
  | null = null;

interface KernelLike {
  runFile: (path: string) => unknown;
  getProcess: () => ProcessLike;
}

interface ProcessLike {
  argv: string[];
  exit: (code?: number) => never;
  connected?: boolean;
  send?: (
    message: unknown,
    callback?: (error: Error | null) => void,
  ) => boolean;
  stdout: {
    isTTY?: boolean;
    emit: (event: string, ...args: unknown[]) => void;
  };
  stderr: {
    isTTY?: boolean;
    emit: (event: string, ...args: unknown[]) => void;
  };
  stdin: {
    isTTY?: boolean;
    setRawMode?: (mode: boolean) => unknown;
    emit: (event: string, ...args: unknown[]) => void;
  };
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  once: (event: string, listener: (...args: unknown[]) => void) => unknown;
  emit: (event: string, ...args: unknown[]) => boolean;
  listeners: (event: string) => ((...args: unknown[]) => void)[];
}

// Patch Object.defineProperty to force configurable: true on globalThis properties.
// Only applied in browser environments where all forks share globalThis.
// Libraries like vitest define non-configurable properties (e.g. __vitest_index__)
// that need to be configurable for re-runs in our shared-global environment.
let _definePropertyPatched = false;
export function patchDefineProperty(): void {
  if (_definePropertyPatched) return;
  _definePropertyPatched = true;
  const _realDefineProperty = Object.defineProperty;
  Object.defineProperty = function (
    target: object,
    key: PropertyKey,
    descriptor: PropertyDescriptor,
  ): object {
    if (target === globalThis && descriptor && !descriptor.configurable) {
      descriptor = { ...descriptor, configurable: true };
    }
    return _realDefineProperty.call(Object, target, key, descriptor) as object;
  } as typeof Object.defineProperty;
}

let _activeForkedChildren = 0;
let _onForkedChildExit: (() => void) | null = null;

export function getActiveForkedChildren(): number {
  return _activeForkedChildren;
}
export function setOnForkedChildExit(
  cb: (() => void) | null,
): (() => void) | null {
  const prev = _onForkedChildExit;
  _onForkedChildExit = cb;
  return prev;
}

// Streaming callbacks for long-running commands (e.g. vitest watch)
let _streamStdout: ((data: string) => void) | null = null;
let _streamStderr: ((data: string) => void) | null = null;
let _abortSignal: AbortSignal | null = null;

export function setStreamingCallbacks(opts: {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  signal?: AbortSignal;
}): void {
  _streamStdout = opts.onStdout || null;
  _streamStderr = opts.onStderr || null;
  _abortSignal = opts.signal || null;
}

export function clearStreamingCallbacks(): void {
  _streamStdout = null;
  _streamStderr = null;
  _abortSignal = null;
}

export function getStreamingState() {
  return {
    streamStdout: _streamStdout,
    streamStderr: _streamStderr,
    abortSignal: _abortSignal,
  };
}

// Reference to stdin of the currently running node process for interactive input
let _activeProcessStdin: {
  emit: (event: string, ...args: unknown[]) => void;
} | null = null;

export function sendStdin(data: string): void {
  if (_activeProcessStdin) {
    _activeProcessStdin.emit("data", data);
    for (const ch of data) {
      _activeProcessStdin.emit("keypress", ch, {
        sequence: ch,
        name: ch,
        ctrl: false,
        meta: false,
        shift: false,
      });
    }
  }
}

export function setActiveProcessStdin(
  stdin: { emit: (event: string, ...args: unknown[]) => void } | null,
): void {
  _activeProcessStdin = stdin;
}

export function initChildProcess(
  vfs: MemFS,
  runtimeFactory?: (
    vfs: MemFS,
    options?: Record<string, unknown>,
  ) => KernelLike,
): void {
  _vfs = vfs;
  if (runtimeFactory) _runtimeFactory = runtimeFactory;
}

export class ChildProcess extends EventEmitter {
  pid: number;
  exitCode: number | null = null;
  signalCode: string | null = null;
  killed = false;
  connected = false;
  spawnargs: string[] = [];
  spawnfile = "";

  stdout: EventEmitter | null;
  stderr: EventEmitter | null;
  stdin: EventEmitter | null;

  constructor() {
    super();
    this.pid = Math.floor(Math.random() * 10000) + 1000;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = new EventEmitter();
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this.connected = false;
    this.emit("exit", null, signal || "SIGTERM");
    this.emit("close", null, signal || "SIGTERM");
    return true;
  }

  send(message: unknown, _cb?: (error: Error | null) => void): boolean {
    return true;
  }

  disconnect(): void {
    this.connected = false;
    this.emit("disconnect");
  }

  ref(): this {
    return this;
  }
  unref(): this {
    return this;
  }
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export function exec(
  command: string,
  optionsOrCb?: unknown | ((err: Error | null, result?: ExecResult) => void),
  cb?: (err: Error | null, result?: ExecResult) => void,
): ChildProcess {
  const callback =
    typeof optionsOrCb === "function"
      ? (optionsOrCb as (err: Error | null, result?: ExecResult) => void)
      : cb;
  const child = new ChildProcess();

  setTimeout(() => {
    const stdout = `Executed: ${command}`;
    child.stdout?.emit("data", stdout);
    child.stdout?.emit("end");
    child.stderr?.emit("end");
    child.exitCode = 0;
    child.emit("close", 0);
    child.emit("exit", 0);
    if (callback) callback(null, { stdout, stderr: "" });
  }, 0);

  return child;
}

export function execSync(command: string, _options?: unknown): string {
  return `Executed: ${command}`;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?:
    | "pipe"
    | "inherit"
    | "ignore"
    | Array<"pipe" | "inherit" | "ignore" | "ipc" | null>;
  shell?: boolean | string;
  detached?: boolean;
  uid?: number;
  gid?: number;
  timeout?: number;
  signal?: AbortSignal;
}

export function spawn(
  command: string,
  args: string[] = [],
  options?: SpawnOptions | unknown,
): ChildProcess {
  const child = new ChildProcess();
  const opts =
    options && typeof options === "object"
      ? (options as SpawnOptions)
      : undefined;

  // Handle stdio configuration
  if (opts?.stdio) {
    const stdioConfig =
      typeof opts.stdio === "string"
        ? [opts.stdio, opts.stdio, opts.stdio]
        : opts.stdio;

    // stdin (index 0)
    if (stdioConfig[0] === "ignore") {
      child.stdin = null;
    }
    // stdout (index 1)
    if (stdioConfig[1] === "ignore") {
      child.stdout = null;
    }
    // stderr (index 2)
    if (stdioConfig[2] === "ignore") {
      child.stderr = null;
    }

    // IPC channel stub (index 3 === 'ipc')
    if (stdioConfig.length > 3 && stdioConfig[3] === "ipc") {
      child.connected = true;
    }
  }

  // Handle shell option — wrap command for shell execution
  if (opts?.shell) {
    child.spawnfile = typeof opts.shell === "string" ? opts.shell : "/bin/sh";
    child.spawnargs = [
      child.spawnfile,
      "-c",
      `${command} ${args.join(" ")}`.trim(),
    ];
  } else {
    child.spawnfile = command;
    child.spawnargs = [command, ...args];
  }

  setTimeout(() => {
    child.emit("close", 0);
    child.emit("exit", 0);
  }, 0);
  return child;
}

export function execFile(
  file: string,
  args: string[] = [],
  optionsOrCb?: unknown,
  cb?: (err: Error | null, stdout?: string, stderr?: string) => void,
): ChildProcess {
  const callback =
    typeof optionsOrCb === "function"
      ? (optionsOrCb as (
          err: Error | null,
          stdout?: string,
          stderr?: string,
        ) => void)
      : cb;
  return exec(
    `${file} ${args.join(" ")}`,
    {},
    callback
      ? (err, result) => callback(err, result?.stdout, result?.stderr)
      : undefined,
  );
}

export function execFileSync(
  file: string,
  args: string[] = [],
  _options?: unknown,
): string {
  return execSync(`${file} ${args.join(" ")}`, _options);
}

export function spawnSync(
  command: string,
  args: string[] = [],
  _options?: unknown,
): { stdout: string; stderr: string; status: number } {
  return {
    stdout: `Executed: ${command} ${args.join(" ")}`,
    stderr: "",
    status: 0,
  };
}

/**
 * Fork — runs a Node.js module in a simulated child process using a new Kernel.
 * Creates bidirectional IPC between parent and child, with serialized message delivery.
 */
export function fork(
  modulePath: string,
  argsOrOptions?: string[] | Record<string, unknown>,
  options?: Record<string, unknown>,
): ChildProcess {
  if (!_vfs) {
    throw new Error("VFS not initialized");
  }

  let args: string[] = [];
  let opts: Record<string, unknown> = {};
  if (Array.isArray(argsOrOptions)) {
    args = argsOrOptions;
    opts = options || {};
  } else if (argsOrOptions) {
    opts = argsOrOptions;
  }

  const cwd = (opts.cwd as string) || "/";
  const env = (opts.env as Record<string, string>) || {};
  const execArgv = (opts.execArgv as string[]) || [];

  const resolvedPath = modulePath.startsWith("/")
    ? modulePath
    : `${cwd}/${modulePath}`.replace(/\/+/g, "/");

  const child = new ChildProcess();
  child.connected = true;
  child.spawnargs = ["node", ...execArgv, resolvedPath, ...args];
  child.spawnfile = "node";

  if (!_runtimeFactory) {
    setTimeout(() => {
      child.emit("close", 0);
      child.emit("exit", 0);
    }, 0);
    return child;
  }

  const childRuntime = _runtimeFactory(_vfs!, {
    cwd,
    env,
    onConsole: (method: string, consoleArgs: unknown[]) => {
      const msg = consoleArgs.map(a => String(a)).join(" ");
      if (method === "error" || method === "warn") {
        child.stderr?.emit("data", msg + "\n");
      } else {
        child.stdout?.emit("data", msg + "\n");
      }
    },
    onStdout: (data: string) => {
      child.stdout?.emit("data", data);
    },
    onStderr: (data: string) => {
      child.stderr?.emit("data", data);
    },
  });

  const childProc = childRuntime.getProcess();
  childProc.argv = ["node", resolvedPath, ...args];

  // Clone IPC messages to mimic real Node.js IPC behavior.
  // Real IPC serializes messages across process boundaries.
  // Without cloning, shared object references cause corruption.
  const cloneIpcMessage = (msg: unknown): unknown => {
    try {
      return structuredClone(msg);
    } catch {
      return msg;
    }
  };

  // Parent sends -> child process receives
  child.send = (
    message: unknown,
    _callback?: (error: Error | null) => void,
  ): boolean => {
    if (!child.connected) return false;
    const cloned = cloneIpcMessage(message);
    setTimeout(() => {
      childProc.emit("message", cloned);
    }, 0);
    return true;
  };

  // Child sends -> parent ChildProcess receives (serialized + awaited)
  // We must serialize AND await async handlers so birpc's async onCollected
  // finishes before onTaskUpdate starts.
  let ipcQueue: Promise<void> = Promise.resolve();
  childProc.send = ((
    message: unknown,
    _callback?: (error: Error | null) => void,
  ): boolean => {
    if (!child.connected) return false;
    const cloned = cloneIpcMessage(message);
    ipcQueue = ipcQueue.then(async () => {
      const listeners = child.listeners("message");
      for (const listener of listeners) {
        try {
          const result = (listener as (...args: unknown[]) => unknown)(cloned);
          if (
            result &&
            typeof (result as Promise<unknown>).then === "function"
          ) {
            await result;
          }
        } catch {
          // Handler errors propagate through the test runner's own error handling
        }
      }
    });
    return true;
  }) as any;
  childProc.connected = true;

  _activeForkedChildren++;

  const notifyChildExit = () => {
    _activeForkedChildren--;
    _onForkedChildExit?.();
  };

  // Override child's process.exit
  childProc.exit = ((code = 0) => {
    child.exitCode = code;
    child.connected = false;
    childProc.connected = false;
    childProc.emit("exit", code);
    child.emit("exit", code, null);
    child.emit("close", code, null);
    notifyChildExit();
  }) as (code?: number) => never;

  // Override child's kill to disconnect
  child.kill = (signal?: string): boolean => {
    child.killed = true;
    child.connected = false;
    childProc.connected = false;
    childProc.emit("exit", null, signal || "SIGTERM");
    child.emit("exit", null, signal || "SIGTERM");
    child.emit("close", null, signal || "SIGTERM");
    notifyChildExit();
    return true;
  };

  child.disconnect = (): void => {
    child.connected = false;
    childProc.connected = false;
    child.emit("disconnect");
  };

  // Run the module asynchronously
  setTimeout(() => {
    try {
      childRuntime.runFile(resolvedPath);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Process exited with code")
      ) {
        return;
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      child.stderr?.emit("data", `Error in forked process: ${errorMsg}\n`);
      child.exitCode = 1;
      child.emit("error", error);
      child.emit("exit", 1, null);
      child.emit("close", 1, null);
      notifyChildExit();
    }
  }, 0);

  return child;
}

export default {
  ChildProcess,
  exec,
  execSync,
  spawn,
  execFile,
  execFileSync,
  fork,
  spawnSync,
  initChildProcess,
  setStreamingCallbacks,
  clearStreamingCallbacks,
  sendStdin,
  setActiveProcessStdin,
  getStreamingState,
  getActiveForkedChildren,
  setOnForkedChildExit,
  patchDefineProperty,
};
