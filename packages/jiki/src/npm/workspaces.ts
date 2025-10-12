/**
 * Monorepo workspace support.
 *
 * Parses `workspaces` field from package.json or `pnpm-workspace.yaml`
 * and resolves `workspace:*` version specifiers to local packages.
 *
 * @example
 * ```ts
 * const workspaces = discoverWorkspaces(vfs, '/');
 * // [{ name: '@myapp/utils', path: '/packages/utils', version: '1.0.0' }]
 * ```
 */

import type { MemFS } from "../memfs";
import * as pathShim from "../polyfills/path";

export interface WorkspacePackage {
  /** Package name from its package.json. */
  name: string;
  /** Absolute path to the workspace package directory. */
  path: string;
  /** Version from its package.json. */
  version: string;
}

/**
 * Discover all workspace packages in a monorepo.
 *
 * Checks for:
 * 1. `workspaces` field in root package.json (npm/yarn format)
 * 2. `pnpm-workspace.yaml` (pnpm format)
 *
 * Returns an array of discovered workspace packages with their names,
 * paths, and versions.
 */
export function discoverWorkspaces(
  vfs: MemFS,
  cwd: string,
): WorkspacePackage[] {
  const patterns = getWorkspacePatterns(vfs, cwd);
  if (patterns.length === 0) return [];

  const packages: WorkspacePackage[] = [];

  for (const pattern of patterns) {
    // Expand glob-like patterns (e.g. "packages/*")
    const dirs = expandWorkspacePattern(vfs, cwd, pattern);
    for (const dir of dirs) {
      const pkgJsonPath = pathShim.join(dir, "package.json");
      try {
        if (!vfs.existsSync(pkgJsonPath)) continue;
        const pkg = JSON.parse(vfs.readFileSync(pkgJsonPath, "utf8"));
        if (pkg.name) {
          packages.push({
            name: pkg.name,
            path: dir,
            version: pkg.version || "0.0.0",
          });
        }
      } catch {
        // Skip invalid package.json
      }
    }
  }

  return packages;
}

/**
 * Read workspace patterns from package.json or pnpm-workspace.yaml.
 */
function getWorkspacePatterns(vfs: MemFS, cwd: string): string[] {
  // Check package.json workspaces field
  const pkgJsonPath = pathShim.join(cwd, "package.json");
  try {
    if (vfs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(vfs.readFileSync(pkgJsonPath, "utf8"));
      if (Array.isArray(pkg.workspaces)) {
        return pkg.workspaces;
      }
      if (pkg.workspaces?.packages && Array.isArray(pkg.workspaces.packages)) {
        return pkg.workspaces.packages;
      }
    }
  } catch {
    /* skip */
  }

  // Check pnpm-workspace.yaml
  const pnpmWsPath = pathShim.join(cwd, "pnpm-workspace.yaml");
  try {
    if (vfs.existsSync(pnpmWsPath)) {
      const content = vfs.readFileSync(pnpmWsPath, "utf8");
      return parsePnpmWorkspaceYaml(content);
    }
  } catch {
    /* skip */
  }

  return [];
}

/**
 * Parse a simple pnpm-workspace.yaml to extract package patterns.
 * Handles the common format:
 * ```yaml
 * packages:
 *   - 'packages/*'
 *   - 'apps/*'
 * ```
 */
function parsePnpmWorkspaceYaml(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "packages:" || trimmed === "packages :") {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (trimmed.startsWith("- ")) {
        // Strip quotes and the leading "- "
        const pattern = trimmed
          .slice(2)
          .replace(/^['"]|['"]$/g, "")
          .trim();
        if (pattern) patterns.push(pattern);
      } else if (trimmed && !trimmed.startsWith("#")) {
        // Non-list item means we've left the packages section
        break;
      }
    }
  }

  return patterns;
}

/**
 * Expand a workspace pattern like "packages/*" into actual directory paths.
 */
function expandWorkspacePattern(
  vfs: MemFS,
  cwd: string,
  pattern: string,
): string[] {
  // Remove trailing /
  pattern = pattern.replace(/\/+$/, "");

  if (pattern.endsWith("/*")) {
    // Glob: list children of the directory
    const parentDir = pathShim.join(cwd, pattern.slice(0, -2));
    try {
      if (!vfs.existsSync(parentDir)) return [];
      return vfs
        .readdirSync(parentDir)
        .filter(name => {
          const full = pathShim.join(parentDir, name);
          try {
            return vfs.statSync(full).isDirectory();
          } catch {
            return false;
          }
        })
        .map(name => pathShim.join(parentDir, name));
    } catch {
      return [];
    }
  }

  if (pattern.endsWith("/**")) {
    // Recursive glob: find all directories containing package.json
    const parentDir = pathShim.join(cwd, pattern.slice(0, -3));
    const results: string[] = [];
    findPackageDirs(vfs, parentDir, results);
    return results;
  }

  // Exact path
  const dir = pathShim.join(cwd, pattern);
  return vfs.existsSync(dir) ? [dir] : [];
}

function findPackageDirs(vfs: MemFS, dir: string, results: string[]): void {
  try {
    const pkgJson = pathShim.join(dir, "package.json");
    if (vfs.existsSync(pkgJson)) results.push(dir);

    for (const name of vfs.readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = pathShim.join(dir, name);
      try {
        if (vfs.statSync(full).isDirectory()) {
          findPackageDirs(vfs, full, results);
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
}

/**
 * Resolve a `workspace:*` version specifier to the local package path.
 * Returns the workspace package if found, or `null` if not a workspace dep.
 */
export function resolveWorkspaceDep(
  specifier: string,
  workspaces: WorkspacePackage[],
): WorkspacePackage | null {
  for (const ws of workspaces) {
    if (ws.name === specifier) return ws;
  }
  return null;
}

/**
 * Check if a version string is a workspace protocol specifier.
 */
export function isWorkspaceProtocol(version: string): boolean {
  return version.startsWith("workspace:");
}

/**
 * Create symlinks in node_modules for workspace packages, similar to
 * how pnpm/yarn link local packages.
 */
export function linkWorkspaces(
  vfs: MemFS,
  cwd: string,
  workspaces: WorkspacePackage[],
): void {
  const nmDir = pathShim.join(cwd, "node_modules");
  vfs.mkdirSync(nmDir, { recursive: true });

  for (const ws of workspaces) {
    const linkPath = pathShim.join(nmDir, ws.name);
    // Create parent for scoped packages
    if (ws.name.includes("/")) {
      const scope = pathShim.dirname(linkPath);
      vfs.mkdirSync(scope, { recursive: true });
    }
    // Only create if not already present
    if (!vfs.existsSync(linkPath)) {
      try {
        vfs.symlinkSync(ws.path, linkPath);
      } catch {
        // Symlink may already exist
      }
    }
  }
}
