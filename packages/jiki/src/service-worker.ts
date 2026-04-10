/**
 * Service Worker for jiki virtual server bridge.
 * Intercepts fetch requests to /__virtual__/{port}/* and routes them
 * to the main thread via MessageChannel.
 *
 * Build this file separately and serve it at the swUrl configured
 * in ServerBridge.initServiceWorker() (default: /__sw__.js).
 */

// Service Worker global — typed as `any` because TypeScript's standard libs
// don't include ServiceWorkerGlobalScope without a dedicated tsconfig.
const sw = self as unknown as {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void>; matchAll(): Promise<Client[]> };
  addEventListener(type: string, listener: (event: any) => void): void;
};

let mainPort: MessagePort | null = null;
let requestId = 0;
const pendingRequests = new Map<
  number,
  {
    resolve: (resp: Response) => void;
    reject: (err: Error) => void;
    controller?: ReadableStreamDefaultController<Uint8Array>;
  }
>();

const VIRTUAL_PREFIX = "/__virtual__/";

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

sw.addEventListener("install", () => {
  sw.skipWaiting();
});

sw.addEventListener("activate", (event: { waitUntil(p: Promise<void>): void }) => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "init" && event.data.port) {
    mainPort = event.data.port as MessagePort;
    mainPort.onmessage = handleMainMessage;
  }
  if (event.data?.type === "keepalive") {
    /* keep-alive ping, nothing to do */
  }
});

function handleMainMessage(event: MessageEvent): void {
  const { type, id, data, error } = event.data;

  const pending = pendingRequests.get(id);
  if (!pending) return;

  if (type === "response") {
    if (error) {
      pending.reject(new Error(error));
      pendingRequests.delete(id);
      return;
    }
    const { statusCode, statusMessage, headers, bodyBase64 } = data;
    const body = bodyBase64 ? base64ToUint8(bodyBase64) : new Uint8Array(0);
    pending.resolve(
      new Response(body as unknown as BodyInit, {
        status: statusCode,
        statusText: statusMessage,
        headers,
      }),
    );
    pendingRequests.delete(id);
  } else if (type === "stream-start") {
    const { statusCode, statusMessage, headers: respHeaders } = data;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        pending.controller = controller;
      },
    });
    pending.resolve(
      new Response(stream, {
        status: statusCode,
        statusText: statusMessage,
        headers: respHeaders,
      }),
    );
  } else if (type === "stream-chunk") {
    const chunk = base64ToUint8(data.chunkBase64);
    pending.controller?.enqueue(chunk);
  } else if (type === "stream-end") {
    pending.controller?.close();
    pendingRequests.delete(id);
  }
}

interface SWFetchEvent {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

sw.addEventListener("fetch", (event: SWFetchEvent) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(VIRTUAL_PREFIX)) return;

  if (!mainPort) {
    sw.clients.matchAll().then((clients: Client[]) => {
      for (const client of clients) {
        client.postMessage({ type: "sw-needs-init" });
      }
    });
    event.respondWith(
      new Response("Service Worker not connected", { status: 503 }),
    );
    return;
  }

  const match = url.pathname.match(/^\/__virtual__\/(\d+)(\/.*)?$/);
  if (!match) return;

  const port = parseInt(match[1], 10);
  const path = (match[2] || "/") + url.search;

  const headers: Record<string, string> = {};
  event.request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const isStreamable =
    headers.accept?.includes("text/event-stream") ||
    headers.accept?.includes("application/x-ndjson");

  event.respondWith(
    (async () => {
      const id = ++requestId;
      let body: ArrayBuffer | undefined;
      if (event.request.method !== "GET" && event.request.method !== "HEAD") {
        body = await event.request.arrayBuffer();
      }

      return new Promise<Response>((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        mainPort!.postMessage({
          type: "request",
          id,
          data: {
            port,
            method: event.request.method,
            url: path,
            headers,
            body,
            streaming: isStreamable,
          },
        });
      });
    })(),
  );
});
