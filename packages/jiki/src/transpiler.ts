/**
 * TypeScript/TSX/JSX transpiler and bundler powered by esbuild-wasm.
 * Provides lazy initialization with singleton pattern for the WASM runtime.
 */

import * as esbuild from "esbuild-wasm";
import type { MemFS } from "./memfs";
import * as pathShim from "./polyfills/path";

let initialized = false;
let initializing: Promise<void> | null = null;

export interface TranspileOptions {
  jsx?: "transform" | "preserve" | "automatic";
  jsxFactory?: string;
  jsxFragment?: string;
  jsxImportSource?: string;
  target?: string;
  sourcemap?: boolean;
}

export interface BundleOptions {
  entryPoint: string;
  format?: "esm" | "cjs" | "iife";
  platform?: "browser" | "node" | "neutral";
  minify?: boolean;
  sourcemap?: boolean;
  target?: string;
  external?: string[];
  outfile?: string;
  loader?: Record<string, string>;
  define?: Record<string, string>;
}

export interface BundleResult {
  code: string;
  map?: string;
  errors: esbuild.Message[];
  warnings: esbuild.Message[];
}

export interface InitOptions {
  wasmURL?: string | URL;
  /** When true, esbuild runs transpilation in a Web Worker (browser only). */
  useWorker?: boolean;
}

let customWasmURL: string | URL | undefined;

export function setWasmURL(url: string | URL): void {
  customWasmURL = url;
}

function resolveWasmURL(options?: InitOptions): string | URL | undefined {
  if (options?.wasmURL) return options.wasmURL;
  if (customWasmURL) return customWasmURL;

  const isBrowser =
    typeof window !== "undefined" || typeof importScripts === "function";
  if (!isBrowser) return undefined;

  return "https://unpkg.com/esbuild-wasm@" + esbuild.version + "/esbuild.wasm";
}

export async function initTranspiler(options?: InitOptions): Promise<void> {
  if (initialized) return;
  if (initializing) return initializing;

  const initOpts: esbuild.InitializeOptions = {
    worker: options?.useWorker ?? false,
  };
  const wasmURL = resolveWasmURL(options);
  if (wasmURL) initOpts.wasmURL = wasmURL;

  initializing = esbuild.initialize(initOpts);
  await initializing;
  initialized = true;
  initializing = null;
}

export function isInitialized(): boolean {
  return initialized;
}

function loaderFromFilename(filename: string): esbuild.Loader {
  if (filename.endsWith(".tsx")) return "tsx";
  if (filename.endsWith(".ts")) return "ts";
  if (filename.endsWith(".jsx")) return "jsx";
  return "js";
}

export function needsTranspilation(filename: string): boolean {
  return (
    filename.endsWith(".ts") ||
    filename.endsWith(".tsx") ||
    filename.endsWith(".jsx")
  );
}

export async function transpile(
  code: string,
  filename: string,
  options: TranspileOptions = {},
): Promise<string> {
  await initTranspiler();

  const loader = loaderFromFilename(filename);
  const result = await esbuild.transform(code, {
    loader,
    format: "esm",
    target: options.target || "esnext",
    sourcemap: options.sourcemap ? "inline" : false,
    jsx: options.jsx || "automatic",
    jsxFactory: options.jsxFactory,
    jsxFragment: options.jsxFragment,
    jsxImportSource: options.jsxImportSource,
  });

  return result.code;
}

const isBrowserEnv =
  typeof window !== "undefined" || typeof importScripts === "function";

export function hasSyncSupport(): boolean {
  return !isBrowserEnv;
}

export function transpileSync(
  code: string,
  filename: string,
  options: TranspileOptions = {},
): string {
  if (!initialized) {
    throw new Error(
      "Transpiler not initialized. Call initTranspiler() first or use transpile() which auto-initializes.",
    );
  }

  if (isBrowserEnv) {
    throw new Error(
      "transpileSync is not available in the browser. Use transpile() (async) or prepareFile() to pre-transpile.",
    );
  }

  const loader = loaderFromFilename(filename);
  const result = esbuild.transformSync(code, {
    loader,
    format: "esm",
    target: options.target || "esnext",
    sourcemap: options.sourcemap ? "inline" : false,
    jsx: options.jsx || "automatic",
    jsxFactory: options.jsxFactory,
    jsxFragment: options.jsxFragment,
    jsxImportSource: options.jsxImportSource,
  });

  return result.code;
}

function createMemFSPlugin(vfs: MemFS, cwd: string): esbuild.Plugin {
  return {
    name: "memfs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (args.kind === "entry-point") {
          const resolved = pathShim.isAbsolute(args.path)
            ? args.path
            : pathShim.resolve(cwd, args.path);
          return { path: resolved, namespace: "memfs" };
        }

        const resolveDir = args.resolveDir || cwd;

        if (args.path.startsWith(".") || args.path.startsWith("/")) {
          const base = args.path.startsWith("/")
            ? args.path
            : pathShim.resolve(resolveDir, args.path);

          for (const candidate of [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}.js`,
            `${base}.jsx`,
            `${base}.json`,
          ]) {
            if (vfs.existsSync(candidate)) {
              try {
                if (vfs.statSync(candidate).isFile()) {
                  return { path: candidate, namespace: "memfs" };
                }
              } catch {}
            }
          }

          for (const indexFile of [
            "index.ts",
            "index.tsx",
            "index.js",
            "index.jsx",
            "index.json",
          ]) {
            const indexPath = pathShim.join(base, indexFile);
            if (vfs.existsSync(indexPath)) {
              return { path: indexPath, namespace: "memfs" };
            }
          }
        }

        return { path: args.path, external: true };
      });

      build.onLoad({ filter: /.*/, namespace: "memfs" }, args => {
        try {
          const contents = vfs.readFileSync(args.path, "utf8");
          return { contents, loader: loaderFromFilename(args.path) };
        } catch (e) {
          return {
            errors: [
              {
                text: `File not found: ${args.path}`,
              } as esbuild.PartialMessage,
            ],
          };
        }
      });
    },
  };
}

export async function bundle(
  vfs: MemFS,
  options: BundleOptions,
): Promise<BundleResult> {
  await initTranspiler();

  const cwd = pathShim.dirname(
    pathShim.isAbsolute(options.entryPoint)
      ? options.entryPoint
      : pathShim.resolve("/", options.entryPoint),
  );

  const result = await esbuild.build({
    entryPoints: [options.entryPoint],
    bundle: true,
    write: false,
    format: options.format || "esm",
    platform: options.platform || "browser",
    minify: options.minify || false,
    sourcemap: options.sourcemap ? "inline" : false,
    target: options.target || "esnext",
    external: options.external,
    define: options.define,
    plugins: [createMemFSPlugin(vfs, cwd)],
  });

  const code = result.outputFiles?.[0]?.text || "";

  if (options.outfile) {
    const outDir = pathShim.dirname(options.outfile);
    if (!vfs.existsSync(outDir)) {
      vfs.mkdirSync(outDir, { recursive: true });
    }
    vfs.writeFileSync(options.outfile, code);
  }

  return {
    code,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export async function stopTranspiler(): Promise<void> {
  if (initialized) {
    await esbuild.stop();
    initialized = false;
  }
}

export { esbuild };
