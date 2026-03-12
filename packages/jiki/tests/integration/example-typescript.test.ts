import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: TypeScript example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot -> init -> write .ts files -> execute", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/math.ts",
      `
      export function add(a: number, b: number): number { return a + b; }
      export function multiply(a: number, b: number): number { return a * b; }
    `,
    );
    container.writeFile(
      "/main.ts",
      `
      import { add, multiply } from './math';
      console.log('add:', add(10, 32));
      console.log('mul:', multiply(6, 7));
    `,
    );

    const result = await container.run("node /main.ts");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("add: 42");
    expect(result.stdout).toContain("mul: 42");
  });

  it("TypeScript interfaces are stripped correctly", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/types.ts",
      `
      interface Person {
        name: string;
        age: number;
      }

      function greet(p: Person): string {
        return 'Hello, ' + p.name + '!';
      }

      module.exports = greet({ name: 'Alice', age: 30 });
    `,
    );

    const result = container.runFile("/types.ts");
    expect(result.exports).toBe("Hello, Alice!");
  });

  it("TypeScript enums are compiled", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/enums.ts",
      `
      enum Direction {
        Up = 'UP',
        Down = 'DOWN',
      }
      console.log(Direction.Up);
      console.log(Direction.Down);
    `,
    );

    const result = await container.run("node /enums.ts");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("UP");
    expect(result.stdout).toContain("DOWN");
  });

  it("multi-file TypeScript project with imports", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/math.ts",
      `
      export const add = (a: number, b: number): number => a + b;
      export type MathOp = 'add' | 'sub';
    `,
    );
    container.writeFile(
      "/utils.ts",
      `
      export function formatResult(op: string, a: number, b: number, result: number): string {
        return op + '(' + a + ', ' + b + ') = ' + result;
      }
      export type Formatter = (s: string) => string;
    `,
    );
    container.writeFile(
      "/main.ts",
      `
      import { add } from './math';
      import { formatResult } from './utils';
      console.log(formatResult('add', 10, 32, add(10, 32)));
    `,
    );

    const result = await container.run("node /main.ts");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("add(10, 32) = 42");
  });

  it("ESM-to-CJS transform pipeline works with TS", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/lib.ts",
      `
      export default function double(n: number): number { return n * 2; }
      export const triple = (n: number): number => n * 3;
    `,
    );
    container.writeFile(
      "/user.ts",
      `
      import double, { triple } from './lib';
      module.exports = { d: double(5), t: triple(5) };
    `,
    );

    const result = container.runFile("/user.ts");
    expect(result.exports).toEqual({ d: 10, t: 15 });
  });

  it("TypeScript test file pattern from example", async () => {
    container = boot();
    await container.init();

    container.writeFile(
      "/math.ts",
      `
      export function add(a: number, b: number): number { return a + b; }
      export function multiply(a: number, b: number): number { return a * b; }
    `,
    );
    container.writeFile(
      "/test.ts",
      `
      import { add, multiply } from './math';

      interface TestCase { name: string; fn: () => boolean; }

      const tests: TestCase[] = [
        { name: 'add(2, 3) === 5',       fn: () => add(2, 3) === 5 },
        { name: 'multiply(4, 5) === 20', fn: () => multiply(4, 5) === 20 },
      ];

      let passed = 0;
      for (const t of tests) {
        if (t.fn()) { console.log('PASS ' + t.name); passed++; }
        else { console.log('FAIL ' + t.name); }
      }
      console.log('Results: ' + passed + '/' + tests.length);
    `,
    );

    const result = await container.run("node /test.ts");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("PASS add(2, 3) === 5");
    expect(result.stdout).toContain("PASS multiply(4, 5) === 20");
    expect(result.stdout).toContain("Results: 2/2");
  });

  it("boot with autoInstall: true + init — TS transpilation still works", async () => {
    container = boot({ autoInstall: true });
    await container.init();

    container.writeFile(
      "/greet.ts",
      `
      function greet(name: string): string {
        return 'Hello, ' + name + '!';
      }
      module.exports = greet('World');
    `,
    );

    const result = container.runFile("/greet.ts");
    expect(result.exports).toBe("Hello, World!");
  });

  it("boot with autoInstall: true — multi-file TS with interfaces", async () => {
    container = boot({ autoInstall: true });
    await container.init();

    container.writeFile(
      "/types.ts",
      `
      export interface Config { name: string; version: number; }
      export function createConfig(name: string): Config {
        return { name, version: 1 };
      }
    `,
    );
    container.writeFile(
      "/main.ts",
      `
      import { createConfig } from './types';
      const cfg = createConfig('app');
      module.exports = cfg;
    `,
    );

    const result = container.runFile("/main.ts");
    expect(result.exports).toEqual({ name: "app", version: 1 });
  });
});
