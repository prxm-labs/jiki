import type { RequireFunction } from "./kernel";

export function wrapDynamicImport(
  localRequire: RequireFunction,
): (specifier: string) => Promise<unknown> {
  return async (specifier: string): Promise<unknown> => {
    const exported = localRequire(specifier);
    if (
      exported &&
      typeof exported === "object" &&
      ("default" in (exported as object) ||
        "__esModule" in (exported as object))
    ) {
      return exported;
    }
    return {
      default: exported,
      ...(exported && typeof exported === "object" ? (exported as object) : {}),
    };
  };
}

const CONSOLE_METHODS = [
  "log",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "dir",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "assert",
  "clear",
  "count",
  "countReset",
  "group",
  "groupCollapsed",
  "groupEnd",
] as const;

export function buildConsoleProxy(
  hook?: (method: string, args: unknown[]) => void,
): typeof console | Record<string, (...args: unknown[]) => void> {
  if (!hook) return console;
  const proxy: Record<string, (...args: unknown[]) => void> = {};
  for (const name of CONSOLE_METHODS) {
    proxy[name] = (...args: unknown[]) => {
      hook(name, args);
      (console as any)[name]?.(...args);
    };
  }
  return proxy;
}

export function buildModuleWrapper(
  code: string,
  filename?: string,
): (
  exports: unknown,
  require: RequireFunction,
  mod: unknown,
  __filename: string,
  __dirname: string,
  process: unknown,
  console: unknown,
  import_meta: unknown,
  __dynamicImport: unknown,
) => void {
  // Append //# sourceURL so browser DevTools display the correct filename.
  const sourceURL = filename ? `\n//# sourceURL=${filename}` : "";
  const body = [
    "(function(exports, require, module, __filename, __dirname, process, console, import_meta, __dynamicImport) {",
    "(function() {",
    code,
    "}).call(exports);",
    "})",
    sourceURL,
  ].join("\n");
  return new Function("return " + body)();
}
