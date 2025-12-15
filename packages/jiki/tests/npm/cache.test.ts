import { describe, it, expect, beforeEach, vi } from "vitest";
import { PackageCache } from "../../src/npm/cache";
import type { PackageManifest } from "../../src/npm/registry";

function mockManifest(name: string): PackageManifest {
  return {
    name,
    "dist-tags": { latest: "1.0.0" },
    versions: {
      "1.0.0": {
        name,
        version: "1.0.0",
        dist: {
          tarball: `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`,
          shasum: "abc123",
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// PackageCache unit tests
// ---------------------------------------------------------------------------
describe("PackageCache", () => {
  let cache: PackageCache;

  beforeEach(() => {
    cache = new PackageCache();
  });

  describe("manifests", () => {
    it("starts with zero manifests", () => {
      expect(cache.manifestCount).toBe(0);
    });

    it("getManifest calls fetcher on first access", async () => {
      const fetcher = vi.fn().mockResolvedValue(mockManifest("react"));
      const result = await cache.getManifest("react", fetcher);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(result.name).toBe("react");
      expect(cache.manifestCount).toBe(1);
    });

    it("getManifest returns cached value on second access", async () => {
      const fetcher = vi.fn().mockResolvedValue(mockManifest("react"));
      await cache.getManifest("react", fetcher);
      const second = await cache.getManifest("react", fetcher);
      expect(fetcher).toHaveBeenCalledOnce(); // not called again
      expect(second.name).toBe("react");
    });

    it("hasManifest returns true for cached, false for uncached", async () => {
      expect(cache.hasManifest("react")).toBe(false);
      await cache.getManifest("react", async () => mockManifest("react"));
      expect(cache.hasManifest("react")).toBe(true);
    });

    it("expired manifests are re-fetched", async () => {
      // Use a 1ms TTL so it expires immediately
      const shortCache = new PackageCache({ manifestTtlMs: 1 });
      const fetcher = vi.fn().mockResolvedValue(mockManifest("react"));

      await shortCache.getManifest("react", fetcher);
      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 5));
      await shortCache.getManifest("react", fetcher);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("evicts oldest manifest when max is reached", async () => {
      const tinyCache = new PackageCache({ maxManifests: 2 });
      await tinyCache.getManifest("a", async () => mockManifest("a"));
      await tinyCache.getManifest("b", async () => mockManifest("b"));
      await tinyCache.getManifest("c", async () => mockManifest("c"));

      expect(tinyCache.manifestCount).toBe(2);
      expect(tinyCache.hasManifest("a")).toBe(false); // evicted
      expect(tinyCache.hasManifest("c")).toBe(true);
    });

    it("clearManifests removes all manifests", async () => {
      await cache.getManifest("react", async () => mockManifest("react"));
      cache.clearManifests();
      expect(cache.manifestCount).toBe(0);
    });
  });

  describe("tarballs", () => {
    const url = "https://registry.npmjs.org/react/-/react-18.0.0.tgz";
    const data = new Uint8Array([1, 2, 3, 4]);

    it("starts with zero tarballs", () => {
      expect(cache.tarballCount).toBe(0);
      expect(cache.tarballBytes).toBe(0);
    });

    it("getTarball calls fetcher on first access", async () => {
      const fetcher = vi.fn().mockResolvedValue(data);
      const result = await cache.getTarball(url, fetcher);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(result).toEqual(data);
      expect(cache.tarballCount).toBe(1);
    });

    it("getTarball returns cached value on second access", async () => {
      const fetcher = vi.fn().mockResolvedValue(data);
      await cache.getTarball(url, fetcher);
      const second = await cache.getTarball(url, fetcher);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(second).toEqual(data);
    });

    it("hasTarball returns true for cached, false for uncached", async () => {
      expect(cache.hasTarball(url)).toBe(false);
      await cache.getTarball(url, async () => data);
      expect(cache.hasTarball(url)).toBe(true);
    });

    it("tarballBytes tracks total size", async () => {
      await cache.getTarball("url1", async () => new Uint8Array(100));
      await cache.getTarball("url2", async () => new Uint8Array(200));
      expect(cache.tarballBytes).toBe(300);
    });

    it("evicts oldest tarball when max is reached", async () => {
      const tinyCache = new PackageCache({ maxTarballs: 2 });
      await tinyCache.getTarball("a", async () => new Uint8Array(1));
      await tinyCache.getTarball("b", async () => new Uint8Array(1));
      await tinyCache.getTarball("c", async () => new Uint8Array(1));

      expect(tinyCache.tarballCount).toBe(2);
      expect(tinyCache.hasTarball("a")).toBe(false);
      expect(tinyCache.hasTarball("c")).toBe(true);
    });

    it("clearTarballs removes all tarballs", async () => {
      await cache.getTarball(url, async () => data);
      cache.clearTarballs();
      expect(cache.tarballCount).toBe(0);
    });
  });

  describe("clear", () => {
    it("clears both manifests and tarballs", async () => {
      await cache.getManifest("react", async () => mockManifest("react"));
      await cache.getTarball("url", async () => new Uint8Array(1));
      cache.clear();
      expect(cache.manifestCount).toBe(0);
      expect(cache.tarballCount).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// PackageManager + cache integration
// ---------------------------------------------------------------------------
describe("PackageManager cache integration", () => {
  it("PackageManager has a cache property", async () => {
    // Dynamic import to avoid pulling in full npm deps at top level
    const { PackageManager } = await import("../../src/npm/index");
    const { MemFS } = await import("../../src/memfs");

    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/" });
    expect(pm.cache).toBeDefined();
    expect(pm.cache.manifestCount).toBe(0);
  });

  it("PackageManager.clearCache clears the cache", async () => {
    const { PackageManager } = await import("../../src/npm/index");
    const { MemFS } = await import("../../src/memfs");

    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/" });
    pm.cache.setManifest("test", mockManifest("test"));
    expect(pm.cache.manifestCount).toBe(1);

    pm.clearCache();
    expect(pm.cache.manifestCount).toBe(0);
  });

  it("accepts a custom PackageCache", async () => {
    const { PackageManager } = await import("../../src/npm/index");
    const { MemFS } = await import("../../src/memfs");

    const customCache = new PackageCache({ manifestTtlMs: 5000 });
    const vfs = new MemFS();
    const pm = new PackageManager(vfs, { cwd: "/", cache: customCache });
    expect(pm.cache).toBe(customCache);
  });
});
