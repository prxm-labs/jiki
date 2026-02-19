import { describe, it, expect, beforeEach } from "vitest";
import {
  ServerBridge,
  resetServerBridge,
  getServerBridge,
} from "../src/server-bridge";
import type { IVirtualServer } from "../src/server-bridge";
import { BufferImpl as Buffer } from "../src/polyfills/stream";
import type { ResponseData } from "../src/dev-server";

function createMockServer(responseBody = "OK"): IVirtualServer {
  return {
    handleRequest: async (
      _method: string,
      _url: string,
      _headers: Record<string, string>,
      _body?: Buffer | string,
    ): Promise<ResponseData> => ({
      statusCode: 200,
      statusMessage: "OK",
      headers: { "Content-Type": "text/plain" },
      body: Buffer.from(responseBody),
    }),
  };
}

describe("ServerBridge", () => {
  let bridge: ServerBridge;

  beforeEach(() => {
    resetServerBridge();
    bridge = new ServerBridge({ baseUrl: "http://localhost" });
  });

  describe("server registration", () => {
    it("registers a server on a port", () => {
      const server = createMockServer();
      bridge.registerServer(server, 3000);
      expect(bridge.getServerPorts()).toContain(3000);
    });

    it("unregisters a server", () => {
      const server = createMockServer();
      bridge.registerServer(server, 3000);
      bridge.unregisterServer(3000);
      expect(bridge.getServerPorts()).not.toContain(3000);
    });

    it("emits server-ready event on registration", () => {
      let emittedPort = 0;
      let emittedUrl = "";
      bridge.on("server-ready", (port: number, url: string) => {
        emittedPort = port;
        emittedUrl = url;
      });

      const server = createMockServer();
      bridge.registerServer(server, 3000);

      expect(emittedPort).toBe(3000);
      expect(emittedUrl).toBe("http://localhost/__virtual__/3000");
    });

    it("calls onServerReady callback", () => {
      const calls: Array<{ port: number; url: string }> = [];
      const bridgeWithCb = new ServerBridge({
        baseUrl: "http://localhost",
        onServerReady: (port, url) => calls.push({ port, url }),
      });

      bridgeWithCb.registerServer(createMockServer(), 8080);
      expect(calls).toHaveLength(1);
      expect(calls[0].port).toBe(8080);
    });
  });

  describe("URL generation", () => {
    it("generates correct server URL", () => {
      expect(bridge.getServerUrl(3000)).toBe(
        "http://localhost/__virtual__/3000",
      );
    });

    it("uses custom baseUrl", () => {
      const custom = new ServerBridge({ baseUrl: "https://example.com" });
      expect(custom.getServerUrl(8080)).toBe(
        "https://example.com/__virtual__/8080",
      );
    });
  });

  describe("request handling", () => {
    it("routes request to registered server", async () => {
      const server = createMockServer("Hello World");
      bridge.registerServer(server, 3000);

      const response = await bridge.handleRequest(3000, "GET", "/", {});
      expect(response.statusCode).toBe(200);
      expect(new TextDecoder().decode(response.body)).toBe("Hello World");
    });

    it("returns 503 for unregistered port", async () => {
      // Use a short queue timeout so the test doesn't wait 10s
      const origTimeout = ServerBridge.REQUEST_QUEUE_TIMEOUT;
      ServerBridge.REQUEST_QUEUE_TIMEOUT = 100;
      try {
        const response = await bridge.handleRequest(9999, "GET", "/", {});
        expect(response.statusCode).toBe(503);
      } finally {
        ServerBridge.REQUEST_QUEUE_TIMEOUT = origTimeout;
      }
    });

    it("returns 500 on server error", async () => {
      const errorServer: IVirtualServer = {
        handleRequest: async () => {
          throw new Error("test error");
        },
      };
      bridge.registerServer(errorServer, 3000);

      const response = await bridge.handleRequest(3000, "GET", "/", {});
      expect(response.statusCode).toBe(500);
      expect(new TextDecoder().decode(response.body)).toContain("test error");
    });

    it("passes request body to server", async () => {
      let receivedBody: Buffer | undefined;
      const server: IVirtualServer = {
        handleRequest: async (_m, _u, _h, body) => {
          receivedBody = body as Buffer | undefined;
          return {
            statusCode: 200,
            statusMessage: "OK",
            headers: {},
            body: Buffer.from("ok"),
          };
        },
      };
      bridge.registerServer(server, 3000);

      const body = new TextEncoder().encode("test body").buffer;
      await bridge.handleRequest(
        3000,
        "POST",
        "/data",
        {},
        body as ArrayBuffer,
      );
      expect(receivedBody).toBeDefined();
      expect(new TextDecoder().decode(receivedBody!)).toBe("test body");
    });
  });

  describe("fetch handler", () => {
    it("creates a fetch handler that routes virtual requests", async () => {
      bridge.registerServer(createMockServer("fetch test"), 3000);
      const handler = bridge.createFetchHandler();

      const response = await handler(
        new Request("http://localhost/__virtual__/3000/api/data"),
      );
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("fetch test");
    });

    it("throws for non-virtual requests", async () => {
      const handler = bridge.createFetchHandler();
      await expect(
        handler(new Request("http://localhost/normal-path")),
      ).rejects.toThrow("Not a virtual server request");
    });
  });

  describe("global bridge", () => {
    it("returns the same instance", () => {
      resetServerBridge();
      const a = getServerBridge();
      const b = getServerBridge();
      expect(a).toBe(b);
    });

    it("resets global bridge", () => {
      const a = getServerBridge();
      resetServerBridge();
      const b = getServerBridge();
      expect(a).not.toBe(b);
    });
  });

  describe("dispose", () => {
    it("clears servers and state", () => {
      bridge.registerServer(createMockServer(), 3000);
      bridge.registerServer(createMockServer(), 4000);
      bridge.dispose();
      expect(bridge.getServerPorts()).toHaveLength(0);
    });
  });
});
