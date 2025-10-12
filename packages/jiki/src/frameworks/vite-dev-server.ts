/**
 * Vite-compatible dev server for jiki.
 *
 * Serves files as ES modules with on-the-fly esbuild-wasm transpilation.
 * Supports React, Vue, Svelte, and any Vite-compatible framework by
 * transforming files before serving.
 *
 * Features:
 * - ESM-based module serving (no bundling, fast per-module transforms)
 * - `/@modules/<pkg>` for bare import resolution from node_modules
 * - CSS → JS module injection (injects `<style>` tags at runtime)
 * - HMR update emission on file changes
 * - HTML generation with module script tags
 */

import {
  DevServer,
  type DevServerOptions,
  type ResponseData,
  type HMRUpdate,
} from "../dev-server";
import { MemFS } from "../memfs";
import { BufferImpl as Buffer } from "../polyfills/stream";
import * as pathShim from "../polyfills/path";
import { processSource, transformEsmToCjs } from "../code-transform";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ViteDevServerOptions extends DevServerOptions {
  /** Entry HTML file (default: `/index.html`). */
  entry?: string;
  /** Framework preset for transform hints. */
  framework?: "react" | "vue" | "svelte" | "solid" | "vanilla";
  /** JSX import source (default: `react` for react, `solid-js` for solid). */
  jsxImportSource?: string;
}

// ---------------------------------------------------------------------------
// ViteDevServer
// ---------------------------------------------------------------------------

export class ViteDevServer extends DevServer {
  private entry: string;
  private framework: string;
  private jsxImportSource: string;

  constructor(vfs: MemFS, options: ViteDevServerOptions) {
    super(vfs, options);
    this.entry = options.entry || "/index.html";
    this.framework = options.framework || "react";
    this.jsxImportSource =
      options.jsxImportSource ||
      (this.framework === "solid" ? "solid-js" : "react");
  }

  async handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<ResponseData> {
    if (method === "OPTIONS") return this.handleOptionsRequest();

    const parsed = new URL(url, "http://localhost");
    const pathname = decodeURIComponent(parsed.pathname);

    // Serve HMR client
    if (pathname === "/@vite/client") {
      return this.addCorsHeaders(this.serveHmrClient());
    }

    // Resolve bare imports: /@modules/react → node_modules/react
    if (pathname.startsWith("/@modules/")) {
      const pkgPath = pathname.slice("/@modules/".length);
      return this.addCorsHeaders(await this.serveBareImport(pkgPath));
    }

    // Serve HTML
    if (pathname === "/" || pathname.endsWith(".html")) {
      const htmlPath =
        pathname === "/" ? this.entry : pathShim.join(this.root, pathname);
      return this.addCorsHeaders(this.serveHtml(htmlPath));
    }

    // Serve and transform JS/TS/JSX/TSX
    if (this.isTransformable(pathname)) {
      return this.addCorsHeaders(await this.serveTransformed(pathname));
    }

    // Serve CSS as JS module
    if (pathname.endsWith(".css")) {
      return this.addCorsHeaders(this.serveCssAsModule(pathname));
    }

    // Serve static files as-is
    return this.addCorsHeaders(this.serveFile(pathname));
  }

  startWatching(): void {
    this.vfs.on("change", (path: string) => {
      if (this.isTransformable(path) || path.endsWith(".css")) {
        this.broadcastChange({
          type: "update",
          path,
          timestamp: Date.now(),
        });
      } else if (path.endsWith(".html")) {
        this.broadcastChange({
          type: "full-reload",
          path,
          timestamp: Date.now(),
        });
      }
    });
  }

  // -- HTML serving ---------------------------------------------------------

  private serveHtml(htmlPath: string): ResponseData {
    const resolved = this.resolvePath(htmlPath);
    try {
      let html = this.vfs.readFileSync(resolved, "utf8");
      // Inject HMR client script
      html = html.replace(
        "</head>",
        `<script type="module" src="/@vite/client"></script>\n</head>`,
      );
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
    } catch {
      // If no index.html, generate a minimal one
      return this.generateDefaultHtml();
    }
  }

  private generateDefaultHtml(): ResponseData {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vite App</title>
  <script type="module" src="/@vite/client"></script>
</head>
<body>
  <div id="root"></div>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script type="module" src="/src/main.ts"></script>
  <script type="module" src="/src/main.jsx"></script>
  <script type="module" src="/src/main.js"></script>
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

  // -- Module transforms ----------------------------------------------------

  private isTransformable(path: string): boolean {
    return /\.(js|ts|tsx|jsx|mjs|cjs)$/.test(path);
  }

  private async serveTransformed(pathname: string): Promise<ResponseData> {
    const filePath = this.resolvePath(pathname);
    try {
      const source = this.vfs.readFileSync(filePath, "utf8");
      let code = this.transformModule(source, filePath);
      // Rewrite bare imports to /@modules/ prefix
      code = this.rewriteBareImports(code);
      // Rewrite relative CSS imports to request path
      code = this.rewriteCssImports(code, pathname);

      const buf = Buffer.from(code);
      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Content-Length": String(buf.length),
          "Cache-Control": "no-cache",
        },
        body: buf,
      };
    } catch (err) {
      return this.serverError(err);
    }
  }

  private transformModule(source: string, filePath: string): string {
    try {
      return processSource(source, filePath);
    } catch {
      // If processSource fails (e.g. transpiler not initialised),
      // return the source with basic ESM-to-CJS conversion
      try {
        return transformEsmToCjs(source, filePath);
      } catch {
        return source;
      }
    }
  }

  /**
   * Rewrite bare import specifiers to /@modules/ URLs.
   * e.g. `import React from "react"` → `import React from "/@modules/react"`
   */
  private rewriteBareImports(code: string): string {
    // Match: require("pkg"), require("@scope/pkg"), require("pkg/sub")
    return code.replace(
      /require\(["']([^./][^"']*)["']\)/g,
      (match, specifier) => {
        // Skip node: builtins
        if (specifier.startsWith("node:")) return match;
        return `require("/@modules/${specifier}")`;
      },
    );
  }

  /**
   * Rewrite CSS imports to use absolute paths.
   */
  private rewriteCssImports(code: string, fromPath: string): string {
    const dir = pathShim.dirname(fromPath);
    return code.replace(
      /require\(["'](\.\.?\/[^"']*\.css)["']\)/g,
      (_match, relPath) => {
        const abs = pathShim.resolve(dir, relPath);
        return `require("${abs}")`;
      },
    );
  }

  // -- CSS as JS module -----------------------------------------------------

  private serveCssAsModule(pathname: string): ResponseData {
    const filePath = this.resolvePath(pathname);
    try {
      const css = this.vfs.readFileSync(filePath, "utf8");
      // Wrap CSS in a JS module that injects a <style> tag
      const escaped = css
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$/g, "\\$");
      const code = [
        `const css = \`${escaped}\`;`,
        `if (typeof document !== 'undefined') {`,
        `  const style = document.createElement('style');`,
        `  style.setAttribute('data-vite-css', '${pathname}');`,
        `  style.textContent = css;`,
        `  document.head.appendChild(style);`,
        `}`,
        `module.exports = {};`,
      ].join("\n");

      const buf = Buffer.from(code);
      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Content-Length": String(buf.length),
          "Cache-Control": "no-cache",
        },
        body: buf,
      };
    } catch {
      return this.notFound(pathname);
    }
  }

  // -- Bare import resolution -----------------------------------------------

  private async serveBareImport(pkgPath: string): Promise<ResponseData> {
    // Resolve from node_modules
    const nmPath = pathShim.join(this.root, "node_modules", pkgPath);

    // Check if it's a direct file
    if (this.exists(nmPath) && !this.isDirectory(nmPath)) {
      return this.serveTransformed(`/node_modules/${pkgPath}`);
    }

    // Try to resolve via package.json main/module/exports
    const pkgJsonPath = pathShim.join(nmPath, "package.json");
    if (this.exists(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(this.vfs.readFileSync(pkgJsonPath, "utf8"));
        const entry = pkg.module || pkg.main || "index.js";
        const entryPath = pathShim.join(nmPath, entry);
        if (this.exists(entryPath)) {
          return this.serveTransformed(`/node_modules/${pkgPath}/${entry}`);
        }
      } catch {}
    }

    // Try common index files
    for (const idx of ["index.js", "index.mjs", "index.ts"]) {
      const idxPath = pathShim.join(nmPath, idx);
      if (this.exists(idxPath)) {
        return this.serveTransformed(`/node_modules/${pkgPath}/${idx}`);
      }
    }

    return this.notFound(`/@modules/${pkgPath}`);
  }

  // -- HMR client -----------------------------------------------------------

  private serveHmrClient(): ResponseData {
    const code = `
// Minimal Vite HMR client for jiki
const listeners = new Map();

export function createHotContext(ownerPath) {
  return {
    accept(deps, callback) {
      if (typeof deps === 'function') {
        listeners.set(ownerPath, deps);
      } else if (callback) {
        listeners.set(ownerPath, callback);
      }
    },
    dispose(cb) {},
    prune(cb) {},
    decline() {},
    invalidate() {},
    on(event, cb) {},
  };
}

export const hot = createHotContext('/');

// import.meta.hot compatibility
if (typeof window !== 'undefined') {
  window.__vite_hot__ = { createHotContext, listeners };
}
`;
    const buf = Buffer.from(code);
    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-cache",
      },
      body: buf,
    };
  }
}
