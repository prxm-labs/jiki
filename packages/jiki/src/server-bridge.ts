/**
 * Server Bridge
 * Connects Service Worker requests to virtual HTTP servers running in-memory.
 * Provides the illusion of real HTTP by intercepting /__virtual__/{port}/* URLs.
 */

import { EventEmitter } from "./polyfills/events";
import { BufferImpl as Buffer } from "./polyfills/stream";
import { uint8ToBase64 } from "./utils/binary-encoding";
import type { ResponseData } from "./dev-server";

const _encoder = new TextEncoder();

export interface IVirtualServer {
  handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer | string,
  ): Promise<ResponseData>;
  handleStreamingRequest?(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: Buffer | undefined,
    onStart: (
      statusCode: number,
      statusMessage: string,
      headers: Record<string, string>,
    ) => void,
    onChunk: (chunk: string | Uint8Array) => void,
    onEnd: () => void,
  ): Promise<void>;
}

export interface VirtualServer {
  server: IVirtualServer;
  port: number;
  hostname: string;
}

export interface BridgeOptions {
  baseUrl?: string;
  onServerReady?: (port: number, url: string) => void;
}

export interface InitServiceWorkerOptions {
  swUrl?: string;
}

/** A queued request waiting for a server to become available on a port. */
interface QueuedRequest {
  port: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  resolve: (response: ResponseData) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ServerBridge extends EventEmitter {
  static DEBUG = false;
  /** Maximum time (ms) a queued request will wait for a server to become available. */
  static REQUEST_QUEUE_TIMEOUT = 10_000;
  private servers: Map<number, VirtualServer> = new Map();
  private baseUrl: string;
  private options: BridgeOptions;
  private messageChannel: MessageChannel | null = null;
  private serviceWorkerReady = false;
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  /** Requests queued while waiting for a server to register on a given port. */
  private requestQueue: QueuedRequest[] = [];

  constructor(options: BridgeOptions = {}) {
    super();
    this.options = options;

    if (typeof location !== "undefined") {
      this.baseUrl =
        options.baseUrl || `${location.protocol}//${location.host}`;
    } else {
      this.baseUrl = options.baseUrl || "http://localhost";
    }
  }

  registerServer(
    server: IVirtualServer,
    port: number,
    hostname = "0.0.0.0",
  ): void {
    this.servers.set(port, { server, port, hostname });

    const url = this.getServerUrl(port);
    this.emit("server-ready", port, url);
    this.options.onServerReady?.(port, url);

    this.notifyServiceWorker("server-registered", { port, hostname });

    // Drain queued requests waiting for this port
    this.drainQueue(port);
  }

  /**
   * Process any queued requests waiting for a server on the given port.
   */
  private drainQueue(port: number): void {
    const pending = this.requestQueue.filter(q => q.port === port);
    this.requestQueue = this.requestQueue.filter(q => q.port !== port);

    for (const req of pending) {
      clearTimeout(req.timer);
      this.handleRequest(req.port, req.method, req.url, req.headers, req.body)
        .then(req.resolve)
        .catch(req.reject);
    }
  }

  unregisterServer(port: number): void {
    this.servers.delete(port);
    this.notifyServiceWorker("server-unregistered", { port });
  }

  getServerUrl(port: number): string {
    return `${this.baseUrl}/__virtual__/${port}`;
  }

  getServerPorts(): number[] {
    return [...this.servers.keys()];
  }

  async handleRequest(
    port: number,
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: ArrayBuffer,
  ): Promise<ResponseData> {
    const entry = this.servers.get(port);
    if (!entry) {
      // Queue the request and wait for a server to register on this port
      return new Promise<ResponseData>((resolve, reject) => {
        const timer = setTimeout(() => {
          // Remove from queue on timeout
          this.requestQueue = this.requestQueue.filter(q => q !== queued);
          resolve({
            statusCode: 503,
            statusMessage: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
            body: Buffer.from(
              `No server listening on port ${port} (timed out after ${ServerBridge.REQUEST_QUEUE_TIMEOUT}ms)`,
            ),
          });
        }, ServerBridge.REQUEST_QUEUE_TIMEOUT);

        const queued: QueuedRequest = {
          port,
          method,
          url,
          headers,
          body,
          resolve,
          reject,
          timer,
        };
        this.requestQueue.push(queued);
      });
    }

    try {
      const bodyBuffer = body ? Buffer.from(new Uint8Array(body)) : undefined;
      return await entry.server.handleRequest(method, url, headers, bodyBuffer);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Internal Server Error";
      return {
        statusCode: 500,
        statusMessage: "Internal Server Error",
        headers: { "Content-Type": "text/plain" },
        body: Buffer.from(msg),
      };
    }
  }

  async initServiceWorker(options?: InitServiceWorkerOptions): Promise<void> {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      throw new Error("Service Workers not supported");
    }

    const swUrl = options?.swUrl ?? "/__sw__.js";

    const controllerReady = navigator.serviceWorker.controller
      ? Promise.resolve()
      : new Promise<void>(resolve => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          );
        });

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
    });

    const sw =
      registration.active || registration.waiting || registration.installing;
    if (!sw) throw new Error("Service Worker registration failed");

    await new Promise<void>(resolve => {
      if (sw.state === "activated") {
        resolve();
      } else {
        const handler = () => {
          if (sw.state === "activated") {
            sw.removeEventListener("statechange", handler);
            resolve();
          }
        };
        sw.addEventListener("statechange", handler);
      }
    });

    this.messageChannel = new MessageChannel();
    this.messageChannel.port1.onmessage =
      this.handleServiceWorkerMessage.bind(this);

    sw.postMessage({ type: "init", port: this.messageChannel.port2 }, [
      this.messageChannel.port2,
    ]);

    await controllerReady;

    const reinit = () => {
      if (navigator.serviceWorker.controller) {
        this.messageChannel = new MessageChannel();
        this.messageChannel.port1.onmessage =
          this.handleServiceWorkerMessage.bind(this);
        navigator.serviceWorker.controller.postMessage(
          { type: "init", port: this.messageChannel.port2 },
          [this.messageChannel.port2],
        );
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", reinit);
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "sw-needs-init") reinit();
    });

    this.keepaliveInterval = setInterval(() => {
      this.messageChannel?.port1.postMessage({ type: "keepalive" });
    }, 20_000);

    this.serviceWorkerReady = true;
    this.emit("sw-ready");
  }

  private async handleServiceWorkerMessage(event: MessageEvent): Promise<void> {
    const { type, id, data } = event.data;

    if (type === "request") {
      const { port, method, url, headers, body, streaming } = data;
      try {
        if (streaming) {
          await this.handleStreamingBridge(
            id,
            port,
            method,
            url,
            headers,
            body,
          );
        } else {
          const response = await this.handleRequest(
            port,
            method,
            url,
            headers,
            body,
          );
          let bodyBase64 = "";
          if (response.body && response.body.length > 0) {
            const bytes =
              response.body instanceof Uint8Array
                ? response.body
                : new Uint8Array(0);
            bodyBase64 = uint8ToBase64(bytes);
          }
          this.messageChannel?.port1.postMessage({
            type: "response",
            id,
            data: {
              statusCode: response.statusCode,
              statusMessage: response.statusMessage,
              headers: response.headers,
              bodyBase64,
            },
          });
        }
      } catch (error) {
        this.messageChannel?.port1.postMessage({
          type: "response",
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  private async handleStreamingBridge(
    id: number,
    port: number,
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: ArrayBuffer,
  ): Promise<void> {
    const entry = this.servers.get(port);
    if (!entry) {
      this.messageChannel?.port1.postMessage({
        type: "stream-start",
        id,
        data: {
          statusCode: 503,
          statusMessage: "Service Unavailable",
          headers: {},
        },
      });
      this.messageChannel?.port1.postMessage({ type: "stream-end", id });
      return;
    }

    const bodyBuffer = body ? Buffer.from(new Uint8Array(body)) : undefined;

    if (typeof entry.server.handleStreamingRequest === "function") {
      await entry.server.handleStreamingRequest(
        method,
        url,
        headers,
        bodyBuffer,
        (statusCode, statusMessage, respHeaders) => {
          this.messageChannel?.port1.postMessage({
            type: "stream-start",
            id,
            data: { statusCode, statusMessage, headers: respHeaders },
          });
        },
        chunk => {
          const bytes =
            typeof chunk === "string" ? _encoder.encode(chunk) : chunk;
          this.messageChannel?.port1.postMessage({
            type: "stream-chunk",
            id,
            data: { chunkBase64: uint8ToBase64(bytes) },
          });
        },
        () => {
          this.messageChannel?.port1.postMessage({
            type: "stream-end",
            id,
          });
        },
      );
    } else {
      const response = await entry.server.handleRequest(
        method,
        url,
        headers,
        bodyBuffer,
      );
      this.messageChannel?.port1.postMessage({
        type: "stream-start",
        id,
        data: {
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          headers: response.headers,
        },
      });
      if (response.body && response.body.length > 0) {
        const bytes =
          response.body instanceof Uint8Array
            ? response.body
            : new Uint8Array(0);
        this.messageChannel?.port1.postMessage({
          type: "stream-chunk",
          id,
          data: { chunkBase64: uint8ToBase64(bytes) },
        });
      }
      this.messageChannel?.port1.postMessage({ type: "stream-end", id });
    }
  }

  createFetchHandler(): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const match = url.pathname.match(/^\/__virtual__\/(\d+)(\/.*)?$/);
      if (!match) throw new Error("Not a virtual server request");

      const port = parseInt(match[1], 10);
      const path = match[2] || "/";

      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: ArrayBuffer | undefined;
      if (request.method !== "GET" && request.method !== "HEAD") {
        body = await request.arrayBuffer();
      }

      const response = await this.handleRequest(
        port,
        request.method,
        path + url.search,
        headers,
        body,
      );

      return new Response(response.body, {
        status: response.statusCode,
        statusText: response.statusMessage,
        headers: response.headers,
      });
    };
  }

  private notifyServiceWorker(type: string, data: unknown): void {
    if (this.serviceWorkerReady && this.messageChannel) {
      this.messageChannel.port1.postMessage({ type, data });
    }
  }

  dispose(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
    // Clear any queued requests
    for (const req of this.requestQueue) {
      clearTimeout(req.timer);
      req.resolve({
        statusCode: 503,
        statusMessage: "Service Unavailable",
        headers: { "Content-Type": "text/plain" },
        body: Buffer.from("Server bridge disposed"),
      });
    }
    this.requestQueue = [];
    this.servers.clear();
    this.serviceWorkerReady = false;
    this.messageChannel = null;
  }
}

let globalBridge: ServerBridge | null = null;

export function getServerBridge(options?: BridgeOptions): ServerBridge {
  if (!globalBridge) {
    globalBridge = new ServerBridge(options);
  }
  return globalBridge;
}

export function resetServerBridge(): void {
  if (globalBridge) {
    globalBridge.dispose();
    globalBridge = null;
  }
}
