import { describe, it, expect } from "vitest";
import { MemFS } from "../../src/memfs";
import {
  discoverWorkspaces,
  resolveWorkspaceDep,
  isWorkspaceProtocol,
  linkWorkspaces,
} from "../../src/npm/workspaces";

describe("discoverWorkspaces", () => {
  it("discovers packages from package.json workspaces array", () => {
    const vfs = new MemFS();
    vfs.mkdirSync("/packages/utils", { recursive: true });
    vfs.mkdirSync("/packages/core", { recursive: true });
    vfs.writeFileSync(
      "/package.json",
      JSON.stringify({ workspaces: ["packages/*"] }),
    );
    vfs.writeFileSync(
      "/packages/utils/package.json",
      JSON.stringify({ name: "@app/utils", version: "1.0.0" }),
    );
    vfs.writeFileSync(
      "/packages/core/package.json",
      JSON.stringify({ name: "@app/core", version: "2.0.0" }),
    );

    const ws = discoverWorkspaces(vfs, "/");
    expect(ws).toHaveLength(2);
    expect(ws.find(w => w.name === "@app/utils")).toBeDefined();
    expect(ws.find(w => w.name === "@app/core")!.version).toBe("2.0.0");
  });

  it("discovers packages from pnpm-workspace.yaml", () => {
    const vfs = new MemFS();
    vfs.mkdirSync("/apps/web", { recursive: true });
    vfs.writeFileSync("/pnpm-workspace.yaml", "packages:\n  - 'apps/*'\n");
    vfs.writeFileSync(
      "/apps/web/package.json",
      JSON.stringify({ name: "web-app", version: "0.1.0" }),
    );

    const ws = discoverWorkspaces(vfs, "/");
    expect(ws).toHaveLength(1);
    expect(ws[0].name).toBe("web-app");
  });

  it("returns empty for non-monorepo", () => {
    const vfs = new MemFS();
    vfs.writeFileSync("/package.json", JSON.stringify({ name: "solo" }));
    expect(discoverWorkspaces(vfs, "/")).toEqual([]);
  });

  it("handles nested workspaces object format", () => {
    const vfs = new MemFS();
    vfs.mkdirSync("/packages/ui", { recursive: true });
    vfs.writeFileSync(
      "/package.json",
      JSON.stringify({ workspaces: { packages: ["packages/*"] } }),
    );
    vfs.writeFileSync(
      "/packages/ui/package.json",
      JSON.stringify({ name: "@app/ui", version: "1.0.0" }),
    );

    const ws = discoverWorkspaces(vfs, "/");
    expect(ws).toHaveLength(1);
  });

  it("skips directories without package.json", () => {
    const vfs = new MemFS();
    vfs.mkdirSync("/packages/empty", { recursive: true });
    vfs.mkdirSync("/packages/valid", { recursive: true });
    vfs.writeFileSync(
      "/package.json",
      JSON.stringify({ workspaces: ["packages/*"] }),
    );
    vfs.writeFileSync(
      "/packages/valid/package.json",
      JSON.stringify({ name: "valid", version: "1.0.0" }),
    );

    const ws = discoverWorkspaces(vfs, "/");
    expect(ws).toHaveLength(1);
    expect(ws[0].name).toBe("valid");
  });
});

describe("resolveWorkspaceDep", () => {
  const workspaces = [
    { name: "@app/utils", path: "/packages/utils", version: "1.0.0" },
    { name: "@app/core", path: "/packages/core", version: "2.0.0" },
  ];

  it("resolves a workspace package by name", () => {
    const result = resolveWorkspaceDep("@app/utils", workspaces);
    expect(result).not.toBeNull();
    expect(result!.path).toBe("/packages/utils");
  });

  it("returns null for non-workspace package", () => {
    expect(resolveWorkspaceDep("react", workspaces)).toBeNull();
  });
});

describe("isWorkspaceProtocol", () => {
  it("detects workspace: prefix", () => {
    expect(isWorkspaceProtocol("workspace:*")).toBe(true);
    expect(isWorkspaceProtocol("workspace:^1.0.0")).toBe(true);
    expect(isWorkspaceProtocol("^1.0.0")).toBe(false);
  });
});

describe("linkWorkspaces", () => {
  it("creates symlinks in node_modules", () => {
    const vfs = new MemFS();
    vfs.mkdirSync("/packages/utils", { recursive: true });
    vfs.writeFileSync("/packages/utils/package.json", "{}");

    linkWorkspaces(vfs, "/", [
      { name: "utils", path: "/packages/utils", version: "1.0.0" },
    ]);

    expect(vfs.existsSync("/node_modules/utils")).toBe(true);
  });

  it("creates scoped package symlinks", () => {
    const vfs = new MemFS();
    vfs.mkdirSync("/packages/core", { recursive: true });

    linkWorkspaces(vfs, "/", [
      { name: "@app/core", path: "/packages/core", version: "1.0.0" },
    ]);

    expect(vfs.existsSync("/node_modules/@app/core")).toBe(true);
  });
});
