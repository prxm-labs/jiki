import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../src/memfs";
import {
  DevServer,
  hasContentHash,
  inferCacheControl,
} from "../src/dev-server";
import type { ResponseData } from "../src/dev-server";
import { BufferImpl as Buffer } from "../src/polyfills/stream";

class TestServer extends DevServer {
  async handleRequest(
    method: string,
    url: string,
    _headers: Record<string, string>,
    _body?: Buffer,
  ): Promise<ResponseData> {
    if (method === "GET") return this.serveFile(url);
    return this.serverError(new Error("unsupported"));
  }

  startWatching(): void {}

  exposedResolvePath(p: string) {
    return this.resolvePath(p);
  }
  exposedServeFile(p: string) {
    return this.serveFile(p);
  }
  exposedNotFound(p: string) {
    return this.notFound(p);
  }
  exposedServerError(e: unknown) {
    return this.serverError(e);
  }
  exposedRedirect(loc: string, status?: 301 | 302 | 307 | 308) {
    return this.redirect(loc, status);
  }
  exposedGetMimeType(p: string) {
    return this.getMimeType(p);
  }
  exposedExists(p: string) {
    return this.exists(p);
  }
  exposedIsDirectory(p: string) {
    return this.isDirectory(p);
  }
  exposedAddCorsHeaders(res: ResponseData) {
    return this.addCorsHeaders(res);
  }
  exposedHandleOptionsRequest() {
    return this.handleOptionsRequest();
  }
}

describe("DevServer", () => {
  let vfs: MemFS;
  let server: TestServer;

  beforeEach(() => {
    vfs = new MemFS();
    server = new TestServer(vfs, { port: 3000 });
  });

  describe("getMimeType", () => {
    it("returns correct types for common extensions", () => {
      expect(server.exposedGetMimeType("/file.html")).toBe(
        "text/html; charset=utf-8",
      );
      expect(server.exposedGetMimeType("/style.css")).toBe(
        "text/css; charset=utf-8",
      );
      expect(server.exposedGetMimeType("/app.js")).toBe(
        "application/javascript; charset=utf-8",
      );
      expect(server.exposedGetMimeType("/data.json")).toBe(
        "application/json; charset=utf-8",
      );
      expect(server.exposedGetMimeType("/img.png")).toBe("image/png");
      expect(server.exposedGetMimeType("/photo.jpg")).toBe("image/jpeg");
      expect(server.exposedGetMimeType("/icon.svg")).toBe("image/svg+xml");
    });

    it("returns octet-stream for unknown extensions", () => {
      expect(server.exposedGetMimeType("/file.xyz")).toBe(
        "application/octet-stream",
      );
      expect(server.exposedGetMimeType("/noext")).toBe(
        "application/octet-stream",
      );
    });

    it("handles TypeScript and JSX extensions", () => {
      expect(server.exposedGetMimeType("/app.ts")).toBe(
        "application/javascript; charset=utf-8",
      );
      expect(server.exposedGetMimeType("/comp.tsx")).toBe(
        "application/javascript; charset=utf-8",
      );
      expect(server.exposedGetMimeType("/comp.jsx")).toBe(
        "application/javascript; charset=utf-8",
      );
    });
  });

  describe("resolvePath", () => {
    it("strips query string and hash", () => {
      expect(server.exposedResolvePath("/page?foo=bar")).toBe("/page");
      expect(server.exposedResolvePath("/page#section")).toBe("/page");
      expect(server.exposedResolvePath("/page?a=1#top")).toBe("/page");
    });

    it("ensures leading slash", () => {
      expect(server.exposedResolvePath("file.txt")).toBe("/file.txt");
    });

    it("prepends root when not default", () => {
      const rootServer = new TestServer(vfs, { port: 3000, root: "/public" });
      expect(rootServer.exposedResolvePath("/index.html")).toBe(
        "/public/index.html",
      );
    });
  });

  describe("serveFile", () => {
    it("serves an existing file with correct MIME type", () => {
      vfs.writeFileSync("/index.html", "<h1>Hi</h1>");
      const res = server.exposedServeFile("/index.html");
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    });

    it("returns 404 for missing files", () => {
      const res = server.exposedServeFile("/missing.js");
      expect(res.statusCode).toBe(404);
    });
  });

  describe("notFound", () => {
    it("returns 404 with path in body", () => {
      const res = server.exposedNotFound("/missing");
      expect(res.statusCode).toBe(404);
      expect(res.statusMessage).toBe("Not Found");
    });
  });

  describe("serverError", () => {
    it("returns 500 with error message", () => {
      const res = server.exposedServerError(new Error("oops"));
      expect(res.statusCode).toBe(500);
    });

    it("handles non-Error values", () => {
      const res = server.exposedServerError("string error");
      expect(res.statusCode).toBe(500);
    });
  });

  describe("redirect", () => {
    it("returns 302 by default", () => {
      const res = server.exposedRedirect("/new-location");
      expect(res.statusCode).toBe(302);
      expect(res.headers.Location).toBe("/new-location");
    });

    it("returns 301 when specified", () => {
      const res = server.exposedRedirect("/permanent", 301);
      expect(res.statusCode).toBe(301);
      expect(res.statusMessage).toBe("Moved Permanently");
    });
  });

  describe("lifecycle", () => {
    it("starts and stops correctly", () => {
      expect(server.isRunning()).toBe(false);
      server.start();
      expect(server.isRunning()).toBe(true);
      server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it("returns the configured port", () => {
      expect(server.getPort()).toBe(3000);
    });

    it("emits listening event on start", () => {
      let emittedPort: number | undefined;
      server.on("listening", (port: number) => {
        emittedPort = port;
      });
      server.start();
      expect(emittedPort).toBe(3000);
    });

    it("emits close event on stop", () => {
      let closed = false;
      server.on("close", () => {
        closed = true;
      });
      server.start();
      server.stop();
      expect(closed).toBe(true);
    });
  });

  describe("exists and isDirectory", () => {
    it("checks file existence", () => {
      vfs.writeFileSync("/test.txt", "data");
      expect(server.exposedExists("/test.txt")).toBe(true);
      expect(server.exposedExists("/nope.txt")).toBe(false);
    });

    it("checks if path is directory", () => {
      vfs.mkdirSync("/dir", { recursive: true });
      vfs.writeFileSync("/file.txt", "");
      expect(server.exposedIsDirectory("/dir")).toBe(true);
      expect(server.exposedIsDirectory("/file.txt")).toBe(false);
      expect(server.exposedIsDirectory("/nonexistent")).toBe(false);
    });
  });

  describe("Cache-Control headers (Task 23)", () => {
    it("hasContentHash detects hashed filenames", () => {
      expect(hasContentHash("/app.a1b2c3d4.js")).toBe(true);
      expect(hasContentHash("/chunk-ABCDEF01.css")).toBe(true);
      expect(hasContentHash("/vendor.1234abcd.chunk.js")).toBe(true);
      expect(hasContentHash("/app.js")).toBe(false);
      expect(hasContentHash("/index.html")).toBe(false);
      expect(hasContentHash("/style.css")).toBe(false);
    });

    it("inferCacheControl returns immutable for hashed assets", () => {
      expect(inferCacheControl("/app.a1b2c3d4.js")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect(inferCacheControl("/chunk-ABCDEF01.css")).toBe(
        "public, max-age=31536000, immutable",
      );
    });

    it("inferCacheControl returns no-cache for HTML", () => {
      expect(inferCacheControl("/index.html")).toBe("no-cache");
      expect(inferCacheControl("/page.htm")).toBe("no-cache");
    });

    it("inferCacheControl returns no-cache for non-hashed assets", () => {
      expect(inferCacheControl("/app.js")).toBe("no-cache");
      expect(inferCacheControl("/style.css")).toBe("no-cache");
    });

    it("serveFile uses immutable cache for hashed files", () => {
      vfs.writeFileSync("/app.a1b2c3d4.js", 'console.log("hi")');
      const res = server.exposedServeFile("/app.a1b2c3d4.js");
      expect(res.statusCode).toBe(200);
      expect(res.headers["Cache-Control"]).toBe(
        "public, max-age=31536000, immutable",
      );
    });

    it("serveFile uses no-cache for non-hashed files", () => {
      vfs.writeFileSync("/index.html", "<h1>Hello</h1>");
      const res = server.exposedServeFile("/index.html");
      expect(res.statusCode).toBe(200);
      expect(res.headers["Cache-Control"]).toBe("no-cache");
    });
  });

  describe("CORS headers (Task 24)", () => {
    it("addCorsHeaders adds CORS headers to a response", () => {
      const response: ResponseData = {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "Content-Type": "text/plain" },
        body: Buffer.from("test"),
      };
      const corsResponse = server.exposedAddCorsHeaders(response);
      expect(corsResponse.headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(corsResponse.headers["Access-Control-Allow-Methods"]).toContain(
        "GET",
      );
      expect(corsResponse.headers["Access-Control-Allow-Headers"]).toContain(
        "Content-Type",
      );
    });

    it("handleOptionsRequest returns 204 with CORS headers", () => {
      const res = server.exposedHandleOptionsRequest();
      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(res.headers["Access-Control-Allow-Methods"]).toContain("GET");
      expect(res.headers["Access-Control-Max-Age"]).toBe("86400");
    });
  });
});
