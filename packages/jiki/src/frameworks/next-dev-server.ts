/**
 * NextDevServer - Next.js-compatible dev server for the web-containers environment.
 * Implements file-based routing, API routes, and HMR via postMessage.
 *
 * ## Framework Dev Server Roadmap
 *
 * Currently supported:
 * - **Next.js** (Pages Router + App Router) — implemented in this file.
 *
 * Planned framework support:
 * - **Vite SSR** — generic Vite-based dev server with SSR support.
 * - **Remix** — loader/action-based routing with nested layouts.
 * - **SvelteKit** — file-based routing with server-side load functions.
 * - **Nuxt** — Vue-based file-system routing and server routes.
 * - **Astro** — content-focused with island architecture.
 * - **SolidStart** — SolidJS file-based routing with SSR.
 *
 * To add a new framework dev server, implement the {@link DevServer} base class
 * from `../dev-server.ts`. The base class provides `handleRequest()` dispatch,
 * static file serving, HMR event emission, and port management. The subclass
 * must implement route resolution, code transformation, and HTML generation.
 *
 * ## Unsupported Next.js Features
 *
 * The following Next.js features are NOT supported in this browser-based runtime:
 *
 * - **Middleware** (`middleware.ts`): Edge runtime middleware is not executed.
 *   Requests go directly to route handlers without middleware interception.
 *
 * - **Server Actions**: React Server Actions (`"use server"` directive) are not
 *   supported. Form submissions using server actions will not work.
 *
 * - **React Server Components (RSC)**: All components run as client components.
 *   The `"use client"` directive is accepted but has no effect since everything
 *   is already client-side.
 *
 * - **Incremental Static Regeneration (ISR)**: `revalidate` options in
 *   `getStaticProps` or route segment configs are ignored. Pages are always
 *   rendered on demand.
 *
 * - **Internationalization (i18n)**: The `i18n` configuration in `next.config.js`
 *   is not processed. Locale detection and routing are not performed.
 *
 * - **Rewrites and Redirects**: Configuration-based rewrites and redirects from
 *   `next.config.js` are not applied. Use client-side routing instead.
 *
 * - **Parallel Routes and Intercepting Routes**: Advanced App Router patterns
 *   like `@slot` parallel routes and `(..)` intercepting routes are not supported.
 *
 * - **Image Optimization**: The `next/image` component renders a plain `<img>` tag.
 *   No server-side image optimization is performed.
 *
 * - **Edge Runtime**: API routes and pages cannot use `export const runtime = 'edge'`.
 *   All execution happens in the browser's main thread.
 */

import {
  DevServer,
  type DevServerOptions,
  type ResponseData,
  type HMRUpdate,
} from "../dev-server";
import { MemFS } from "../memfs";
import { BufferImpl as Buffer } from "../polyfills/stream";
import { simpleHash } from "../utils/hash";
import { safePath } from "../utils/safe-path";
import {
  redirectNpmImports as _redirectNpmImports,
  stripCssImports as _stripCssImports,
  addReactRefresh as _addReactRefresh,
  transformEsmToCjsSimple,
  type CssModuleContext,
} from "./code-transforms";
import {
  NEXT_LINK_SHIM,
  NEXT_ROUTER_SHIM,
  NEXT_NAVIGATION_SHIM,
  NEXT_HEAD_SHIM,
  NEXT_IMAGE_SHIM,
  NEXT_DYNAMIC_SHIM,
  NEXT_SCRIPT_SHIM,
  NEXT_FONT_GOOGLE_SHIM,
  NEXT_FONT_LOCAL_SHIM,
} from "./next-shims";
import {
  type AppRoute,
  generateAppRouterHtml as _generateAppRouterHtml,
  generatePageHtml as _generatePageHtml,
  serve404Page as _serve404Page,
} from "./next-html-generator";
import {
  type RouteResolverContext,
  hasAppRouter,
  resolveAppRoute,
  resolveAppRouteHandler,
  resolvePageFile,
  resolveApiFile,
  resolveFileWithExtension,
  needsTransform,
} from "./next-route-resolver";
import {
  createMockRequest,
  createMockResponse,
  createBuiltinModules,
  executeApiHandler,
} from "./next-api-handler";
import { ESBUILD_WASM_ESM_CDN, ESBUILD_WASM_BINARY_CDN } from "../config/cdn";

const isBrowser =
  typeof window !== "undefined" &&
  typeof window.navigator !== "undefined" &&
  "serviceWorker" in window.navigator;

declare global {
  interface Window {
    __esbuild?: typeof import("esbuild-wasm");
    __esbuildInitPromise?: Promise<void>;
  }
}

async function initEsbuild(): Promise<void> {
  if (!isBrowser) return;
  if (window.__esbuild) return;
  if (window.__esbuildInitPromise) return window.__esbuildInitPromise;

  window.__esbuildInitPromise = (async () => {
    try {
      const mod = await import(/* @vite-ignore */ ESBUILD_WASM_ESM_CDN);
      const esbuildMod = mod.default || mod;

      try {
        await esbuildMod.initialize({ wasmURL: ESBUILD_WASM_BINARY_CDN });
      } catch (initError) {
        if (
          initError instanceof Error &&
          initError.message.includes('Cannot call "initialize" more than once')
        ) {
          // Already initialized, reuse
        } else {
          throw initError;
        }
      }

      window.__esbuild = esbuildMod;
    } catch (error) {
      console.error("[NextDevServer] Failed to initialize esbuild:", error);
      window.__esbuildInitPromise = undefined;
      throw error;
    }
  })();

  return window.__esbuildInitPromise;
}

function getEsbuild(): typeof import("esbuild-wasm") | undefined {
  return isBrowser ? window.__esbuild : undefined;
}

export interface NextDevServerOptions extends DevServerOptions {
  pagesDir?: string;
  appDir?: string;
  publicDir?: string;
  preferAppRouter?: boolean;
  env?: Record<string, string>;
  basePath?: string;
  additionalImportMap?: Record<string, string>;
  additionalLocalPackages?: string[];
  esmShDeps?: string;
  /** Timeout in milliseconds for API handler execution. Defaults to 30000 (30s). */
  apiHandlerTimeout?: number;
}

export class NextDevServer extends DevServer {
  private pagesDir: string;
  private appDir: string;
  private publicDir: string;
  private useAppRouter: boolean;
  private watcherCleanup: (() => void) | null = null;
  private hmrTargetWindow: Window | null = null;
  private options: NextDevServerOptions;
  private transformCache: Map<string, { code: string; hash: string }> =
    new Map();
  private pathAliases: Map<string, string> = new Map();
  private basePath: string = "";

  private get routeCtx(): RouteResolverContext {
    return {
      exists: (path: string) => this.exists(path),
      isDirectory: (path: string) => this.isDirectory(path),
      readdir: (path: string) => this.vfs.readdirSync(path) as string[],
    };
  }

  constructor(vfs: MemFS, options: NextDevServerOptions) {
    super(vfs, options);
    this.options = options;

    this.pagesDir = options.pagesDir || "/pages";
    this.appDir = options.appDir || "/app";
    this.publicDir = options.publicDir || "/public";

    if (options.preferAppRouter !== undefined) {
      this.useAppRouter = options.preferAppRouter;
    } else {
      this.useAppRouter = hasAppRouter(this.appDir, this.routeCtx);
    }

    this.loadPathAliases();
    this.basePath = options.basePath || "";
  }

  private loadPathAliases(): void {
    try {
      const tsconfigPath = "/tsconfig.json";
      if (!this.vfs.existsSync(tsconfigPath)) return;

      const content = this.vfs.readFileSync(tsconfigPath, "utf-8") as string;
      const tsconfig = JSON.parse(content);
      const paths = tsconfig?.compilerOptions?.paths;
      if (!paths) return;

      for (const [alias, targets] of Object.entries(paths)) {
        if (Array.isArray(targets) && targets.length > 0) {
          const aliasPrefix = alias.replace(/\*$/, "");
          const targetPrefix = (targets[0] as string)
            .replace(/\*$/, "")
            .replace(/^\./, "");
          this.pathAliases.set(aliasPrefix, targetPrefix);
        }
      }
    } catch {
      /* ignore */
    }
  }

  private resolvePathAliases(code: string, currentFile: string): string {
    if (this.pathAliases.size === 0) return code;

    const virtualBase = `/__virtual__/${this.port}`;
    let result = code;

    for (const [alias, target] of this.pathAliases) {
      const aliasEscaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(from\\s*['"]|import\\s*\\(\\s*['"])${aliasEscaped}([^'"]+)(['"])`,
        "g",
      );

      result = result.replace(pattern, (match, prefix, path, quote) => {
        const resolvedPath = `${virtualBase}${target}${path}`;
        return `${prefix}${resolvedPath}${quote}`;
      });
    }

    return result;
  }

  setEnv(key: string, value: string): void {
    this.options.env = this.options.env || {};
    this.options.env[key] = value;
  }

  getEnv(): Record<string, string> {
    return { ...this.options.env };
  }

  /**
   * Set the target window for HMR updates (typically iframe.contentWindow).
   * Enables postMessage-based HMR delivery to sandboxed iframes.
   */
  setHMRTarget(targetWindow: Window): void {
    this.hmrTargetWindow = targetWindow;
  }

  private generateEnvScript(): string {
    const env = this.options.env || {};
    const publicEnvVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith("NEXT_PUBLIC_")) {
        publicEnvVars[key] = value;
      }
    }

    return `<script>
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  Object.assign(window.process.env, ${JSON.stringify(publicEnvVars)});
  window.__NEXT_BASE_PATH__ = ${JSON.stringify(this.basePath)};
</script>`;
  }

  async handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<ResponseData> {
    const urlObj = new URL(url, "http://localhost");
    let pathname = urlObj.pathname;

    const virtualPrefixMatch = pathname.match(/^\/__virtual__\/\d+/);
    if (virtualPrefixMatch) {
      pathname = pathname.slice(virtualPrefixMatch[0].length) || "/";
    }

    if (this.basePath && pathname.startsWith(this.basePath)) {
      const rest = pathname.slice(this.basePath.length);
      if (rest === "" || rest.startsWith("/")) {
        pathname = rest || "/";
      }
    }

    if (pathname.startsWith("/_next/shims/"))
      return this.serveNextShim(pathname);
    if (pathname === "/_next/route-info")
      return this.serveRouteInfo(urlObj.searchParams.get("pathname") || "/");
    if (pathname.startsWith("/_next/pages/"))
      return this.servePageComponent(pathname);
    if (pathname.startsWith("/_next/app/"))
      return this.serveAppComponent(pathname);

    if (pathname.startsWith("/_npm/"))
      return this.serveNpmModule(pathname.slice(5));

    if (this.useAppRouter) {
      const appRouteFile = resolveAppRouteHandler(
        this.appDir,
        pathname,
        this.routeCtx,
      );
      if (appRouteFile) {
        return this.handleAppRouteHandler(
          method,
          pathname,
          headers,
          body,
          appRouteFile,
          urlObj.search,
        );
      }
    }

    if (pathname.startsWith("/api/")) {
      return this.handleApiRoute(method, pathname, headers, body);
    }

    const publicPath = this.publicDir + pathname;
    if (this.exists(publicPath) && !this.isDirectory(publicPath)) {
      return this.serveFile(publicPath);
    }

    if (needsTransform(pathname) && this.exists(pathname)) {
      return this.transformAndServe(pathname, pathname);
    }

    const resolvedFile = resolveFileWithExtension(pathname, this.routeCtx);
    if (resolvedFile) {
      if (needsTransform(resolvedFile))
        return this.transformAndServe(resolvedFile, pathname);
      return this.serveFile(resolvedFile);
    }

    if (this.exists(pathname) && !this.isDirectory(pathname)) {
      return this.serveFile(pathname);
    }

    return this.handlePageRoute(pathname, urlObj.search);
  }

  private serveNextShim(pathname: string): ResponseData {
    const shimName = pathname.replace("/_next/shims/", "").replace(".js", "");

    const SHIM_MAP: Record<string, string> = {
      link: NEXT_LINK_SHIM,
      router: NEXT_ROUTER_SHIM,
      head: NEXT_HEAD_SHIM,
      navigation: NEXT_NAVIGATION_SHIM,
      image: NEXT_IMAGE_SHIM,
      dynamic: NEXT_DYNAMIC_SHIM,
      script: NEXT_SCRIPT_SHIM,
      "font/google": NEXT_FONT_GOOGLE_SHIM,
      "font/local": NEXT_FONT_LOCAL_SHIM,
    };

    const code = SHIM_MAP[shimName];
    if (!code) return this.notFound(pathname);

    const buffer = Buffer.from(code);
    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-cache",
      },
      body: buffer,
    };
  }

  private serveRouteInfo(pathname: string): ResponseData {
    const route = resolveAppRoute(this.appDir, pathname, this.routeCtx);
    const info = route
      ? {
          params: route.params,
          found: true,
          page: route.page,
          layouts: route.layouts,
        }
      : { params: {}, found: false };

    const json = JSON.stringify(info);
    const buffer = Buffer.from(json);

    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-cache",
      },
      body: buffer,
    };
  }

  private async servePageComponent(pathname: string): Promise<ResponseData> {
    const route = pathname.replace("/_next/pages", "").replace(/\.js$/, "");
    const pageFile = resolvePageFile(this.pagesDir, route, this.routeCtx);
    if (!pageFile) return this.notFound(pathname);
    return this.transformAndServe(pageFile, pageFile);
  }

  private async serveAppComponent(pathname: string): Promise<ResponseData> {
    const rawFilePath = pathname.replace("/_next/app", "");

    if (this.exists(rawFilePath) && !this.isDirectory(rawFilePath)) {
      return this.transformAndServe(rawFilePath, rawFilePath);
    }

    const filePath = rawFilePath.replace(/\.js$/, "");
    const extensions = [".tsx", ".jsx", ".ts", ".js"];
    for (const ext of extensions) {
      const fullPath = filePath + ext;
      if (this.exists(fullPath))
        return this.transformAndServe(fullPath, fullPath);
    }

    return this.notFound(pathname);
  }

  private async handleApiRoute(
    method: string,
    pathname: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<ResponseData> {
    const apiFile = resolveApiFile(this.pagesDir, pathname, this.routeCtx);
    if (!apiFile) {
      return {
        statusCode: 404,
        statusMessage: "Not Found",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: Buffer.from(JSON.stringify({ error: "API route not found" })),
      };
    }

    try {
      const code = this.vfs.readFileSync(apiFile, "utf8") as string;
      const transformed = await this.transformApiHandler(code, apiFile);
      const req = createMockRequest(method, pathname, headers, body);
      const res = createMockResponse();

      const builtins = await createBuiltinModules();
      await executeApiHandler(
        transformed,
        req,
        res,
        this.options.env,
        builtins,
      );

      if (!res.isEnded()) {
        const timeoutMs = this.options.apiHandlerTimeout ?? 30000;
        const timeout = new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error(`API handler timeout after ${timeoutMs}ms`)),
            timeoutMs,
          );
        });
        await Promise.race([res.waitForEnd(), timeout]);
      }

      return res.toResponse();
    } catch (error) {
      console.error("[NextDevServer] API error:", error);
      return {
        statusCode: 500,
        statusMessage: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: Buffer.from(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Internal Server Error",
          }),
        ),
      };
    }
  }

  private async handleAppRouteHandler(
    method: string,
    pathname: string,
    headers: Record<string, string>,
    body: Buffer | undefined,
    routeFile: string,
    search?: string,
  ): Promise<ResponseData> {
    try {
      const code = this.vfs.readFileSync(routeFile, "utf8") as string;
      const transformed = await this.transformApiHandler(code, routeFile);

      const builtinModules = await createBuiltinModules();
      const require = (id: string): unknown => {
        const modId = id.startsWith("node:") ? id.slice(5) : id;
        if ((builtinModules as Record<string, unknown>)[modId])
          return (builtinModules as Record<string, unknown>)[modId];
        throw new Error(`Module not found: ${id}`);
      };

      const moduleObj = { exports: {} as Record<string, unknown> };
      const exports = moduleObj.exports;
      const process = {
        env: { ...this.options.env },
        cwd: () => "/",
        platform: "browser",
        version: "v18.0.0",
        versions: { node: "18.0.0" },
      };

      const fn = new Function(
        "exports",
        "require",
        "module",
        "process",
        transformed,
      );
      fn(exports, require, moduleObj, process);

      const methodUpper = method.toUpperCase();
      const handler =
        moduleObj.exports[methodUpper] ||
        moduleObj.exports[methodUpper.toLowerCase()];

      if (typeof handler !== "function") {
        return {
          statusCode: 405,
          statusMessage: "Method Not Allowed",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: Buffer.from(
            JSON.stringify({ error: `Method ${method} not allowed` }),
          ),
        };
      }

      const requestUrl = new URL(pathname + (search || ""), "http://localhost");
      const requestInit: RequestInit = {
        method: methodUpper,
        headers: new Headers(headers),
      };
      if (body && methodUpper !== "GET" && methodUpper !== "HEAD") {
        requestInit.body = body;
      }
      const request = new Request(requestUrl.toString(), requestInit);
      const route = resolveAppRoute(this.appDir, pathname, this.routeCtx);
      const params = route?.params || {};

      const response = await handler(request, {
        params: Promise.resolve(params),
      });

      if (response instanceof Response) {
        const respHeaders: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
          respHeaders[key] = value;
        });
        const respBody = await response.text();
        return {
          statusCode: response.status,
          statusMessage: response.statusText || "OK",
          headers: respHeaders,
          body: Buffer.from(respBody),
        };
      }

      if (response && typeof response === "object") {
        const json = JSON.stringify(response);
        return {
          statusCode: 200,
          statusMessage: "OK",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: Buffer.from(json),
        };
      }

      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: Buffer.from(String(response || "")),
      };
    } catch (error) {
      console.error("[NextDevServer] App Route handler error:", error);
      return {
        statusCode: 500,
        statusMessage: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: Buffer.from(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Internal Server Error",
          }),
        ),
      };
    }
  }

  private async handlePageRoute(
    pathname: string,
    search: string,
  ): Promise<ResponseData> {
    if (this.useAppRouter) return this.handleAppRouterPage(pathname, search);

    const pageFile = resolvePageFile(this.pagesDir, pathname, this.routeCtx);
    if (!pageFile) {
      const notFoundPage = resolvePageFile(
        this.pagesDir,
        "/404",
        this.routeCtx,
      );
      if (notFoundPage) {
        const html = await this.generatePageHtml(notFoundPage, "/404");
        return {
          statusCode: 404,
          statusMessage: "Not Found",
          headers: { "Content-Type": "text/html; charset=utf-8" },
          body: Buffer.from(html),
        };
      }
      return this.serve404Page();
    }

    if (needsTransform(pathname))
      return this.transformAndServe(pageFile, pathname);

    const html = await this.generatePageHtml(pageFile, pathname);
    const buffer = Buffer.from(html);
    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-cache",
      },
      body: buffer,
    };
  }

  private async handleAppRouterPage(
    pathname: string,
    _search: string,
  ): Promise<ResponseData> {
    const route = resolveAppRoute(this.appDir, pathname, this.routeCtx);

    if (!route) {
      const notFoundRoute = resolveAppRoute(
        this.appDir,
        "/not-found",
        this.routeCtx,
      );
      if (notFoundRoute) {
        const html = await this.generateAppRouterHtml(
          notFoundRoute,
          "/not-found",
        );
        return {
          statusCode: 404,
          statusMessage: "Not Found",
          headers: { "Content-Type": "text/html; charset=utf-8" },
          body: Buffer.from(html),
        };
      }
      return this.serve404Page();
    }

    const html = await this.generateAppRouterHtml(route, pathname);
    const buffer = Buffer.from(html);
    return {
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-cache",
      },
      body: buffer,
    };
  }

  private _tailwindConfigCache: string | undefined;

  private async loadTailwindConfig(): Promise<string> {
    if (this._tailwindConfigCache !== undefined)
      return this._tailwindConfigCache;

    const configFiles = [
      "/tailwind.config.ts",
      "/tailwind.config.js",
      "/tailwind.config.mjs",
    ];

    let content: string | null = null;
    for (const file of configFiles) {
      const full = this.root === "/" ? file : `${this.root}${file}`;
      try {
        const raw = this.vfs.readFileSync(full, "utf-8");
        content =
          typeof raw === "string"
            ? raw
            : new TextDecoder().decode(raw as Uint8Array);
        break;
      } catch {
        /* try next */
      }
    }

    if (!content) {
      this._tailwindConfigCache = "";
      return "";
    }

    try {
      let js = content;
      js = js.replace(
        /import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]*['"]\s*;?\s*/g,
        "",
      );
      js = js.replace(
        /import\s+\{[^}]*\}\s+from\s+['"][^'"]*['"]\s*;?\s*/g,
        "",
      );
      js = js.replace(/\s+satisfies\s+\w+\s*;?\s*$/gm, "");
      js = js.replace(/:\s*[A-Z]\w*\s*=/g, " =");
      js = js.replace(/\s+as\s+const\s*/g, " ");

      const expMatch = js.match(/export\s+default\s*/);
      if (!expMatch || expMatch.index === undefined) {
        this._tailwindConfigCache = "";
        return "";
      }

      const after = js
        .substring(expMatch.index + expMatch[0].length)
        .trimStart();
      if (!after.startsWith("{")) {
        this._tailwindConfigCache = "";
        return "";
      }

      const objStart =
        expMatch.index +
        expMatch[0].length +
        (js.substring(expMatch.index + expMatch[0].length).length -
          after.length);
      const objContent = js.substring(objStart);

      let braces = 0,
        inStr = false,
        strCh = "",
        esc = false,
        endIdx = -1;
      for (let i = 0; i < objContent.length; i++) {
        const c = objContent[i];
        if (esc) {
          esc = false;
          continue;
        }
        if (c === "\\") {
          esc = true;
          continue;
        }
        if (inStr) {
          if (c === strCh) inStr = false;
          continue;
        }
        if (c === '"' || c === "'" || c === "`") {
          inStr = true;
          strCh = c;
          continue;
        }
        if (c === "{") braces++;
        else if (c === "}") {
          braces--;
          if (braces === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }

      if (endIdx === -1) {
        this._tailwindConfigCache = "";
        return "";
      }

      const configObj = objContent.substring(0, endIdx);
      this._tailwindConfigCache = `<script>\n  tailwind.config = ${configObj};\n</script>`;
    } catch {
      this._tailwindConfigCache = "";
    }

    return this._tailwindConfigCache;
  }

  private htmlContext() {
    return {
      port: this.port,
      exists: (path: string) => this.exists(path),
      generateEnvScript: () => this.generateEnvScript(),
      loadTailwindConfigIfNeeded: () => this.loadTailwindConfig(),
      additionalImportMap: this.options.additionalImportMap,
    };
  }

  private async generateAppRouterHtml(
    route: AppRoute,
    pathname: string,
  ): Promise<string> {
    return _generateAppRouterHtml(this.htmlContext(), route, pathname);
  }

  private async generatePageHtml(
    pageFile: string,
    pathname: string,
  ): Promise<string> {
    return _generatePageHtml(this.htmlContext(), pageFile, pathname);
  }

  private serve404Page(): ResponseData {
    return _serve404Page(this.port);
  }

  private async transformAndServe(
    filePath: string,
    urlPath: string,
  ): Promise<ResponseData> {
    try {
      const content = this.vfs.readFileSync(filePath, "utf8") as string;
      const hash = simpleHash(content);

      const cached = this.transformCache.get(filePath);
      if (cached && cached.hash === hash) {
        const buffer = Buffer.from(cached.code);
        return {
          statusCode: 200,
          statusMessage: "OK",
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Content-Length": String(buffer.length),
            "Cache-Control": "no-cache",
            "X-Transformed": "true",
            "X-Cache": "hit",
          },
          body: buffer,
        };
      }

      const transformed = await this.transformCode(content, filePath);

      this.transformCache.set(filePath, { code: transformed, hash });
      if (this.transformCache.size > 500) {
        const firstKey = this.transformCache.keys().next().value;
        if (firstKey) this.transformCache.delete(firstKey);
      }

      const buffer = Buffer.from(transformed);
      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Content-Length": String(buffer.length),
          "Cache-Control": "no-cache",
          "X-Transformed": "true",
        },
        body: buffer,
      };
    } catch (error) {
      console.error("[NextDevServer] Transform error:", error);
      const message =
        error instanceof Error ? error.message : "Transform failed";
      const errorJs = `// Transform Error: ${message}\nconsole.error(${JSON.stringify(
        message,
      )});`;
      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "X-Transform-Error": "true",
        },
        body: Buffer.from(errorJs),
      };
    }
  }

  private async transformCode(code: string, filename: string): Promise<string> {
    if (!isBrowser) {
      return this.doStripCssImports(code, filename);
    }

    await initEsbuild();
    const esbuild = getEsbuild();
    if (!esbuild) throw new Error("esbuild not available");

    const codeWithoutCss = this.doStripCssImports(code, filename);
    const codeWithAliases = this.resolvePathAliases(codeWithoutCss, filename);

    let loader: "js" | "jsx" | "ts" | "tsx" = "js";
    if (filename.endsWith(".jsx")) loader = "jsx";
    else if (filename.endsWith(".tsx")) loader = "tsx";
    else if (filename.endsWith(".ts")) loader = "ts";

    const result = await esbuild.transform(codeWithAliases, {
      loader,
      format: "esm",
      target: "esnext",
      jsx: "automatic",
      jsxImportSource: "react",
      sourcemap: "inline",
      sourcefile: filename,
    });

    const codeWithCdnImports = this.doRedirectNpmImports(result.code);

    if (/\.(jsx|tsx)$/.test(filename)) {
      return _addReactRefresh(codeWithCdnImports, filename);
    }

    return codeWithCdnImports;
  }

  private _dependencies: Record<string, string> | undefined;

  private getDependencies(): Record<string, string> {
    if (this._dependencies) return this._dependencies;
    let deps: Record<string, string> = {};
    try {
      const pkgPath = `${this.root}/package.json`;
      if (this.vfs.existsSync(pkgPath)) {
        const pkg = JSON.parse(
          this.vfs.readFileSync(pkgPath, "utf-8") as string,
        );
        deps = { ...pkg.dependencies, ...pkg.devDependencies };
      }
    } catch {
      /* ignore */
    }
    this._dependencies = deps;
    return deps;
  }

  private _installedPackages: Set<string> | undefined;

  private getInstalledPackages(): Set<string> {
    if (this._installedPackages) return this._installedPackages;
    const installed = new Set<string>();
    try {
      const nmDir = `${this.root === "/" ? "" : this.root}/node_modules`;
      if (this.vfs.existsSync(nmDir)) {
        const entries = this.vfs.readdirSync(nmDir) as string[];
        for (const entry of entries) {
          if (entry.startsWith(".")) continue;
          if (entry.startsWith("@")) {
            try {
              const scopeDir = `${nmDir}/${entry}`;
              const scoped = this.vfs.readdirSync(scopeDir) as string[];
              for (const s of scoped) installed.add(`${entry}/${s}`);
            } catch {
              /* ignore */
            }
          } else {
            installed.add(entry);
          }
        }
      }
    } catch {
      /* ignore */
    }
    this._installedPackages = installed;
    return installed;
  }

  invalidatePackageCache(): void {
    this._dependencies = undefined;
    this._installedPackages = undefined;
  }

  private doRedirectNpmImports(code: string): string {
    return _redirectNpmImports(
      code,
      this.options.additionalLocalPackages,
      this.getDependencies(),
      this.options.esmShDeps,
      this.getInstalledPackages(),
    );
  }

  private doStripCssImports(code: string, currentFile?: string): string {
    return _stripCssImports(code, currentFile, this.getCssModuleContext());
  }

  private getCssModuleContext(): CssModuleContext {
    return {
      readFile: (path: string) =>
        this.vfs.readFileSync(path, "utf-8") as string,
      exists: (path: string) => this.exists(path),
    };
  }

  private async transformApiHandler(
    code: string,
    filename: string,
  ): Promise<string> {
    const codeWithAliases = this.resolvePathAliases(code, filename);

    if (isBrowser) {
      await initEsbuild();
      const esbuild = getEsbuild();
      if (!esbuild) throw new Error("esbuild not available");

      let loader: "js" | "jsx" | "ts" | "tsx" = "js";
      if (filename.endsWith(".jsx")) loader = "jsx";
      else if (filename.endsWith(".tsx")) loader = "tsx";
      else if (filename.endsWith(".ts")) loader = "ts";

      const result = await esbuild.transform(codeWithAliases, {
        loader,
        format: "cjs",
        target: "esnext",
        platform: "neutral",
        sourcefile: filename,
      });

      return result.code;
    }

    return transformEsmToCjsSimple(codeWithAliases);
  }

  protected serveFile(filePath: string): ResponseData {
    if (filePath.endsWith(".json")) {
      try {
        const normalizedPath = this.resolvePath(filePath);
        const content = this.vfs.readFileSync(normalizedPath);
        let jsonContent: string;
        if (typeof content === "string") {
          jsonContent = content;
        } else if (content instanceof Uint8Array) {
          jsonContent = new TextDecoder("utf-8").decode(content);
        } else {
          jsonContent = Buffer.from(content).toString("utf-8");
        }

        const esModuleContent = `export default ${jsonContent};`;
        const buffer = Buffer.from(esModuleContent);

        return {
          statusCode: 200,
          statusMessage: "OK",
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Content-Length": String(buffer.length),
            "Cache-Control": "no-cache",
          },
          body: buffer,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return this.notFound(filePath);
        return this.serverError(error);
      }
    }

    return super.serveFile(filePath);
  }

  /**
   * Serve an npm module from /node_modules/ with ESM-to-CJS transform.
   * Accessed via /_npm/{package}/{file} URLs from the import map.
   */
  private serveNpmModule(modulePath: string): ResponseData {
    const fsPath = safePath("/node_modules", "/" + modulePath);

    if (!modulePath || modulePath === "/") {
      return this.notFound(fsPath);
    }

    let source: string;
    try {
      source = this.vfs.readFileSync(fsPath, "utf-8") as string;
    } catch {
      return this.notFound(fsPath);
    }

    if (fsPath.endsWith(".json")) {
      const js = `export default ${source};`;
      const buf = Buffer.from(js);
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

    let transformed = source;
    try {
      transformed = transformEsmToCjsSimple(source);
    } catch {
      /* serve original on transform failure */
    }

    const buf = Buffer.from(transformed);
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

  /**
   * Start file watching for HMR.
   * Watches /pages, /app, and /public for changes and emits HMR updates.
   */
  startWatching(): void {
    const watchers: Array<{ close: () => void }> = [];

    try {
      const pagesWatcher = this.vfs.watch(
        this.pagesDir,
        { recursive: true },
        (eventType, filename) => {
          if (eventType === "change" && filename) {
            const fullPath = filename.startsWith("/")
              ? filename
              : `${this.pagesDir}/${filename}`;
            this.handleFileChange(fullPath);
          }
        },
      );
      watchers.push(pagesWatcher);
    } catch {
      /* pages dir may not exist */
    }

    if (this.useAppRouter) {
      try {
        const appWatcher = this.vfs.watch(
          this.appDir,
          { recursive: true },
          (eventType, filename) => {
            if (eventType === "change" && filename) {
              const fullPath = filename.startsWith("/")
                ? filename
                : `${this.appDir}/${filename}`;
              this.handleFileChange(fullPath);
            }
          },
        );
        watchers.push(appWatcher);
      } catch {
        /* app dir may not exist */
      }
    }

    try {
      const publicWatcher = this.vfs.watch(
        this.publicDir,
        { recursive: true },
        (eventType, filename) => {
          if (eventType === "change" && filename) {
            this.handleFileChange(`${this.publicDir}/${filename}`);
          }
        },
      );
      watchers.push(publicWatcher);
    } catch {
      /* public dir may not exist */
    }

    this.watcherCleanup = () => {
      watchers.forEach(w => w.close());
    };
  }

  private handleFileChange(path: string): void {
    const isCSS = path.endsWith(".css");
    const isJS = /\.(jsx?|tsx?)$/.test(path);
    const updateType = isCSS || isJS ? "update" : "full-reload";

    this.transformCache.delete(path);

    if (path.includes("tailwind.config")) this._tailwindConfigCache = undefined;
    if (path.includes("node_modules")) this._installedPackages = undefined;

    const update: HMRUpdate = { type: updateType, path, timestamp: Date.now() };
    this.emitHMRUpdate(update);

    if (this.hmrTargetWindow) {
      try {
        this.hmrTargetWindow.postMessage(
          { ...update, channel: "next-hmr" },
          "*",
        );
      } catch {
        /* window may be closed */
      }
    }
  }

  stop(): void {
    if (this.watcherCleanup) {
      this.watcherCleanup();
      this.watcherCleanup = null;
    }
    this.hmrTargetWindow = null;
    super.stop();
  }
}

export default NextDevServer;
