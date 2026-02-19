import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { MemFS } from "../../src/memfs";
import { Kernel } from "../../src/kernel";
import { initTranspiler, stopTranspiler, bundle } from "../../src/transpiler";
import { Container, boot } from "../../src/container";
import { Shell, createShell } from "../../src/shell";
import { PackageManager, NpmLayout } from "../../src/npm/index";

beforeAll(async () => {
  await initTranspiler();
});

afterAll(async () => {
  await stopTranspiler();
});

describe("Integration: TypeScript execution", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("executes a .ts file with type annotations", () => {
    vfs.writeFileSync(
      "/main.ts",
      `
      const greeting: string = "hello world";
      module.exports = greeting;
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe("hello world");
  });

  it("executes a .ts file with an interface", () => {
    vfs.writeFileSync(
      "/user.ts",
      `
      interface User {
        name: string;
        age: number;
      }
      const user: User = { name: "Alice", age: 30 };
      module.exports = user;
    `,
    );
    const result = runtime.runFile("/user.ts");
    expect(result.exports).toEqual({ name: "Alice", age: 30 });
  });

  it("executes a .ts file with type aliases", () => {
    vfs.writeFileSync(
      "/types.ts",
      `
      type ID = string | number;
      const id: ID = 42;
      module.exports = id;
    `,
    );
    const result = runtime.runFile("/types.ts");
    expect(result.exports).toBe(42);
  });

  it("executes a .ts file with enums", () => {
    vfs.writeFileSync(
      "/enums.ts",
      `
      enum Direction {
        Up = "UP",
        Down = "DOWN",
      }
      module.exports = Direction.Up;
    `,
    );
    const result = runtime.runFile("/enums.ts");
    expect(result.exports).toBe("UP");
  });

  it("executes a .ts file with generic functions", () => {
    vfs.writeFileSync(
      "/generics.ts",
      `
      function identity<T>(val: T): T { return val; }
      module.exports = identity(99);
    `,
    );
    const result = runtime.runFile("/generics.ts");
    expect(result.exports).toBe(99);
  });

  it("executes a .ts file with optional chaining and nullish coalescing", () => {
    vfs.writeFileSync(
      "/modern.ts",
      `
      interface Config {
        debug?: boolean;
        timeout?: number;
      }
      const config: Config = {};
      const timeout = config.timeout ?? 3000;
      module.exports = timeout;
    `,
    );
    const result = runtime.runFile("/modern.ts");
    expect(result.exports).toBe(3000);
  });

  it("executes a .ts file with class and access modifiers", () => {
    vfs.writeFileSync(
      "/class.ts",
      `
      class Counter {
        private count: number;
        constructor(initial: number) {
          this.count = initial;
        }
        increment(): void { this.count++; }
        getCount(): number { return this.count; }
      }
      const c = new Counter(10);
      c.increment();
      c.increment();
      module.exports = c.getCount();
    `,
    );
    const result = runtime.runFile("/class.ts");
    expect(result.exports).toBe(12);
  });
});

describe("Integration: TSX execution", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("executes a .tsx file with JSX that produces a virtual DOM element", () => {
    vfs.writeFileSync(
      "/jsx-runtime.ts",
      `
      export function jsx(type: any, props: any) {
        return { type, props };
      }
      export function jsxs(type: any, props: any) {
        return { type, props };
      }
    `,
    );
    vfs.writeFileSync(
      "/app.tsx",
      `
      const App = () => <div className="app">Hello</div>;
      module.exports = App();
    `,
    );

    vfs.mkdirSync("/node_modules/react", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/react/package.json",
      JSON.stringify({
        name: "react",
        version: "19.0.0",
        main: "index.js",
        exports: {
          ".": { default: "./index.js" },
          "./jsx-runtime": { default: "./jsx-runtime.js" },
        },
      }),
    );
    vfs.writeFileSync(
      "/node_modules/react/index.js",
      "module.exports = { createElement: (t, p, ...c) => ({ type: t, props: { ...p, children: c } }) };",
    );
    vfs.writeFileSync(
      "/node_modules/react/jsx-runtime.js",
      `
      module.exports = {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      };
    `,
    );

    const result = runtime.runFile("/app.tsx");
    const el = result.exports as any;
    expect(el.type).toBe("div");
    expect(el.props.className).toBe("app");
  });

  it("executes a .tsx file with typed props", () => {
    vfs.mkdirSync("/node_modules/react", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/react/package.json",
      JSON.stringify({
        name: "react",
        version: "19.0.0",
        main: "index.js",
        exports: {
          ".": { default: "./index.js" },
          "./jsx-runtime": { default: "./jsx-runtime.js" },
        },
      }),
    );
    vfs.writeFileSync("/node_modules/react/index.js", "module.exports = {};");
    vfs.writeFileSync(
      "/node_modules/react/jsx-runtime.js",
      `
      module.exports = {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      };
    `,
    );

    vfs.writeFileSync(
      "/button.tsx",
      `
      interface ButtonProps {
        label: string;
        disabled?: boolean;
      }
      const Button = (props: ButtonProps) => <button disabled={props.disabled}>{props.label}</button>;
      module.exports = Button({ label: "Click me", disabled: false });
    `,
    );

    const result = runtime.runFile("/button.tsx");
    const el = result.exports as any;
    expect(el.type).toBe("button");
    expect(el.props.disabled).toBe(false);
  });
});

describe("Integration: TypeScript module resolution", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("requires a .ts file without extension", () => {
    vfs.writeFileSync(
      "/utils.ts",
      "module.exports = { double: (n: number) => n * 2 };",
    );
    vfs.writeFileSync(
      "/main.js",
      'const { double } = require("./utils"); module.exports = double(21);',
    );
    const result = runtime.runFile("/main.js");
    expect(result.exports).toBe(42);
  });

  it("resolves index.ts in directories", () => {
    vfs.mkdirSync("/lib", { recursive: true });
    vfs.writeFileSync(
      "/lib/index.ts",
      'module.exports = { value: "from-index-ts" };',
    );
    vfs.writeFileSync("/main.js", 'module.exports = require("./lib");');
    const result = runtime.runFile("/main.js");
    expect((result.exports as any).value).toBe("from-index-ts");
  });

  it("resolves index.tsx in directories", () => {
    vfs.mkdirSync("/components", { recursive: true });
    vfs.mkdirSync("/node_modules/react", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/react/package.json",
      JSON.stringify({
        name: "react",
        main: "index.js",
        exports: {
          ".": { default: "./index.js" },
          "./jsx-runtime": { default: "./jsx-runtime.js" },
        },
      }),
    );
    vfs.writeFileSync("/node_modules/react/index.js", "module.exports = {};");
    vfs.writeFileSync(
      "/node_modules/react/jsx-runtime.js",
      `
      module.exports = {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      };
    `,
    );
    vfs.writeFileSync(
      "/components/index.tsx",
      `
      const Component = () => <span>indexed</span>;
      module.exports = Component();
    `,
    );
    vfs.writeFileSync("/main.js", 'module.exports = require("./components");');
    const result = runtime.runFile("/main.js");
    expect((result.exports as any).type).toBe("span");
  });

  it(".js file imports from .ts file", () => {
    vfs.writeFileSync(
      "/math.ts",
      `
      export function add(a: number, b: number): number { return a + b; }
    `,
    );
    vfs.writeFileSync(
      "/main.js",
      `
      import { add } from './math';
      module.exports = add(10, 20);
    `,
    );
    const result = runtime.runFile("/main.js");
    expect(result.exports).toBe(30);
  });

  it(".ts file imports from .js file", () => {
    vfs.writeFileSync("/config.js", "module.exports = { port: 3000 };");
    vfs.writeFileSync(
      "/main.ts",
      `
      const config = require('./config');
      const port: number = config.port;
      module.exports = port;
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe(3000);
  });

  it(".ts file imports another .ts file with ESM syntax", () => {
    vfs.writeFileSync(
      "/helpers.ts",
      `
      export function greet(name: string): string {
        return "Hello, " + name + "!";
      }
    `,
    );
    vfs.writeFileSync(
      "/main.ts",
      `
      import { greet } from './helpers';
      module.exports = greet("TypeScript");
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe("Hello, TypeScript!");
  });

  it("multi-file TypeScript project", () => {
    vfs.writeFileSync(
      "/types.ts",
      `
      export interface Item {
        name: string;
        price: number;
      }
    `,
    );
    vfs.writeFileSync(
      "/data.ts",
      `
      import type { Item } from './types';
      export const items: Item[] = [
        { name: "Widget", price: 9.99 },
        { name: "Gadget", price: 24.99 },
      ];
    `,
    );
    vfs.writeFileSync(
      "/calc.ts",
      `
      import { items } from './data';
      export function totalPrice(): number {
        return items.reduce((sum, item) => sum + item.price, 0);
      }
    `,
    );
    vfs.writeFileSync(
      "/main.ts",
      `
      import { totalPrice } from './calc';
      module.exports = totalPrice();
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBeCloseTo(34.98);
  });
});

describe("Integration: TypeScript type stripping", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("strips interface declarations completely", () => {
    vfs.writeFileSync(
      "/main.ts",
      `
      interface Foo { bar: string; }
      module.exports = "ok";
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe("ok");
  });

  it("strips type alias declarations", () => {
    vfs.writeFileSync(
      "/main.ts",
      `
      type StringOrNumber = string | number;
      const x: StringOrNumber = 42;
      module.exports = x;
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe(42);
  });

  it("strips type-only imports", () => {
    vfs.writeFileSync(
      "/types.ts",
      `
      export interface Config { debug: boolean; }
    `,
    );
    vfs.writeFileSync(
      "/main.ts",
      `
      import type { Config } from './types';
      const cfg = { debug: true } as Config;
      module.exports = cfg.debug;
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe(true);
  });

  it("handles as-casts", () => {
    vfs.writeFileSync(
      "/main.ts",
      `
      const val = "hello" as unknown as number;
      module.exports = typeof val;
    `,
    );
    const result = runtime.runFile("/main.ts");
    expect(result.exports).toBe("string");
  });
});

describe("Integration: TypeScript error handling", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("throws on syntax errors in .ts files", () => {
    vfs.writeFileSync("/bad.ts", "const x: number = {{{;");
    expect(() => runtime.runFile("/bad.ts")).toThrow();
  });

  it("throws on invalid JSX in .tsx files", () => {
    vfs.writeFileSync("/bad.tsx", "const x = <div<>>;");
    expect(() => runtime.runFile("/bad.tsx")).toThrow();
  });
});

describe("Integration: TypeScript caching", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("caches transformed TypeScript code", () => {
    vfs.writeFileSync("/mod.ts", "const x: number = 42; module.exports = x;");
    const first = runtime.runFile("/mod.ts");
    expect(first.exports).toBe(42);

    expect(runtime.processedCodeCache.size).toBeGreaterThan(0);

    runtime.moduleCache = {};
    const second = runtime.runFile("/mod.ts");
    expect(second.exports).toBe(42);
  });

  it("invalidates cache when file content changes", () => {
    vfs.writeFileSync("/mod.ts", "const x: number = 1; module.exports = x;");
    const first = runtime.runFile("/mod.ts");
    expect(first.exports).toBe(1);

    runtime.moduleCache = {};
    vfs.writeFileSync("/mod.ts", "const x: number = 2; module.exports = x;");
    const second = runtime.runFile("/mod.ts");
    expect(second.exports).toBe(2);
  });

  it("clearCache clears TypeScript transform cache", () => {
    vfs.writeFileSync("/mod.ts", "const x: number = 42; module.exports = x;");
    runtime.runFile("/mod.ts");
    expect(runtime.processedCodeCache.size).toBeGreaterThan(0);

    runtime.clearCache();
    expect(runtime.processedCodeCache.size).toBe(0);
  });
});

describe("Integration: esbuild as require", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it('require("esbuild") returns the esbuild module with version', () => {
    const result = runtime.execute(
      'const esbuild = require("esbuild"); module.exports = typeof esbuild.version;',
    );
    expect(result.exports).toBe("string");
  });

  it('require("esbuild") has transform function', () => {
    const result = runtime.execute(
      'const esbuild = require("esbuild"); module.exports = typeof esbuild.transform;',
    );
    expect(result.exports).toBe("function");
  });

  it('require("esbuild") has build function', () => {
    const result = runtime.execute(
      'const esbuild = require("esbuild"); module.exports = typeof esbuild.build;',
    );
    expect(result.exports).toBe("function");
  });
});

describe("Integration: bundling with MemFS", () => {
  it("bundles a multi-file TypeScript project", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync(
      "/src/utils.ts",
      `
      export function multiply(a: number, b: number): number {
        return a * b;
      }
    `,
    );
    vfs.writeFileSync(
      "/src/main.ts",
      `
      import { multiply } from './utils';
      console.log(multiply(6, 7));
    `,
    );

    const result = await bundle(vfs, { entryPoint: "/src/main.ts" });
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("6");
    expect(result.code).toContain("7");
  });

  it("bundles TSX files", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync(
      "/app.tsx",
      `
      interface Props { name: string; }
      const Greet = (p: Props) => <h1>Hello {p.name}</h1>;
      export default Greet;
    `,
    );

    const result = await bundle(vfs, {
      entryPoint: "/app.tsx",
      external: ["react/jsx-runtime", "react"],
    });
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("Hello");
  });

  it("writes bundled output to VFS", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync("/entry.ts", "export const x: number = 42;\n");

    await bundle(vfs, {
      entryPoint: "/entry.ts",
      outfile: "/dist/out.js",
    });

    expect(vfs.existsSync("/dist/out.js")).toBe(true);
    const content = vfs.readFileSync("/dist/out.js", "utf8");
    expect(content).toContain("42");
  });
});

describe("Integration: esbuild shell command", () => {
  let container: Container;

  beforeEach(() => {
    container = boot();
  });

  afterAll(() => {
    container?.destroy();
  });

  it("esbuild command bundles a TypeScript file", async () => {
    container.writeFile("/src/main.ts", "export const answer: number = 42;\n");

    const result = await container.run("esbuild /src/main.ts --bundle");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("42");
  });

  it("esbuild command with --outfile writes to VFS", async () => {
    container.writeFile("/src/main.ts", "export const x: number = 1;\n");

    const result = await container.run(
      "esbuild /src/main.ts --bundle --outfile=/dist/bundle.js",
    );
    expect(result.exitCode).toBe(0);
    expect(container.exists("/dist/bundle.js")).toBe(true);
  });

  it("esbuild command with --format=cjs", async () => {
    container.writeFile("/src/main.ts", "export const val: number = 10;\n");

    const result = await container.run(
      "esbuild /src/main.ts --bundle --format=cjs",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("exports");
  });

  it("esbuild command errors on missing entry", async () => {
    const result = await container.run("esbuild /nonexistent.ts --bundle");
    expect(result.exitCode).not.toBe(0);
  });

  it("esbuild command errors with no arguments", async () => {
    const result = await container.run("esbuild");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("no entry points");
  });
});

describe("Integration: node_modules with TypeScript entries", () => {
  let vfs: MemFS;
  let runtime: Kernel;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
  });

  it("resolves package with .ts main entry", () => {
    vfs.mkdirSync("/node_modules/ts-lib", { recursive: true });
    vfs.writeFileSync(
      "/node_modules/ts-lib/package.json",
      JSON.stringify({
        name: "ts-lib",
        version: "1.0.0",
        main: "index.ts",
      }),
    );
    vfs.writeFileSync(
      "/node_modules/ts-lib/index.ts",
      `
      const value: string = "from-ts-lib";
      module.exports = { value };
    `,
    );
    vfs.writeFileSync("/app.js", 'module.exports = require("ts-lib");');
    const result = runtime.runFile("/app.js");
    expect((result.exports as any).value).toBe("from-ts-lib");
  });
});
