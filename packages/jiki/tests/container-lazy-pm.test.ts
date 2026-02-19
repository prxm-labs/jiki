import { describe, it, expect } from "vitest";
import { Container, boot } from "../src/container";

describe("Lazy PackageManager initialization", () => {
  it("npm container does not eagerly create pnpm PackageManager", () => {
    const container = boot();
    expect(container.packageManager).toBeDefined();
    expect(container.packageManager.layout.constructor.name).toBe("NpmLayout");
    container.destroy();
  });

  it("pnpm container uses PnpmLayout directly", () => {
    const container = new Container({ packageManager: "pnpm" });
    expect(container.packageManager).toBeDefined();
    expect(container.packageManager.layout.constructor.name).toBe("PnpmLayout");
    container.destroy();
  });

  it("npm container still supports pnpm command via lazy init", async () => {
    const container = boot();
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );
    const result = await container.run("pnpm ls");
    expect(result.exitCode).toBe(0);
    container.destroy();
  });

  it("pnpm container does not need lazy init", async () => {
    const container = new Container({ packageManager: "pnpm" });
    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        version: "1.0.0",
      }),
    );
    const result = await container.run("pnpm ls");
    expect(result.exitCode).toBe(0);
    container.destroy();
  });

  it("boot with no options defaults to npm layout", () => {
    const container = boot();
    expect(container.packageManager.layout.constructor.name).toBe("NpmLayout");
    container.destroy();
  });
});
