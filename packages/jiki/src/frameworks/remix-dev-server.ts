/**
 * Remix-compatible dev server for jiki.
 *
 * Extends the ViteDevServer with Remix's file-based routing conventions:
 * - `routes/` directory for flat file routing
 * - `loader`/`action` exports for data loading
 * - Nested layouts via dot-delimited filenames (e.g. `routes/dashboard.settings.tsx`)
 */

import { ViteDevServer, type ViteDevServerOptions } from "./vite-dev-server";
import { MemFS } from "../memfs";
import { BufferImpl as Buffer } from "../polyfills/stream";
import * as pathShim from "../polyfills/path";
import type { ResponseData } from "../dev-server";

export interface RemixDevServerOptions extends ViteDevServerOptions {
  /** Routes directory (default: `/app/routes`). */
  routesDir?: string;
  /** App directory (default: `/app`). */
  appDir?: string;
}

export interface RemixRoute {
  /** URL route path. */
  route: string;
  /** File path in the VFS. */
  filePath: string;
  /** Whether this is a layout route. */
  isLayout: boolean;
}

export class RemixDevServer extends ViteDevServer {
  private routesDir: string;
  private appDir: string;

  constructor(vfs: MemFS, options: RemixDevServerOptions) {
    super(vfs, { ...options, framework: "react" });
    this.routesDir = options.routesDir || "/app/routes";
    this.appDir = options.appDir || "/app";
  }

  async handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<ResponseData> {
    const parsed = new URL(url, "http://localhost");
    const pathname = decodeURIComponent(parsed.pathname);

    // Try to resolve as a Remix route
    const route = this.resolveRoute(pathname);
    if (route) {
      return this.addCorsHeaders(this.serveRemixPage(route, pathname));
    }

    // Fall through to ViteDevServer
    return super.handleRequest(method, url, headers, body);
  }

  /**
   * Resolve a URL pathname to a Remix route file.
   * Remix uses flat file routing with dot-delimited nesting:
   * - `routes/_index.tsx` → `/`
   * - `routes/about.tsx` → `/about`
   * - `routes/dashboard.settings.tsx` → `/dashboard/settings`
   */
  private resolveRoute(pathname: string): RemixRoute | null {
    // Try _index for root
    if (pathname === "/") {
      const indexFile = this.findRouteFile("_index");
      if (indexFile)
        return { route: "/", filePath: indexFile, isLayout: false };
    }

    // Convert URL path to flat filename
    const segments = pathname.split("/").filter(Boolean);
    const flatName = segments.join(".");

    const file = this.findRouteFile(flatName);
    if (file) return { route: pathname, filePath: file, isLayout: false };

    // Try index under a layout
    const indexName = flatName ? `${flatName}._index` : "_index";
    const indexFile = this.findRouteFile(indexName);
    if (indexFile)
      return { route: pathname, filePath: indexFile, isLayout: false };

    return null;
  }

  private findRouteFile(name: string): string | null {
    for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
      const filePath = pathShim.join(this.routesDir, `${name}${ext}`);
      if (this.exists(filePath)) return filePath;
    }
    return null;
  }

  private serveRemixPage(route: RemixRoute, pathname: string): ResponseData {
    const rootPath = pathShim.join(this.appDir, "root.tsx");
    const hasRoot = this.exists(rootPath);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Remix App</title>
  <script type="module" src="/@vite/client"></script>
</head>
<body>
  <div id="root"></div>
  ${hasRoot ? `<script type="module" src="${rootPath}"></script>` : ""}
  <script type="module" src="${route.filePath}"></script>
</body>
</html>`;
    const buf = Buffer.from(html);
    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-cache",
      },
      body: buf,
    };
  }

  /**
   * Discover all routes in the Remix routes directory.
   */
  discoverRoutes(): RemixRoute[] {
    const routes: RemixRoute[] = [];
    try {
      const entries = this.vfs.readdirSync(this.routesDir);
      for (const entry of entries) {
        if (!entry.match(/\.(tsx?|jsx?)$/)) continue;
        const name = entry.replace(/\.(tsx?|jsx?)$/, "");
        const filePath = pathShim.join(this.routesDir, entry);
        const route = this.flatNameToRoute(name);
        routes.push({ route, filePath, isLayout: name.includes("_layout") });
      }
    } catch {
      /* routes dir may not exist */
    }
    return routes;
  }

  private flatNameToRoute(name: string): string {
    if (name === "_index") return "/";
    // Convert dots to slashes, handle special chars
    return (
      "/" +
      name
        .replace(/\._index$/, "")
        .replace(/\./g, "/")
        .replace(/^\$/, ":")
        .replace(/\/\$/g, "/:")
    );
  }
}
