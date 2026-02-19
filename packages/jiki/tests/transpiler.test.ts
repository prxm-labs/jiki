import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  initTranspiler,
  transpile,
  transpileSync,
  needsTranspilation,
  isInitialized,
  stopTranspiler,
  bundle,
} from "../src/transpiler";
import { MemFS } from "../src/memfs";

beforeAll(async () => {
  await initTranspiler();
});

afterAll(async () => {
  await stopTranspiler();
});

describe("needsTranspilation", () => {
  it("returns true for .ts files", () => {
    expect(needsTranspilation("main.ts")).toBe(true);
  });

  it("returns true for .tsx files", () => {
    expect(needsTranspilation("component.tsx")).toBe(true);
  });

  it("returns true for .jsx files", () => {
    expect(needsTranspilation("component.jsx")).toBe(true);
  });

  it("returns false for .js files", () => {
    expect(needsTranspilation("main.js")).toBe(false);
  });

  it("returns false for .json files", () => {
    expect(needsTranspilation("data.json")).toBe(false);
  });
});

describe("initTranspiler", () => {
  it("marks transpiler as initialized", () => {
    expect(isInitialized()).toBe(true);
  });

  it("calling init multiple times is idempotent", async () => {
    await initTranspiler();
    await initTranspiler();
    expect(isInitialized()).toBe(true);
  });
});

describe("transpile (async)", () => {
  it("strips type annotations from TypeScript", async () => {
    const code = "const x: number = 42;\nexport default x;\n";
    const result = await transpile(code, "test.ts");
    expect(result).toContain("42");
    expect(result).not.toContain(": number");
  });

  it("strips interfaces", async () => {
    const code = `
interface User {
  name: string;
  age: number;
}
const user: User = { name: "Alice", age: 30 };
export default user;
`;
    const result = await transpile(code, "test.ts");
    expect(result).not.toContain("interface");
    expect(result).toContain("Alice");
  });

  it("strips type aliases", async () => {
    const code = `
type ID = string | number;
const id: ID = "abc";
export default id;
`;
    const result = await transpile(code, "test.ts");
    expect(result).not.toContain("type ID");
    expect(result).toContain("abc");
  });

  it("transforms enums", async () => {
    const code = `
enum Color {
  Red,
  Green,
  Blue,
}
const c = Color.Red;
export default c;
`;
    const result = await transpile(code, "test.ts");
    expect(result).toContain("Red");
    expect(result).not.toContain("enum Color");
  });

  it("handles generic functions", async () => {
    const code = `
function identity<T>(val: T): T {
  return val;
}
export default identity(42);
`;
    const result = await transpile(code, "test.ts");
    expect(result).toContain("identity");
    expect(result).not.toContain("<T>");
  });

  it("transforms TSX with automatic JSX runtime", async () => {
    const code = `
const App = () => <div className="app"><h1>Hello</h1></div>;
export default App;
`;
    const result = await transpile(code, "component.tsx");
    expect(result).not.toContain("<div");
    expect(result).not.toContain("<h1>");
    expect(result).toContain("Hello");
  });

  it("transforms JSX files", async () => {
    const code = `
const Button = (props) => <button onClick={props.onClick}>{props.label}</button>;
export default Button;
`;
    const result = await transpile(code, "button.jsx");
    expect(result).not.toContain("<button");
    expect(result).toContain("onClick");
  });

  it("transforms TSX with fragments", async () => {
    const code = `
const List = () => (
  <>
    <li>One</li>
    <li>Two</li>
  </>
);
export default List;
`;
    const result = await transpile(code, "list.tsx");
    expect(result).not.toContain("<>");
    expect(result).toContain("One");
    expect(result).toContain("Two");
  });

  it("handles empty files", async () => {
    const result = await transpile("", "empty.ts");
    expect(result.trim()).toBe("");
  });

  it("rejects syntax errors in TypeScript", async () => {
    const code = "const x: number = {{{;";
    await expect(transpile(code, "bad.ts")).rejects.toThrow();
  });

  it("preserves async/await syntax", async () => {
    const code = `
async function fetchData(): Promise<string> {
  return "data";
}
export default fetchData;
`;
    const result = await transpile(code, "async.ts");
    expect(result).toContain("async");
    expect(result).toContain("fetchData");
  });
});

describe("transpileSync", () => {
  it("strips type annotations synchronously", () => {
    const code = 'const x: string = "hello";\nexport default x;\n';
    const result = transpileSync(code, "test.ts");
    expect(result).toContain("hello");
    expect(result).not.toContain(": string");
  });

  it("transforms TSX synchronously", () => {
    const code = "const El = () => <span>hi</span>;\nexport default El;\n";
    const result = transpileSync(code, "el.tsx");
    expect(result).not.toContain("<span>");
    expect(result).toContain("hi");
  });
});

describe("bundle", () => {
  it("bundles a single TypeScript file from MemFS", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync("/entry.ts", "const x: number = 42;\nconsole.log(x);\n");

    const result = await bundle(vfs, { entryPoint: "/entry.ts" });
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("42");
  });

  it("bundles multiple files with imports", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync(
      "/utils.ts",
      "export function double(n: number): number { return n * 2; }\n",
    );
    vfs.writeFileSync(
      "/entry.ts",
      'import { double } from "./utils";\nconsole.log(double(21));\n',
    );

    const result = await bundle(vfs, { entryPoint: "/entry.ts" });
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("double");
  });

  it("writes output to outfile in VFS", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync(
      "/src/main.ts",
      'export const greeting: string = "hello";\n',
    );

    await bundle(vfs, {
      entryPoint: "/src/main.ts",
      outfile: "/dist/bundle.js",
    });

    expect(vfs.existsSync("/dist/bundle.js")).toBe(true);
    const output = vfs.readFileSync("/dist/bundle.js", "utf8");
    expect(output).toContain("hello");
  });

  it("bundles with CJS format", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync("/entry.ts", "export const value: number = 99;\n");

    const result = await bundle(vfs, {
      entryPoint: "/entry.ts",
      format: "cjs",
      platform: "node",
    });
    expect(result.code).toContain("exports");
  });

  it("bundles with minification", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync(
      "/entry.ts",
      "export function longFunctionName(a: number, b: number): number { return a + b; }\n",
    );

    const result = await bundle(vfs, {
      entryPoint: "/entry.ts",
      minify: true,
    });
    expect(result.code.length).toBeLessThan(150);
  });

  it("marks external modules as external", async () => {
    const vfs = new MemFS();
    vfs.writeFileSync(
      "/entry.ts",
      'import React from "react";\nconsole.log(React);\n',
    );

    const result = await bundle(vfs, {
      entryPoint: "/entry.ts",
      external: ["react"],
    });
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("react");
  });
});
