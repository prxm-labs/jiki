import { Duplex } from "./stream";
import { EventEmitter } from "./events";

export class Socket extends Duplex {
  remoteAddress = "127.0.0.1";
  remotePort = 0;
  localAddress = "127.0.0.1";
  localPort = 0;
  connecting = false;
  destroyed = false;
  timeout = 0;
  allowHalfOpen = false;

  connect(...args: unknown[]): this {
    console.warn(
      "[jiki] net.Socket.connect() is a no-op in browser runtime. TCP connections are not supported.",
    );
    const cb =
      typeof args[args.length - 1] === "function"
        ? (args[args.length - 1] as () => void)
        : undefined;
    if (cb) setTimeout(cb, 0);
    setTimeout(() => this.emit("connect"), 0);
    return this;
  }

  destroy(error?: Error): this {
    this.destroyed = true;
    this.emit("close", !!error);
    return this;
  }
  setTimeout(timeout: number, cb?: () => void): this {
    this.timeout = timeout;
    if (cb) this.once("timeout", cb);
    return this;
  }
  setNoDelay(): this {
    return this;
  }
  setKeepAlive(): this {
    return this;
  }
  ref(): this {
    return this;
  }
  unref(): this {
    return this;
  }
  address(): { port: number; family: string; address: string } {
    return { port: this.localPort, family: "IPv4", address: this.localAddress };
  }
}

export class Server extends EventEmitter {
  listening = false;
  listen(
    port?: number,
    hostOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    this.listening = true;
    const callback = typeof hostOrCb === "function" ? hostOrCb : cb;
    if (callback) setTimeout(callback, 0);
    this.emit("listening");
    return this;
  }
  close(cb?: () => void): this {
    this.listening = false;
    if (cb) setTimeout(cb, 0);
    return this;
  }
  address(): { port: number; family: string; address: string } | null {
    return this.listening
      ? { port: 0, family: "IPv4", address: "0.0.0.0" }
      : null;
  }
  ref(): this {
    return this;
  }
  unref(): this {
    return this;
  }
}

export function createServer(
  _options?: unknown,
  _connectionListener?: unknown,
): Server {
  console.warn(
    "[jiki] net.createServer() is a stub in browser runtime. TCP server is not supported.",
  );
  return new Server();
}
export function createConnection(_options: unknown, cb?: () => void): Socket {
  const s = new Socket();
  if (cb) s.connect({}, cb);
  return s;
}
export function connect(_options: unknown, cb?: () => void): Socket {
  return createConnection(_options, cb);
}
export function isIP(input: string): number {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(input)) return 4;
  if (input.includes(":")) return 6;
  return 0;
}
export function isIPv4(input: string): boolean {
  return isIP(input) === 4;
}
export function isIPv6(input: string): boolean {
  return isIP(input) === 6;
}

export default {
  Socket,
  Server,
  createServer,
  createConnection,
  connect,
  isIP,
  isIPv4,
  isIPv6,
};
