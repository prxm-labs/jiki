import { describe, it, expect } from "vitest";
import {
  satisfies,
  compareVersions,
  findBestVersion,
  mergePeerDeps,
  SemVer,
  resolveDependencies,
} from "../../src/npm/resolver";

describe("npm resolver - semver", () => {
  describe("satisfies", () => {
    it('"1.2.3" satisfies "^1.0.0"', () => {
      expect(satisfies("1.2.3", "^1.0.0")).toBe(true);
    });

    it('"1.2.3" satisfies "~1.2.0"', () => {
      expect(satisfies("1.2.3", "~1.2.0")).toBe(true);
    });

    it('"1.2.3" satisfies ">=1.0.0"', () => {
      expect(satisfies("1.2.3", ">=1.0.0")).toBe(true);
    });

    it('"1.2.3" satisfies "*"', () => {
      expect(satisfies("1.2.3", "*")).toBe(true);
    });

    it('"1.2.3" satisfies "1.2.3" (exact)', () => {
      expect(satisfies("1.2.3", "1.2.3")).toBe(true);
    });

    it('"1.2.3" satisfies "1" (partial major)', () => {
      expect(satisfies("1.2.3", "1")).toBe(true);
    });

    it('"1.2.3" satisfies "1.2" (partial major.minor)', () => {
      expect(satisfies("1.2.3", "1.2")).toBe(true);
    });
  });

  describe("satisfies negatives", () => {
    it('"2.0.0" does NOT satisfy "^1.0.0"', () => {
      expect(satisfies("2.0.0", "^1.0.0")).toBe(false);
    });

    it('"1.3.0" does NOT satisfy "~1.2.0"', () => {
      expect(satisfies("1.3.0", "~1.2.0")).toBe(false);
    });

    it('"0.9.0" does NOT satisfy ">=1.0.0"', () => {
      expect(satisfies("0.9.0", ">=1.0.0")).toBe(false);
    });

    it('"2.0.0" does NOT satisfy "1.2.3" (exact)', () => {
      expect(satisfies("2.0.0", "1.2.3")).toBe(false);
    });
  });

  describe("satisfies ranges", () => {
    it('union: "1.5.0" satisfies "^1.0.0 || ^2.0.0"', () => {
      expect(satisfies("1.5.0", "^1.0.0 || ^2.0.0")).toBe(true);
    });

    it('union: "2.1.0" satisfies "^1.0.0 || ^2.0.0"', () => {
      expect(satisfies("2.1.0", "^1.0.0 || ^2.0.0")).toBe(true);
    });

    it('union negative: "3.0.0" does NOT satisfy "^1.0.0 || ^2.0.0"', () => {
      expect(satisfies("3.0.0", "^1.0.0 || ^2.0.0")).toBe(false);
    });

    it('hyphen range: "1.5.0" satisfies "1.0.0 - 2.0.0"', () => {
      expect(satisfies("1.5.0", "1.0.0 - 2.0.0")).toBe(true);
    });

    it('hyphen range: "2.1.0" does NOT satisfy "1.0.0 - 2.0.0"', () => {
      expect(satisfies("2.1.0", "1.0.0 - 2.0.0")).toBe(false);
    });
  });

  describe("compareVersions", () => {
    it('"1.0.0" < "1.0.1"', () => {
      expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
    });

    it('"1.0.1" < "1.1.0"', () => {
      expect(compareVersions("1.0.1", "1.1.0")).toBeLessThan(0);
    });

    it('"1.1.0" < "2.0.0"', () => {
      expect(compareVersions("1.1.0", "2.0.0")).toBeLessThan(0);
    });

    it('"1.0.0" == "1.0.0"', () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    it('"2.0.0" > "1.0.0"', () => {
      expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
    });

    it("pre-release ordering: release > pre-release", () => {
      expect(compareVersions("1.0.0", "1.0.0-alpha")).toBeGreaterThan(0);
    });
  });

  describe("findBestVersion", () => {
    it("picks highest matching version", () => {
      const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
      expect(findBestVersion(versions, "^1.0.0")).toBe("1.2.0");
    });

    it("returns null when no match", () => {
      const versions = ["1.0.0", "1.1.0"];
      expect(findBestVersion(versions, "^2.0.0")).toBeNull();
    });

    it("exact version match", () => {
      const versions = ["1.0.0", "1.1.0", "1.2.0"];
      expect(findBestVersion(versions, "1.1.0")).toBe("1.1.0");
    });

    it("tilde range", () => {
      const versions = ["1.2.0", "1.2.5", "1.3.0"];
      expect(findBestVersion(versions, "~1.2.0")).toBe("1.2.5");
    });
  });

  describe("caret range (^)", () => {
    it("^1.2.3 matches 1.2.3", () => {
      expect(satisfies("1.2.3", "^1.2.3")).toBe(true);
    });

    it("^1.2.3 matches 1.9.9", () => {
      expect(satisfies("1.9.9", "^1.2.3")).toBe(true);
    });

    it("^1.2.3 does NOT match 2.0.0", () => {
      expect(satisfies("2.0.0", "^1.2.3")).toBe(false);
    });

    it("^0.2.3 matches 0.2.5", () => {
      expect(satisfies("0.2.5", "^0.2.3")).toBe(true);
    });

    it("^0.2.3 does NOT match 0.3.0", () => {
      expect(satisfies("0.3.0", "^0.2.3")).toBe(false);
    });

    it("^0.0.3 matches only 0.0.3", () => {
      expect(satisfies("0.0.3", "^0.0.3")).toBe(true);
      expect(satisfies("0.0.4", "^0.0.3")).toBe(false);
    });

    it("^1.2.3 does NOT match 1.2.2 (below range)", () => {
      expect(satisfies("1.2.2", "^1.2.3")).toBe(false);
    });
  });
});

describe("peer dependency resolution", () => {
  it("includes non-optional peer dependencies", () => {
    const deps = { "dep-a": "^1.0.0" };
    const peerDeps = { react: ">=17" };
    const result = mergePeerDeps(deps, peerDeps);
    expect(result).toEqual({ "dep-a": "^1.0.0", react: ">=17" });
  });

  it("skips optional peer dependencies", () => {
    const deps: Record<string, string> = {};
    const peerDeps = { react: ">=17", vue: ">=3" };
    const meta = { vue: { optional: true } };
    const result = mergePeerDeps(deps, peerDeps, meta);
    expect(result).toEqual({ react: ">=17" });
    expect(result).not.toHaveProperty("vue");
  });

  it("does not overwrite existing dependencies with peer deps", () => {
    const deps = { react: "^18.0.0" };
    const peerDeps = { react: ">=17" };
    const result = mergePeerDeps(deps, peerDeps);
    expect(result["react"]).toBe("^18.0.0"); // existing dep wins
  });
});

describe("SemVer numeric prerelease comparison (Finding #30)", () => {
  it("1.0.0-2 < 1.0.0-10 (numeric comparison, not lexicographic)", () => {
    expect(compareVersions("1.0.0-2", "1.0.0-10")).toBeLessThan(0);
  });

  it("1.0.0-alpha < 1.0.0-beta (string comparison)", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
  });

  it("1.0.0-alpha.1 < 1.0.0-alpha.2 (dotted numeric segments)", () => {
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.2")).toBeLessThan(0);
  });

  it("1.0.0-1.2 < 1.0.0-1.10 (multi-segment numeric)", () => {
    expect(compareVersions("1.0.0-1.2", "1.0.0-1.10")).toBeLessThan(0);
  });

  it("numeric identifier has lower precedence than string identifier", () => {
    // Per semver spec: numeric < string
    expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBeLessThan(0);
  });

  it("fewer prerelease segments have lower precedence", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBeLessThan(0);
  });

  it("release > prerelease", () => {
    expect(compareVersions("1.0.0", "1.0.0-alpha")).toBeGreaterThan(0);
  });

  it("findBestVersion picks correct prerelease with numeric comparison", () => {
    const versions = ["1.0.0-2", "1.0.0-10", "1.0.0-1"];
    const best = findBestVersion(versions, ">=1.0.0-0");
    expect(best).toBe("1.0.0-10");
  });
});

describe("Optional dependency handling (Finding #31)", () => {
  it("skips failed optional dependencies gracefully", async () => {
    const mockRegistry = {
      getManifest: async (name: string) => {
        if (name === "main-pkg") {
          return {
            name: "main-pkg",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "main-pkg",
                version: "1.0.0",
                dependencies: {},
                optionalDependencies: { "optional-pkg": "^1.0.0" },
                dist: {
                  tarball: "https://example.com/main-1.0.0.tgz",
                  shasum: "abc",
                },
              },
            },
          };
        }
        // optional-pkg fails to resolve
        throw new Error(`Package ${name} not found`);
      },
    };

    // Should not throw even though optional-pkg fails
    const resolved = await resolveDependencies("main-pkg", "latest", {
      registry: mockRegistry as any,
      includeOptional: true,
    });

    expect(resolved.has("main-pkg")).toBe(true);
    expect(resolved.has("optional-pkg")).toBe(false);
  });

  it("includes optional dependencies when includeOptional is true", async () => {
    const mockRegistry = {
      getManifest: async (name: string) => {
        if (name === "main-pkg") {
          return {
            name: "main-pkg",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "main-pkg",
                version: "1.0.0",
                dependencies: {},
                optionalDependencies: { "opt-dep": "^2.0.0" },
                dist: {
                  tarball: "https://example.com/main-1.0.0.tgz",
                  shasum: "abc",
                },
              },
            },
          };
        }
        if (name === "opt-dep") {
          return {
            name: "opt-dep",
            "dist-tags": { latest: "2.1.0" },
            versions: {
              "2.1.0": {
                name: "opt-dep",
                version: "2.1.0",
                dependencies: {},
                dist: {
                  tarball: "https://example.com/opt-dep-2.1.0.tgz",
                  shasum: "def",
                },
              },
            },
          };
        }
        throw new Error(`Package ${name} not found`);
      },
    };

    const resolved = await resolveDependencies("main-pkg", "latest", {
      registry: mockRegistry as any,
      includeOptional: true,
    });

    expect(resolved.has("main-pkg")).toBe(true);
    expect(resolved.has("opt-dep")).toBe(true);
    expect(resolved.get("opt-dep")!.version).toBe("2.1.0");
  });

  it("does not include optional dependencies when includeOptional is false", async () => {
    const mockRegistry = {
      getManifest: async (name: string) => {
        if (name === "main-pkg") {
          return {
            name: "main-pkg",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "main-pkg",
                version: "1.0.0",
                dependencies: {},
                optionalDependencies: { "opt-dep": "^2.0.0" },
                dist: {
                  tarball: "https://example.com/main-1.0.0.tgz",
                  shasum: "abc",
                },
              },
            },
          };
        }
        throw new Error(`Package ${name} not found`);
      },
    };

    const resolved = await resolveDependencies("main-pkg", "latest", {
      registry: mockRegistry as any,
      includeOptional: false,
    });

    expect(resolved.has("main-pkg")).toBe(true);
    expect(resolved.has("opt-dep")).toBe(false);
  });
});
