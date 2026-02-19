import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";
import { MemFS } from "../../src/memfs";
import { Kernel } from "../../src/kernel";
import { ModuleResolver } from "../../src/module-resolver";
import type { AutoInstallProvider } from "../../src/module-resolver";
import { createFsShim } from "../../src/polyfills/fs";
import { createProcess } from "../../src/polyfills/process";

describe("Integration: auto-install workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("autoInstall option is accepted by Container", () => {
    container = new Container({ autoInstall: true });
    expect(container).toBeDefined();
    expect(container.runtime).toBeDefined();
  });

  it("ModuleResolver supports autoInstallProvider interface", () => {
    const vfs = new MemFS();
    const proc = createProcess({ cwd: "/" });
    const fsShim = createFsShim(vfs, () => proc.cwd());
    const cache: Record<string, any> = {};
    const installed: string[] = [];

    const mockProvider: AutoInstallProvider = {
      installSync(name: string) {
        installed.push(name);
        vfs.mkdirSync(`/node_modules/${name}`, { recursive: true });
        vfs.writeFileSync(
          `/node_modules/${name}/package.json`,
          JSON.stringify({ name, version: "1.0.0", main: "index.js" }),
        );
        vfs.writeFileSync(
          `/node_modules/${name}/index.js`,
          `module.exports = { name: "${name}", autoInstalled: true };`,
        );
      },
    };

    const resolver = new ModuleResolver(
      vfs,
      fsShim,
      proc,
      cache,
      { autoInstall: true, autoInstallProvider: mockProvider },
      new Map(),
    );

    const requireFn = resolver.makeRequire("/");
    const result = requireFn("fake-package") as {
      name: string;
      autoInstalled: boolean;
    };

    expect(result.name).toBe("fake-package");
    expect(result.autoInstalled).toBe(true);
    expect(installed).toContain("fake-package");
  });

  it("autoInstallProvider is not called for builtin modules", () => {
    const vfs = new MemFS();
    const proc = createProcess({ cwd: "/" });
    const fsShim = createFsShim(vfs, () => proc.cwd());
    const cache: Record<string, any> = {};
    const installed: string[] = [];

    const mockProvider: AutoInstallProvider = {
      installSync(name: string) {
        installed.push(name);
      },
    };

    const resolver = new ModuleResolver(
      vfs,
      fsShim,
      proc,
      cache,
      { autoInstall: true, autoInstallProvider: mockProvider },
      new Map(),
    );

    const requireFn = resolver.makeRequire("/");
    const path = requireFn("path") as { join: Function };
    expect(path.join).toBeDefined();
    expect(installed).not.toContain("path");
  });

  it("autoInstallProvider is not called for relative requires", () => {
    const vfs = new MemFS();
    vfs.writeFileSync("/lib.js", "module.exports = 42;");
    const proc = createProcess({ cwd: "/" });
    const fsShim = createFsShim(vfs, () => proc.cwd());
    const cache: Record<string, any> = {};
    const installed: string[] = [];

    const mockProvider: AutoInstallProvider = {
      installSync(name: string) {
        installed.push(name);
      },
    };

    const resolver = new ModuleResolver(
      vfs,
      fsShim,
      proc,
      cache,
      { autoInstall: true, autoInstallProvider: mockProvider },
      new Map(),
    );

    const requireFn = resolver.makeRequire("/");
    const result = requireFn("./lib");
    expect(result).toBe(42);
    expect(installed).toHaveLength(0);
  });

  it("autoInstall throws when provider fails and no module found", () => {
    const vfs = new MemFS();
    const proc = createProcess({ cwd: "/" });
    const fsShim = createFsShim(vfs, () => proc.cwd());
    const cache: Record<string, any> = {};

    const mockProvider: AutoInstallProvider = {
      installSync() {
        throw new Error("Registry error");
      },
    };

    const resolver = new ModuleResolver(
      vfs,
      fsShim,
      proc,
      cache,
      { autoInstall: true, autoInstallProvider: mockProvider },
      new Map(),
    );

    const requireFn = resolver.makeRequire("/");
    expect(() => requireFn("nonexistent-package")).toThrow(
      /Cannot find module/,
    );
  });

  it("autoInstallProvider handles scoped packages", () => {
    const vfs = new MemFS();
    const proc = createProcess({ cwd: "/" });
    const fsShim = createFsShim(vfs, () => proc.cwd());
    const cache: Record<string, any> = {};
    const installed: string[] = [];

    const mockProvider: AutoInstallProvider = {
      installSync(name: string) {
        installed.push(name);
        vfs.mkdirSync(`/node_modules/${name}`, { recursive: true });
        vfs.writeFileSync(
          `/node_modules/${name}/package.json`,
          JSON.stringify({ name, version: "1.0.0", main: "index.js" }),
        );
        vfs.writeFileSync(
          `/node_modules/${name}/index.js`,
          `module.exports = "${name}";`,
        );
      },
    };

    const resolver = new ModuleResolver(
      vfs,
      fsShim,
      proc,
      cache,
      { autoInstall: true, autoInstallProvider: mockProvider },
      new Map(),
    );

    const requireFn = resolver.makeRequire("/");
    const result = requireFn("@scope/my-pkg");
    expect(result).toBe("@scope/my-pkg");
    expect(installed).toContain("@scope/my-pkg");
  });

  it("without autoInstall, missing modules throw immediately", () => {
    const vfs = new MemFS();
    const proc = createProcess({ cwd: "/" });
    const fsShim = createFsShim(vfs, () => proc.cwd());
    const cache: Record<string, any> = {};

    const resolver = new ModuleResolver(
      vfs,
      fsShim,
      proc,
      cache,
      { autoInstall: false },
      new Map(),
    );

    const requireFn = resolver.makeRequire("/");
    expect(() => requireFn("missing-package")).toThrow(/Cannot find module/);
  });
});
