import { describe, it, expect, beforeEach } from "vitest";
import { MemFS } from "../../src/memfs";
import { Kernel } from "../../src/kernel";
import { PackageManager } from "../../src/npm/index";
import { PnpmLayout } from "../../src/npm/pnpm";
import { Shell } from "../../src/shell";

describe("PnpmLayout", () => {
  let vfs: MemFS;
  let layout: PnpmLayout;

  beforeEach(() => {
    vfs = new MemFS();
    layout = new PnpmLayout();
  });

  describe("getPackageDir", () => {
    it("returns store path for unscoped package", () => {
      const dir = layout.getPackageDir("/", "react", "18.2.0");
      expect(dir).toBe("/node_modules/.pnpm/react@18.2.0/node_modules/react");
    });

    it("returns store path for scoped package", () => {
      const dir = layout.getPackageDir("/", "@babel/core", "7.24.0");
      expect(dir).toBe(
        "/node_modules/.pnpm/@babel+core@7.24.0/node_modules/@babel/core",
      );
    });

    it("uses cwd prefix", () => {
      const dir = layout.getPackageDir("/app", "lodash", "4.17.21");
      expect(dir).toBe(
        "/app/node_modules/.pnpm/lodash@4.17.21/node_modules/lodash",
      );
    });
  });

  describe("createTopLevelLink", () => {
    it("creates symlink from node_modules/<name> to store", () => {
      const storeDir = layout.getPackageDir("/", "react", "18.2.0");
      vfs.mkdirSync(storeDir, { recursive: true });

      layout.createTopLevelLink(vfs, "/", "react", "18.2.0");

      const link = vfs.readlinkSync("/node_modules/react");
      expect(link).toBe("/node_modules/.pnpm/react@18.2.0/node_modules/react");
    });

    it("creates scope directory for scoped packages", () => {
      const storeDir = layout.getPackageDir("/", "@types/node", "20.0.0");
      vfs.mkdirSync(storeDir, { recursive: true });

      layout.createTopLevelLink(vfs, "/", "@types/node", "20.0.0");

      expect(vfs.existsSync("/node_modules/@types")).toBe(true);
      const link = vfs.readlinkSync("/node_modules/@types/node");
      expect(link).toBe(
        "/node_modules/.pnpm/@types+node@20.0.0/node_modules/@types/node",
      );
    });

    it("is idempotent (does not throw on duplicate call)", () => {
      const storeDir = layout.getPackageDir("/", "react", "18.2.0");
      vfs.mkdirSync(storeDir, { recursive: true });

      layout.createTopLevelLink(vfs, "/", "react", "18.2.0");
      expect(() =>
        layout.createTopLevelLink(vfs, "/", "react", "18.2.0"),
      ).not.toThrow();
    });
  });

  describe("createDependencyLinks", () => {
    it("creates symlinks between store entries for deps", () => {
      const reactDir = layout.getPackageDir("/", "react", "18.2.0");
      const reactDomDir = layout.getPackageDir("/", "react-dom", "18.2.0");
      vfs.mkdirSync(reactDir, { recursive: true });
      vfs.mkdirSync(reactDomDir, { recursive: true });

      const reactDomPkg = {
        name: "react-dom",
        version: "18.2.0",
        dependencies: { react: "^18.0.0" },
        dist: { tarball: "", shasum: "" },
      };
      const allResolved = new Map([
        [
          "react",
          {
            name: "react",
            version: "18.2.0",
            dependencies: {},
            dist: { tarball: "", shasum: "" },
          },
        ],
        ["react-dom", reactDomPkg],
      ]);

      layout.createDependencyLinks(vfs, "/", reactDomPkg, allResolved);

      const depLink = "/node_modules/.pnpm/react-dom@18.2.0/node_modules/react";
      const target = vfs.readlinkSync(depLink);
      expect(target).toBe(
        "/node_modules/.pnpm/react@18.2.0/node_modules/react",
      );
    });

    it("skips dependencies not in the resolved map", () => {
      const pkgDir = layout.getPackageDir("/", "my-lib", "1.0.0");
      vfs.mkdirSync(pkgDir, { recursive: true });

      const pkg = {
        name: "my-lib",
        version: "1.0.0",
        dependencies: { "missing-dep": "^1.0.0" },
        dist: { tarball: "", shasum: "" },
      };
      const allResolved = new Map([["my-lib", pkg]]);

      expect(() =>
        layout.createDependencyLinks(vfs, "/", pkg, allResolved),
      ).not.toThrow();
    });

    it("handles scoped sub-dependencies", () => {
      const libDir = layout.getPackageDir("/", "my-lib", "1.0.0");
      const scopedDir = layout.getPackageDir("/", "@scope/util", "2.0.0");
      vfs.mkdirSync(libDir, { recursive: true });
      vfs.mkdirSync(scopedDir, { recursive: true });

      const pkg = {
        name: "my-lib",
        version: "1.0.0",
        dependencies: { "@scope/util": "^2.0.0" },
        dist: { tarball: "", shasum: "" },
      };
      const allResolved = new Map([
        ["my-lib", pkg],
        [
          "@scope/util",
          {
            name: "@scope/util",
            version: "2.0.0",
            dependencies: {},
            dist: { tarball: "", shasum: "" },
          },
        ],
      ]);

      layout.createDependencyLinks(vfs, "/", pkg, allResolved);

      const depLink =
        "/node_modules/.pnpm/my-lib@1.0.0/node_modules/@scope/util";
      const target = vfs.readlinkSync(depLink);
      expect(target).toBe(
        "/node_modules/.pnpm/@scope+util@2.0.0/node_modules/@scope/util",
      );
    });
  });

  describe("createBinStub", () => {
    it("writes bin stub to .bin directory", () => {
      layout.createBinStub(
        vfs,
        "/",
        "vite",
        "/node_modules/.pnpm/vite@5.0.0/node_modules/vite/bin/vite.js",
      );

      const stubContent = vfs.readFileSync("/node_modules/.bin/vite", "utf8");
      expect(stubContent).toContain("#!/usr/bin/env node");
      expect(stubContent).toContain("vite/bin/vite.js");
    });
  });
});

describe("PackageManager with PnpmLayout", () => {
  let vfs: MemFS;
  let pm: PackageManager;

  beforeEach(() => {
    vfs = new MemFS();
    pm = new PackageManager(vfs, { cwd: "/", layout: new PnpmLayout() });
  });

  it("uses pnpm layout when constructed with PnpmLayout", () => {
    expect(pm.layout).toBeInstanceOf(PnpmLayout);
  });

  it("list() returns top-level packages from symlinks", () => {
    const layout = new PnpmLayout();
    const storeDir = layout.getPackageDir("/", "lodash", "4.17.21");
    vfs.mkdirSync(storeDir, { recursive: true });
    vfs.writeFileSync(storeDir + "/index.js", "module.exports = {}");
    layout.createTopLevelLink(vfs, "/", "lodash", "4.17.21");

    const packages = pm.list();
    expect(packages).toContain("lodash");
  });
});

describe("Shell pnpm command", () => {
  let vfs: MemFS;
  let runtime: Kernel;
  let npmPm: PackageManager;
  let pnpmPm: PackageManager;
  let shell: Shell;

  beforeEach(() => {
    vfs = new MemFS();
    runtime = new Kernel(vfs, { cwd: "/" });
    npmPm = new PackageManager(vfs, { cwd: "/" });
    pnpmPm = new PackageManager(vfs, { cwd: "/", layout: new PnpmLayout() });
    shell = new Shell(vfs, runtime, npmPm, { cwd: "/", pnpmPm });
  });

  it("pnpm without pnpmPm configured returns error", async () => {
    const shellNoPnpm = new Shell(vfs, runtime, npmPm, { cwd: "/" });
    const result = await shellNoPnpm.exec("pnpm install");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not configured");
  });

  it("pnpm ls works", async () => {
    const layout = new PnpmLayout();
    const dir = layout.getPackageDir("/", "test-pkg", "1.0.0");
    vfs.mkdirSync(dir, { recursive: true });
    vfs.writeFileSync(dir + "/index.js", "");
    layout.createTopLevelLink(vfs, "/", "test-pkg", "1.0.0");

    const result = await shell.exec("pnpm ls");
    expect(result.stdout).toContain("test-pkg");
    expect(result.exitCode).toBe(0);
  });

  it("pnpm run executes a script from package.json", async () => {
    vfs.writeFileSync(
      "/package.json",
      JSON.stringify({
        name: "test",
        scripts: { hello: "echo pnpm-hello" },
      }),
    );

    const result = await shell.exec("pnpm run hello");
    expect(result.stdout).toContain("pnpm-hello");
    expect(result.exitCode).toBe(0);
  });

  it("pnpm run missing script returns error", async () => {
    vfs.writeFileSync(
      "/package.json",
      JSON.stringify({ name: "test", scripts: {} }),
    );

    const result = await shell.exec("pnpm run missing");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not found");
  });

  it("pnpm unknown subcommand returns error", async () => {
    const result = await shell.exec("pnpm foobar");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown command");
  });

  it("which pnpm returns a path", async () => {
    const result = await shell.exec("which pnpm");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("pnpm");
  });
});
