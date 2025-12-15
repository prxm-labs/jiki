import { describe, it, expect } from "vitest";
import { MemFS } from "../../src/memfs";
import { buildLockfile } from "../../src/npm/index";
import type { ResolvedPackage } from "../../src/npm/resolver";

describe("lockfile generation", () => {
  it("writes package-lock.json with correct structure", () => {
    const vfs = new MemFS();
    const resolved = new Map<string, ResolvedPackage>([
      [
        "lodash",
        {
          name: "lodash",
          version: "4.17.21",
          dist: {
            tarball: "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
            shasum: "abc",
          },
          dependencies: {},
        },
      ],
      [
        "express",
        {
          name: "express",
          version: "4.18.2",
          dist: {
            tarball: "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
            shasum: "def",
          },
          dependencies: { accepts: "~1.3.8" },
        },
      ],
    ]);

    buildLockfile(vfs, resolved);

    const content = JSON.parse(
      vfs.readFileSync("/package-lock.json", "utf-8") as string,
    );
    expect(content.lockfileVersion).toBe(3);
    expect(content.packages["node_modules/lodash"].version).toBe("4.17.21");
    expect(content.packages["node_modules/lodash"].resolved).toContain(
      "lodash",
    );
    expect(
      content.packages["node_modules/lodash"].dependencies,
    ).toBeUndefined();
  });

  it("lockfile contains resolved tarball URLs and dependencies", () => {
    const vfs = new MemFS();
    const resolved = new Map<string, ResolvedPackage>([
      [
        "express",
        {
          name: "express",
          version: "4.18.2",
          dist: {
            tarball: "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
            shasum: "def",
          },
          dependencies: { accepts: "~1.3.8" },
        },
      ],
    ]);

    buildLockfile(vfs, resolved);

    const content = JSON.parse(
      vfs.readFileSync("/package-lock.json", "utf-8") as string,
    );
    expect(content.packages["node_modules/express"].resolved).toBe(
      "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
    );
    expect(content.packages["node_modules/express"].dependencies).toEqual({
      accepts: "~1.3.8",
    });
  });
});
