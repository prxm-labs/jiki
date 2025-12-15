import { describe, it, expect, vi } from "vitest";
import { MemFS } from "../../src/memfs";
import { PackageManager } from "../../src/npm/index";

// Mock the tarball download to avoid real network calls
vi.mock("../../src/npm/tarball", () => ({
  downloadAndExtract: async (url: string, vfs: any, destDir: string) => {
    // Just create the directory to simulate extraction
    vfs.mkdirSync(destDir, { recursive: true });
    vfs.writeFileSync(
      `${destDir}/package.json`,
      JSON.stringify({ name: "mock", version: "1.0.0" }),
    );
  },
}));

describe("Package deduplication (Finding #33)", () => {
  it("keeps the higher version when two specs resolve the same package", async () => {
    const vfs = new MemFS();

    // Create a mock registry that returns different versions for different ranges
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const name = url.split("/").pop();
      if (name === "shared-dep") {
        return {
          ok: true,
          json: async () => ({
            name: "shared-dep",
            "dist-tags": { latest: "2.0.0" },
            versions: {
              "1.0.0": {
                name: "shared-dep",
                version: "1.0.0",
                dependencies: {},
                dist: {
                  tarball: "https://example.com/shared-dep-1.0.0.tgz",
                  shasum: "a",
                },
              },
              "2.0.0": {
                name: "shared-dep",
                version: "2.0.0",
                dependencies: {},
                dist: {
                  tarball: "https://example.com/shared-dep-2.0.0.tgz",
                  shasum: "b",
                },
              },
            },
          }),
        };
      }
      if (name === "pkg-a") {
        return {
          ok: true,
          json: async () => ({
            name: "pkg-a",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "pkg-a",
                version: "1.0.0",
                dependencies: { "shared-dep": "^1.0.0" },
                dist: {
                  tarball: "https://example.com/pkg-a-1.0.0.tgz",
                  shasum: "c",
                },
              },
            },
          }),
        };
      }
      if (name === "pkg-b") {
        return {
          ok: true,
          json: async () => ({
            name: "pkg-b",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "pkg-b",
                version: "1.0.0",
                dependencies: { "shared-dep": "^2.0.0" },
                dist: {
                  tarball: "https://example.com/pkg-b-1.0.0.tgz",
                  shasum: "d",
                },
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const pm = new PackageManager(vfs, { cwd: "/" });

      // Install both packages - shared-dep should be deduped to higher version
      const result = await pm.install(["pkg-a", "pkg-b"]);

      expect(result.installed.has("shared-dep")).toBe(true);
      // The dedup logic should keep the higher version (2.0.0)
      expect(result.installed.get("shared-dep")!.version).toBe("2.0.0");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("skips re-downloading packages already on disk", async () => {
    const vfs = new MemFS();

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const name = url.split("/").pop();
      if (name === "already-installed") {
        return {
          ok: true,
          json: async () => ({
            name: "already-installed",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "already-installed",
                version: "1.0.0",
                dependencies: {},
                dist: {
                  tarball: "https://example.com/already-1.0.0.tgz",
                  shasum: "x",
                },
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      // Pre-create the package directory to simulate already installed
      vfs.mkdirSync("/node_modules/already-installed", { recursive: true });
      vfs.writeFileSync(
        "/node_modules/already-installed/package.json",
        JSON.stringify({ name: "already-installed", version: "1.0.0" }),
      );

      const pm = new PackageManager(vfs, { cwd: "/" });
      const result = await pm.install("already-installed");

      // Package should be resolved but not re-added
      expect(result.installed.has("already-installed")).toBe(true);
      expect(result.added).not.toContain("already-installed@1.0.0");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
