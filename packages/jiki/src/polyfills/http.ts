import { EventEmitter } from "./events";
import { Readable, Writable, BufferImpl } from "./stream";

type ServerListenCallback = (port: number, server: Server) => void;
type ServerCloseCallback = (port: number) => void;

let _onServerListen: ServerListenCallback | null = null;
let _onServerClose: ServerCloseCallback | null = null;

export function setServerListenCallback(cb: ServerListenCallback): void {
  _onServerListen = cb;
}

export function setServerCloseCallback(cb: ServerCloseCallback): void {
  _onServerClose = cb;
}

export function getServer(_port: number): Server | undefined {
  return undefined;
}

export const METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];
export const STATUS_CODES: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export class IncomingMessage extends Readable {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  httpVersion = "1.1";
  statusCode?: number;
  statusMessage?: string;
  socket = { remoteAddress: "127.0.0.1", remotePort: 0, destroy() {} };
  complete = true;
  aborted = false;
  connection = { remoteAddress: "127.0.0.1" };

  rawHeaders: string[] = [];
  trailers: Record<string, string> = {};
  rawTrailers: string[] = [];

  constructor(opts?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  }) {
    super();
    this.method = opts?.method || "GET";
    this.url = opts?.url || "/";
    this.headers = opts?.headers || {};
    // Build rawHeaders from headers
    if (opts?.headers) {
      for (const [key, value] of Object.entries(opts.headers)) {
        this.rawHeaders.push(key, value);
      }
    }
  }

  setTimeout(_ms: number, _cb?: () => void): this {
    if (_cb) setTimeout(_cb, 0);
    return this;
  }
}

export class ServerResponse extends Writable {
  statusCode = 200;
  statusMessage = "";
  headersSent = false;
  finished = false;
  private _headers: Record<string, string | string[]> = {};
  private _body: Uint8Array[] = [];

  setHeader(name: string, value: string | string[]): this {
    this._headers[name.toLowerCase()] = value;
    return this;
  }
  getHeader(name: string): string | string[] | undefined {
    return this._headers[name.toLowerCase()];
  }
  removeHeader(name: string): void {
    delete this._headers[name.toLowerCase()];
  }
  getHeaders(): Record<string, string | string[]> {
    return { ...this._headers };
  }
  hasHeader(name: string): boolean {
    return name.toLowerCase() in this._headers;
  }
  writeHead(
    statusCode: number,
    statusMessage?: string | Record<string, string | string[]>,
    headers?: Record<string, string | string[]>,
  ): this {
    this.statusCode = statusCode;
    if (typeof statusMessage === "string") this.statusMessage = statusMessage;
    const hdrs = typeof statusMessage === "object" ? statusMessage : headers;
    if (hdrs) Object.entries(hdrs).forEach(([k, v]) => this.setHeader(k, v));
    this.headersSent = true;
    return this;
  }

  _write(chunk: unknown, _encoding: string, callback: () => void): void {
    if (typeof chunk === "string")
      this._body.push(new TextEncoder().encode(chunk));
    else if (chunk instanceof Uint8Array) this._body.push(chunk);
    callback();
  }

  end(
    chunkOrCb?: unknown,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    this.finished = true;
    return super.end(chunkOrCb, encodingOrCb as string, cb) as this;
  }

  getBody(): Uint8Array {
    const total = this._body.reduce((s, b) => s + b.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this._body) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }

  getBodyString(): string {
    return new TextDecoder().decode(this.getBody());
  }

  addTrailers(headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      this.setHeader(key, value);
    }
  }

  flushHeaders(): void {
    this.headersSent = true;
  }

  cork(): void {
    /* no-op in browser */
  }
  uncork(): void {
    /* no-op in browser */
  }
}

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

export class Server extends EventEmitter {
  private handler: RequestHandler | null = null;
  private _port = 0;
  listening = false;
  keepAliveTimeout = 5000;
  headersTimeout = 60000;
  requestTimeout = 300000;
  timeout = 0;

  constructor(handler?: RequestHandler) {
    super();
    if (handler) this.handler = handler;
  }

  setTimeout(ms?: number, _cb?: () => void): this {
    this.timeout = ms ?? 0;
    return this;
  }

  listen(
    portOrOpts?: number | Record<string, unknown>,
    hostOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    if (typeof portOrOpts === "object" && portOrOpts !== null) {
      this._port = (portOrOpts.port as number) || 3000;
      const callback =
        typeof portOrOpts.cb === "function"
          ? (portOrOpts.cb as () => void)
          : undefined;
      if (callback) setTimeout(callback, 0);
    } else {
      this._port = portOrOpts || 3000;
      const callback = typeof hostOrCb === "function" ? hostOrCb : cb;
      if (callback) setTimeout(callback, 0);
    }
    this.listening = true;
    this.emit("listening");
    if (_onServerListen) _onServerListen(this._port, this);
    return this;
  }

  close(cb?: () => void): this {
    const port = this._port;
    this.listening = false;
    if (cb) setTimeout(cb, 0);
    this.emit("close");
    if (_onServerClose) _onServerClose(port);
    return this;
  }

  address(): { port: number; family: string; address: string } | null {
    return this.listening
      ? { port: this._port, family: "IPv4", address: "0.0.0.0" }
      : null;
  }

  async handleRequest(
    methodOrReq: string | IncomingMessage,
    urlOrRes?: string | ServerResponse,
    headers?: Record<string, string>,
    body?: BufferImpl | string,
  ): Promise<{
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
    body: BufferImpl;
  }> {
    const handler =
      this.handler || (this.listeners("request")[0] as RequestHandler);
    if (!handler) {
      return {
        statusCode: 503,
        statusMessage: "No Handler",
        headers: {},
        body: BufferImpl.from(""),
      };
    }

    if (
      methodOrReq instanceof IncomingMessage &&
      urlOrRes instanceof ServerResponse
    ) {
      handler(methodOrReq, urlOrRes);
      return {
        statusCode: urlOrRes.statusCode,
        statusMessage: urlOrRes.statusMessage || "OK",
        headers: Object.fromEntries(
          Object.entries(urlOrRes.getHeaders()).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(", ") : String(v),
          ]),
        ),
        body: BufferImpl.from(urlOrRes.getBody()),
      };
    }

    const req = new IncomingMessage({
      method: methodOrReq as string,
      url: urlOrRes as string,
      headers: headers || {},
    });
    if (body) {
      const data =
        typeof body === "string" ? new TextEncoder().encode(body) : body;
      req.push(BufferImpl.from(data));
      req.push(null);
    } else {
      req.push(null);
    }

    const res = new ServerResponse();
    await new Promise<void>(resolve => {
      res.on("finish", resolve);
      handler(req, res);
      if (res.finished) resolve();
    });

    return {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage || "OK",
      headers: Object.fromEntries(
        Object.entries(res.getHeaders()).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(", ") : String(v),
        ]),
      ),
      body: BufferImpl.from(res.getBody()),
    };
  }
}

export function createServer(handler?: RequestHandler): Server {
  return new Server(handler);
}

export class ClientRequest extends Writable {
  method: string;
  path: string;
  private _headers: Record<string, string> = {};
  private _body: Uint8Array[] = [];
  private _url: string;

  constructor(
    options:
      | string
      | {
          hostname?: string;
          host?: string;
          port?: number;
          path?: string;
          method?: string;
          headers?: Record<string, string>;
          protocol?: string;
        },
  ) {
    super();
    const opts = typeof options === "string" ? new URL(options) : options;
    const hostname =
      ("hostname" in opts ? opts.hostname : "") ||
      ("host" in opts ? opts.host : "") ||
      "localhost";
    const port = ("port" in opts ? opts.port : undefined) || "";
    const protocol = ("protocol" in opts ? opts.protocol : "http:") || "http:";
    this.path =
      ("pathname" in opts ? opts.pathname : "") ||
      ("path" in opts ? opts.path : "") ||
      "/";
    this.method = ("method" in opts ? opts.method : "") || "GET";
    if ("headers" in opts && opts.headers)
      this._headers = opts.headers as Record<string, string>;
    this._url = `${protocol}//${hostname}${port ? ":" + port : ""}${this.path}`;
  }

  aborted = false;

  setHeader(name: string, value: string): void {
    this._headers[name] = value;
  }
  getHeader(name: string): string | undefined {
    return this._headers[name];
  }
  removeHeader(name: string): void {
    delete this._headers[name];
  }

  abort(): void {
    this.aborted = true;
    this.emit("abort");
  }

  setTimeout(_ms: number, _cb?: () => void): this {
    if (_cb) setTimeout(_cb, 0);
    return this;
  }

  override destroy(error?: Error): this {
    this.aborted = true;
    if (error) this.emit("error", error);
    this.emit("close");
    return this;
  }

  _write(chunk: unknown, _encoding: string, callback: () => void): void {
    if (typeof chunk === "string")
      this._body.push(new TextEncoder().encode(chunk));
    else if (chunk instanceof Uint8Array) this._body.push(chunk);
    callback();
  }

  end(
    chunkOrCb?: unknown,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    if (typeof chunkOrCb === "string" || chunkOrCb instanceof Uint8Array) {
      this._write(chunkOrCb, "utf8", () => {});
    }
    const callback =
      typeof chunkOrCb === "function"
        ? chunkOrCb
        : typeof encodingOrCb === "function"
          ? encodingOrCb
          : cb;

    const body =
      this._body.length > 0 ? BufferImpl.concat(this._body) : undefined;
    fetch(this._url, {
      method: this.method,
      headers: this._headers,
      body: this.method !== "GET" && this.method !== "HEAD" ? body : undefined,
    })
      .then(async response => {
        const incoming = new IncomingMessage();
        incoming.statusCode = response.status;
        incoming.statusMessage = response.statusText;
        const hdrs: Record<string, string> = {};
        response.headers.forEach((v, k) => {
          hdrs[k] = v;
        });
        incoming.headers = hdrs;
        const data = new Uint8Array(await response.arrayBuffer());
        incoming.push(BufferImpl.from(data));
        incoming.push(null);
        this.emit("response", incoming);
      })
      .catch(err => this.emit("error", err));

    if (typeof callback === "function") setTimeout(callback, 0);
    return this;
  }
}

export function request(
  options: unknown,
  cb?: (res: IncomingMessage) => void,
): ClientRequest {
  const req = new ClientRequest(options as string);
  if (cb) req.on("response", cb);
  return req;
}

export function get(
  options: unknown,
  cb?: (res: IncomingMessage) => void,
): ClientRequest {
  const req = request(options, cb);
  req.end();
  return req;
}

export const Agent = class Agent {
  constructor(_opts?: unknown) {}
};
export const globalAgent = new Agent();

export default {
  METHODS,
  STATUS_CODES,
  IncomingMessage,
  ServerResponse,
  Server,
  ClientRequest,
  createServer,
  request,
  get,
  Agent,
  globalAgent,
  setServerListenCallback,
  setServerCloseCallback,
  getServer,
};

export const httpsModule = {
  createServer,
  request,
  get,
  Server,
  Agent,
  globalAgent,
  IncomingMessage,
  ServerResponse,
  ClientRequest,
};
