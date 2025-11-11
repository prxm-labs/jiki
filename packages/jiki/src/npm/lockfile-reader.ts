/**
 * Lockfile reader for package-lock.json (v3 format).
 *
 * When a lockfile exists, the package manager can skip dependency resolution
 * entirely and use the exact versions and tarball URLs from the lockfile.
 * Combined with the package cache, this enables zero-network deterministic
 * installs.
 */

import type { MemFS } from "../memfs";
import * as pathShim from "../polyfills/path";
import type { ResolvedPackage } from "./resolver";

/** A single package entry parsed from a lockfile. */
export interface LockfileEntry {
  name: string;
  version: string;
  resolved: string; // tarball URL
  dependencies?: Record<string, string>;
}

/** Parsed lockfile data. */
export interface LockfileData {
  lockfileVersion: number;
  packages: Map<string, LockfileEntry>;
}

/**
 * Read and parse a package-lock.json (v3 format) from the VFS.
 * Returns `null` if no lockfile exists or it can't be parsed.
 */
export function readLockfile(vfs: MemFS, cwd: string): LockfileData | null {
  const lockfilePath = pathShim.join(cwd, "package-lock.json");
  try {
    if (!vfs.existsSync(lockfilePath)) return null;
    const content = JSON.parse(vfs.readFileSync(lockfilePath, "utf8"));
    return parseLockfileV3(content);
  } catch {
    return null;
  }
}

/**
 * Parse lockfile JSON (v3 format) into structured data.
 */
function parseLockfileV3(json: Record<string, unknown>): LockfileData | null {
  const lockfileVersion = json.lockfileVersion as number;
  if (!lockfileVersion || lockfileVersion < 3) return null;

  const rawPackages = json.packages as
    | Record<
        string,
        {
          version?: string;
          resolved?: string;
          dependencies?: Record<string, string>;
        }
      >
    | undefined;

  if (!rawPackages) return null;

  const packages = new Map<string, LockfileEntry>();

  for (const [key, entry] of Object.entries(rawPackages)) {
    // Keys are like "node_modules/react" or "node_modules/@scope/pkg"
    if (!key.startsWith("node_modules/")) continue;
    const name = key.slice("node_modules/".length);

    if (!entry.version || !entry.resolved) continue;

    packages.set(name, {
      name,
      version: entry.version,
      resolved: entry.resolved,
      dependencies: entry.dependencies,
    });
  }

  return { lockfileVersion, packages };
}

/**
 * Convert lockfile entries to ResolvedPackage map for use by the installer.
 * This replaces the full dependency resolution step when a lockfile is available.
 */
export function lockfileToResolved(
  lockfile: LockfileData,
): Map<string, ResolvedPackage> {
  const resolved = new Map<string, ResolvedPackage>();

  for (const [name, entry] of lockfile.packages) {
    resolved.set(name, {
      name,
      version: entry.version,
      dependencies: entry.dependencies || {},
      dist: {
        tarball: entry.resolved,
        shasum: "",
      },
    });
  }

  return resolved;
}
