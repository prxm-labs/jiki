import { describe, it, expect } from "vitest";
import {
  IncomingMessage,
  ServerResponse,
  ClientRequest,
} from "../../src/polyfills/http";

describe("HTTP polyfill missing methods", () => {
  describe("IncomingMessage", () => {
    it("has rawHeaders property built from headers", () => {
      const msg = new IncomingMessage({
        headers: { "content-type": "text/html" },
      });
      expect(msg.rawHeaders).toEqual(["content-type", "text/html"]);
    });

    it("has empty rawHeaders when no headers provided", () => {
      const msg = new IncomingMessage();
      expect(msg.rawHeaders).toEqual([]);
    });

    it("has trailers property", () => {
      const msg = new IncomingMessage();
      expect(msg.trailers).toEqual({});
    });

    it("has rawTrailers property", () => {
      const msg = new IncomingMessage();
      expect(msg.rawTrailers).toEqual([]);
    });

    it("has setTimeout method", () => {
      const msg = new IncomingMessage();
      expect(typeof msg.setTimeout).toBe("function");
      const result = msg.setTimeout(1000);
      expect(result).toBe(msg);
    });
  });

  describe("ServerResponse", () => {
    it("has addTrailers method", () => {
      const res = new ServerResponse();
      expect(typeof res.addTrailers).toBe("function");
      res.addTrailers({ "x-checksum": "abc123" });
      expect(res.getHeader("x-checksum")).toBe("abc123");
    });

    it("has flushHeaders method", () => {
      const res = new ServerResponse();
      expect(res.headersSent).toBe(false);
      res.flushHeaders();
      expect(res.headersSent).toBe(true);
    });

    it("has cork and uncork methods", () => {
      const res = new ServerResponse();
      expect(typeof res.cork).toBe("function");
      expect(typeof res.uncork).toBe("function");
      // They should be no-ops and not throw
      res.cork();
      res.uncork();
    });
  });

  describe("ClientRequest", () => {
    it("has abort method", () => {
      const req = new ClientRequest({
        hostname: "localhost",
        path: "/",
        method: "GET",
      });
      expect(typeof req.abort).toBe("function");
      expect(req.aborted).toBe(false);
      req.abort();
      expect(req.aborted).toBe(true);
    });

    it("abort emits abort event", () => {
      const req = new ClientRequest({
        hostname: "localhost",
        path: "/",
        method: "GET",
      });
      let emitted = false;
      req.on("abort", () => {
        emitted = true;
      });
      req.abort();
      expect(emitted).toBe(true);
    });

    it("has setTimeout method", () => {
      const req = new ClientRequest({
        hostname: "localhost",
        path: "/",
        method: "GET",
      });
      expect(typeof req.setTimeout).toBe("function");
      const result = req.setTimeout(5000);
      expect(result).toBe(req);
    });

    it("has destroy method", () => {
      const req = new ClientRequest({
        hostname: "localhost",
        path: "/",
        method: "GET",
      });
      expect(typeof req.destroy).toBe("function");
      let closed = false;
      req.on("close", () => {
        closed = true;
      });
      req.destroy();
      expect(req.aborted).toBe(true);
      expect(closed).toBe(true);
    });

    it("destroy with error emits error event", () => {
      const req = new ClientRequest({
        hostname: "localhost",
        path: "/",
        method: "GET",
      });
      let errorEmitted: Error | null = null;
      req.on("error", err => {
        errorEmitted = err as Error;
      });
      const testError = new Error("test");
      req.destroy(testError);
      expect(errorEmitted).toBe(testError);
    });
  });
});
