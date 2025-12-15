import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../src/container";

describe("Shell: npm install command", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("npm install <pkg> saves to dependencies by default", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );

    const result = await container.run("npm install is-number");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.dependencies).toBeDefined();
    expect(pkgJson.dependencies["is-number"]).toBeDefined();
    expect(pkgJson.dependencies["is-number"]).toMatch(/^\^/);
  });

  it("npm install <pkg> --save-dev saves to devDependencies", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );

    const result = await container.run("npm install is-number --save-dev");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.devDependencies).toBeDefined();
    expect(pkgJson.devDependencies["is-number"]).toBeDefined();
    expect(pkgJson.dependencies).toBeUndefined();
  });

  it("npm install <pkg> -D saves to devDependencies", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );

    const result = await container.run("npm install is-number -D");
    expect(result.exitCode).toBe(0);

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.devDependencies["is-number"]).toBeDefined();
  });

  it("npm install <pkg> --no-save does not update package.json", async () => {
    container = boot();
    const original = JSON.stringify({ name: "test", version: "1.0.0" });
    container.writeFile("/package.json", original);

    const result = await container.run("npm install is-number --no-save");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);

    const pkgJson = container.readFile("/package.json");
    expect(JSON.parse(pkgJson)).toEqual({ name: "test", version: "1.0.0" });
  });

  it("npm install <pkg> returns stdout with progress and summary", async () => {
    container = boot();

    const result = await container.run("npm install is-number");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("added");
    expect(result.stdout).toContain("packages");
  });

  it("npm install <pkg> streams progress via onStdout", async () => {
    container = boot();

    const streamed: string[] = [];
    const result = await container.run("npm install is-number", {
      onStdout: data => streamed.push(data),
    });
    expect(result.exitCode).toBe(0);
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed.some(s => s.includes("added"))).toBe(true);
  });

  it("npm install (no args) calls installFromPackageJson", async () => {
    container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        dependencies: { "is-number": "*" },
      }),
    );

    const result = await container.run("npm install");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(result.stdout).toContain("added");
  });

  it("npm install creates package.json if it does not exist", async () => {
    container = boot();

    const result = await container.run("npm install is-number");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);
    expect(container.exists("/package.json")).toBe(true);

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.dependencies["is-number"]).toBeDefined();
  });
});

describe("Shell: pnpm install command", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("pnpm install <pkg> saves to dependencies by default", async () => {
    container = new Container({ packageManager: "pnpm" });
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );

    const result = await container.run("pnpm install is-number");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);

    const pkgJson = JSON.parse(container.readFile("/package.json"));
    expect(pkgJson.dependencies).toBeDefined();
    expect(pkgJson.dependencies["is-number"]).toBeDefined();
  });

  it("pnpm install <pkg> returns progress and summary", async () => {
    container = new Container({ packageManager: "pnpm" });

    const result = await container.run("pnpm install is-number");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("added");
    expect(result.stdout).toContain("packages");
  });

  it("pnpm install <pkg> --no-save does not update package.json", async () => {
    container = new Container({ packageManager: "pnpm" });
    const original = JSON.stringify({ name: "test", version: "1.0.0" });
    container.writeFile("/package.json", original);

    const result = await container.run("pnpm install is-number --no-save");
    expect(result.exitCode).toBe(0);
    expect(container.exists("/node_modules/is-number")).toBe(true);

    const pkgJson = container.readFile("/package.json");
    expect(JSON.parse(pkgJson)).toEqual({ name: "test", version: "1.0.0" });
  });
});

describe("Shell: ShellContext streaming", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("onStdout receives streaming data from commands", async () => {
    container = boot();
    const chunks: string[] = [];
    await container.run("echo hello", {
      onStdout: data => chunks.push(data),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("hello");
  });

  it("onStderr receives error output", async () => {
    container = boot();
    const chunks: string[] = [];
    await container.run("nonexistentcmd", {
      onStderr: data => chunks.push(data),
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("command not found");
  });
});
