import { EventEmitter } from "./polyfills/events";
import { MemFS } from "./memfs";
import { BufferImpl as Buffer } from "./polyfills/stream";
import { safePath } from "./utils/safe-path";

export interface DevServerOptions {
  port: number;
  root?: string;
}

export interface ResponseData {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  body: Buffer;
}

export interface HMRUpdate {
  type: "update" | "full-reload";
  path: string;
  timestamp?: number;
}

/**
 * Check if a filename contains a content hash (e.g., app.a1b2c3d4.js, chunk-HASH.css).
 * Content-hashed files are safe to cache immutably since the hash changes when content changes.
 */
function hasContentHash(filepath: string): boolean {
  // Match patterns like: file.abc123ef.js, file-abc123ef.css, file.ABCDEF01.chunk.js
  // The hash segment should be 8+ hex characters between dots or after a dash before the extension
  return /[.\-][a-fA-F0-9]{8,}[.\-]/.test(filepath);
}

/**
 * Determine the appropriate Cache-Control header for a given file path.
 * - Content-hashed assets get immutable caching (1 year)
 * - HTML and non-hashed assets get no-cache for development freshness
 */
function inferCacheControl(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() || "";
  // HTML files should never be cached immutably
  if (ext === "html" || ext === "htm") {
    return "no-cache";
  }
  // Content-hashed files are safe to cache immutably
  if (hasContentHash(filepath)) {
    return "public, max-age=31536000, immutable";
  }
  return "no-cache";
}

function inferMimeType(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "html":
    case "htm":
      return "text/html; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
    case "ts":
    case "tsx":
      return "application/javascript; charset=utf-8";
    case "json":
    case "map":
      return "application/json; charset=utf-8";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "webp":
      return "image/webp";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "ttf":
      return "font/ttf";
    case "otf":
      return "font/otf";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "pdf":
      return "application/pdf";
    case "xml":
      return "application/xml";
    case "txt":
      return "text/plain; charset=utf-8";
    case "md":
      return "text/markdown; charset=utf-8";
    case "wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}

interface FileContent {
  path: string;
  data: Uint8Array;
  mime: string;
}

class HttpResponder {
  static fromContent(fc: FileContent): ResponseData {
    const buf = Buffer.from(fc.data);
    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": fc.mime,
        "Content-Length": String(buf.length),
        "Cache-Control": inferCacheControl(fc.path),
      },
      body: buf,
    };
  }

  static text(code: number, statusMsg: string, body: string): ResponseData {
    const buf = Buffer.from(body);
    return {
      statusCode: code,
      statusMessage: statusMsg,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": String(buf.length),
      },
      body: buf,
    };
  }

  static redirect(
    location: string,
    status: 301 | 302 | 307 | 308 = 302,
  ): ResponseData {
    const labels: Record<number, string> = {
      301: "Moved Permanently",
      302: "Found",
      307: "Temporary Redirect",
      308: "Permanent Redirect",
    };
    return {
      statusCode: status,
      statusMessage: labels[status] || "Found",
      headers: {
        Location: location,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": "0",
      },
      body: Buffer.from(""),
    };
  }
}

export abstract class DevServer extends EventEmitter {
  protected vfs: MemFS;
  protected port: number;
  protected root: string;
  protected running = false;

  constructor(vfs: MemFS, options: DevServerOptions) {
    super();
    this.vfs = vfs;
    this.port = options.port;
    this.root = options.root || "/";
  }

  abstract handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<ResponseData>;

  abstract startWatching(): void;

  /**
   * CORS headers added to all responses for cross-origin iframe support.
   * This is essential since the dev server is typically accessed from
   * a sandboxed iframe on a different origin.
   */
  private static readonly CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };

  /**
   * Add CORS headers to a response.
   */
  protected addCorsHeaders(response: ResponseData): ResponseData {
    return {
      ...response,
      headers: { ...response.headers, ...DevServer.CORS_HEADERS },
    };
  }

  /**
   * Handle CORS preflight OPTIONS requests.
   */
  protected handleOptionsRequest(): ResponseData {
    return {
      statusCode: 204,
      statusMessage: "No Content",
      headers: {
        ...DevServer.CORS_HEADERS,
        "Content-Length": "0",
      },
      body: Buffer.from(""),
    };
  }

  stop(): void {
    this.running = false;
    this.emit("close");
  }

  start(): void {
    this.running = true;
    this.startWatching();
    this.emit("listening", this.port);
  }

  isRunning(): boolean {
    return this.running;
  }
  getPort(): number {
    return this.port;
  }

  protected serveFile(filePath: string): ResponseData {
    const resolved = this.resolvePath(filePath);
    let raw: Uint8Array;
    try {
      raw = this.vfs.readFileSync(resolved);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return this.notFound(filePath);
      }
      return this.serverError(err);
    }
    return HttpResponder.fromContent({
      path: resolved,
      data: raw,
      mime: this.getMimeType(filePath),
    });
  }

  protected resolvePath(urlPath: string): string {
    return safePath(this.root, urlPath);
  }

  protected notFound(path: string): ResponseData {
    return HttpResponder.text(404, "Not Found", `Not found: ${path}`);
  }

  protected serverError(error: unknown): ResponseData {
    const msg =
      error instanceof Error ? error.message : "Internal Server Error";
    return HttpResponder.text(
      500,
      "Internal Server Error",
      `Server Error: ${msg}`,
    );
  }

  protected redirect(
    location: string,
    status: 301 | 302 | 307 | 308 = 302,
  ): ResponseData {
    return HttpResponder.redirect(location, status);
  }

  protected getMimeType(path: string): string {
    return inferMimeType(path);
  }

  protected exists(path: string): boolean {
    return this.vfs.existsSync(path);
  }

  protected isDirectory(path: string): boolean {
    try {
      return this.vfs.statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  protected broadcastChange(update: HMRUpdate): void {
    this.emit("hmr-update", {
      ...update,
      timestamp: update.timestamp || Date.now(),
    });
  }

  /** @deprecated Use broadcastChange instead */
  protected emitHMRUpdate(update: HMRUpdate): void {
    this.broadcastChange(update);
  }
}

export { hasContentHash, inferCacheControl };
export default DevServer;
