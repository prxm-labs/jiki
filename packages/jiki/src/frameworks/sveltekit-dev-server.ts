/**
 * SvelteKit-compatible dev server for jiki.
 *
 * Extends the ViteDevServer with SvelteKit's file-based routing conventions:
 * - `+page.svelte` for pages
 * - `+layout.svelte` for layouts
 * - `+server.ts` for API routes
 * - `+error.svelte` for error pages
 */

import { ViteDevServer, type ViteDevServerOptions } from "./vite-dev-server";
import { MemFS } from "../memfs";
import { BufferImpl as Buffer } from "../polyfills/stream";
import * as pathShim from "../polyfills/path";
import type { ResponseData } from "../dev-server";

export interface SvelteKitDevServerOptions extends ViteDevServerOptions {
  /** Routes directory (default: `/src/routes`). */
  routesDir?: string;
}

interface SvelteKitRoute {
  route: string;
  pagePath?: string;
  layoutPath?: string;
  serverPath?: string;
  errorPath?: string;
}

export class SvelteKitDevServer extends ViteDevServer {
  private routesDir: string;

  constructor(vfs: MemFS, options: SvelteKitDevServerOptions) {
    super(vfs, { ...options, framework: "svelte" });
    this.routesDir = options.routesDir || "/src/routes";
  }

  async handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<ResponseData> {
    const parsed = new URL(url, "http://localhost");
    const pathname = decodeURIComponent(parsed.pathname);

    // Check for +server.ts API routes first
    const serverRoute = this.resolveServerRoute(pathname);
    if (serverRoute) {
      return this.addCorsHeaders(await this.serveTransformedFile(serverRoute));
    }

    // Check for +page.svelte routes
    const pageRoute = this.resolvePageRoute(pathname);
    if (pageRoute) {
      return this.addCorsHeaders(this.serveSvelteKitPage(pageRoute));
    }

    // Fall through to ViteDevServer for static files, CSS, etc.
    return super.handleRequest(method, url, headers, body);
  }

  private resolvePageRoute(pathname: string): SvelteKitRoute | null {
    const routePath = pathname === "/" ? "" : pathname;
    const dir = pathShim.join(this.routesDir, routePath);

    const pagePath = pathShim.join(dir, "+page.svelte");
    if (!this.exists(pagePath)) return null;

    const layoutPath = this.findLayout(dir);
    const errorPath = this.findError(dir);

    return { route: pathname, pagePath, layoutPath, errorPath };
  }

  private resolveServerRoute(pathname: string): string | null {
    const routePath = pathname === "/" ? "" : pathname;
    const dir = pathShim.join(this.routesDir, routePath);

    for (const ext of [".ts", ".js"]) {
      const serverPath = pathShim.join(dir, `+server${ext}`);
      if (this.exists(serverPath)) return serverPath;
    }
    return null;
  }

  private findLayout(dir: string): string | undefined {
    let current = dir;
    while (current.startsWith(this.routesDir)) {
      const layoutPath = pathShim.join(current, "+layout.svelte");
      if (this.exists(layoutPath)) return layoutPath;
      current = pathShim.dirname(current);
    }
    return undefined;
  }

  private findError(dir: string): string | undefined {
    const errorPath = pathShim.join(dir, "+error.svelte");
    return this.exists(errorPath) ? errorPath : undefined;
  }

  private serveSvelteKitPage(route: SvelteKitRoute): ResponseData {
    const html = this.generateSvelteKitHtml(route);
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

  private async serveTransformedFile(filePath: string): Promise<ResponseData> {
    // Delegate to the parent ViteDevServer's transform pipeline
    return super.handleRequest(
      "GET",
      `http://localhost/${filePath.replace(/^\//, "")}`,
      {},
    );
  }

  private generateSvelteKitHtml(route: SvelteKitRoute): string {
    const pageSource = route.pagePath
      ? this.safeRead(route.pagePath)
      : "<p>Page not found</p>";
    const layoutSource = route.layoutPath
      ? this.safeRead(route.layoutPath)
      : null;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SvelteKit App</title>
  <script type="module" src="/@vite/client"></script>
</head>
<body>
  <div id="svelte-app">
    ${layoutSource ? `<!-- Layout: ${route.layoutPath} -->` : ""}
    <!-- Page: ${route.pagePath} -->
  </div>
  <script type="module" src="${route.pagePath}"></script>
</body>
</html>`;
  }

  /**
   * Discover all routes in the SvelteKit routes directory.
   */
  discoverRoutes(): SvelteKitRoute[] {
    const routes: SvelteKitRoute[] = [];
    this.walkRoutes(this.routesDir, "", routes);
    return routes;
  }

  private walkRoutes(
    dir: string,
    prefix: string,
    routes: SvelteKitRoute[],
  ): void {
    try {
      const entries = this.vfs.readdirSync(dir);
      const hasPage = entries.some(e => e.startsWith("+page."));

      if (hasPage) {
        routes.push(this.resolvePageRoute(prefix || "/")!);
      }

      for (const entry of entries) {
        if (entry.startsWith("+") || entry.startsWith(".")) continue;
        const full = pathShim.join(dir, entry);
        try {
          if (this.vfs.statSync(full).isDirectory()) {
            this.walkRoutes(full, `${prefix}/${entry}`, routes);
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }
  }

  private safeRead(path: string): string {
    try {
      return this.vfs.readFileSync(path, "utf8");
    } catch {
      return "";
    }
  }
}
