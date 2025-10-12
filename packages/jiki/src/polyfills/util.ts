export function format(fmt: unknown, ...args: unknown[]): string {
  if (typeof fmt !== "string")
    return args.length
      ? [fmt, ...args].map(a => inspect(a)).join(" ")
      : inspect(fmt);
  let i = 0;
  return fmt.replace(/%[sdjifoO%]/g, m => {
    if (m === "%%") return "%";
    if (i >= args.length) return m;
    const arg = args[i++];
    switch (m) {
      case "%s":
        return String(arg);
      case "%d":
        return String(Number(arg));
      case "%i":
        return String(Math.floor(Number(arg)));
      case "%f":
        return String(parseFloat(String(arg)));
      case "%j":
        try {
          return JSON.stringify(arg);
        } catch {
          return "[Circular]";
        }
      case "%o":
      case "%O":
        return inspect(arg);
      default:
        return m;
    }
  });
}

export function inspect(
  obj: unknown,
  opts?: { depth?: number; colors?: boolean },
): string {
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";
  if (typeof obj === "string") return `'${obj}'`;
  if (
    typeof obj === "number" ||
    typeof obj === "boolean" ||
    typeof obj === "bigint"
  )
    return String(obj);
  if (typeof obj === "function")
    return `[Function: ${obj.name || "anonymous"}]`;
  if (typeof obj === "symbol") return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof RegExp) return obj.toString();
  if (obj instanceof Error) return `${obj.name}: ${obj.message}`;
  if (Array.isArray(obj)) return `[ ${obj.map(v => inspect(v)).join(", ")} ]`;
  if (obj instanceof Map)
    return `Map(${obj.size}) { ${[...obj.entries()]
      .map(([k, v]) => `${inspect(k)} => ${inspect(v)}`)
      .join(", ")} }`;
  if (obj instanceof Set)
    return `Set(${obj.size}) { ${[...obj].map(v => inspect(v)).join(", ")} }`;
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "[Object]";
  }
}
inspect.custom = Symbol.for("nodejs.util.inspect.custom");

export function inherits(ctor: Function, superCtor: Function): void {
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  Object.setPrototypeOf(ctor, superCtor);
}

export function deprecate<T extends Function>(fn: T, msg: string): T {
  let warned = false;
  return function (this: unknown, ...args: unknown[]) {
    if (!warned) {
      console.warn("DeprecationWarning:", msg);
      warned = true;
    }
    return fn.apply(this, args);
  } as unknown as T;
}

export function promisify<T extends Function>(
  fn: T,
): (...args: unknown[]) => Promise<unknown> {
  return (...args: unknown[]) =>
    new Promise((resolve, reject) => {
      fn(...args, (err: Error | null, ...result: unknown[]) => {
        if (err) reject(err);
        else resolve(result.length <= 1 ? result[0] : result);
      });
    });
}

export function callbackify(
  fn: (...args: unknown[]) => Promise<unknown>,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const cb = args.pop() as Function;
    fn(...args)
      .then(result => cb(null, result))
      .catch(err => cb(err));
  };
}

export function debuglog(section: string): (...args: unknown[]) => void {
  const enabled =
    typeof process !== "undefined" &&
    process.env?.NODE_DEBUG?.includes(section);
  return enabled
    ? (...args) =>
        console.error(`${section.toUpperCase()} ${process?.pid || 0}:`, ...args)
    : () => {};
}

export function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isDeepStrictEqual(v, b[i]));
  }
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k =>
    isDeepStrictEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

export const types = {
  isDate: (v: unknown): v is Date => v instanceof Date,
  isRegExp: (v: unknown): v is RegExp => v instanceof RegExp,
  isPromise: (v: unknown): v is Promise<unknown> => v instanceof Promise,
  isMap: (v: unknown): v is Map<unknown, unknown> => v instanceof Map,
  isSet: (v: unknown): v is Set<unknown> => v instanceof Set,
  isTypedArray: (v: unknown): boolean =>
    ArrayBuffer.isView(v) && !(v instanceof DataView),
  isUint8Array: (v: unknown): v is Uint8Array => v instanceof Uint8Array,
  isArrayBuffer: (v: unknown): v is ArrayBuffer => v instanceof ArrayBuffer,
  isSharedArrayBuffer: (v: unknown): boolean =>
    typeof SharedArrayBuffer !== "undefined" && v instanceof SharedArrayBuffer,
  isProxy: (_v: unknown): boolean => false,
  isNativeError: (v: unknown): v is Error => v instanceof Error,
  isGeneratorFunction: (v: unknown): boolean =>
    typeof v === "function" && v.constructor?.name === "GeneratorFunction",
  isAsyncFunction: (v: unknown): boolean =>
    typeof v === "function" && v.constructor?.name === "AsyncFunction",
};

export class TextEncoder extends globalThis.TextEncoder {}
export class TextDecoder extends globalThis.TextDecoder {}

export default {
  format,
  inspect,
  inherits,
  deprecate,
  promisify,
  callbackify,
  debuglog,
  isDeepStrictEqual,
  types,
  TextEncoder,
  TextDecoder,
};
