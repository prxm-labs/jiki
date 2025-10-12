import { MemFS } from "../memfs";
import { Registry, RegistryOptions } from "./registry";
import {
  resolveDependencies,
  resolveFromPackageJson,
  satisfies as semverSatisfies,
  compareVersions,
  ResolvedPackage,
} from "./resolver";
import { downloadAndExtract } from "./tarball";
import * as path from "../polyfills/path";
import { PackageCache, type PackageCacheOptions } from "./cache";
import { readLockfile, lockfileToResolved } from "./lockfile-reader";

export interface LayoutStrategy {
  getPackageDir(cwd: string, pkgName: string, pkgVersion: string): string;
  createTopLevelLink(
    vfs: MemFS,
    cwd: string,
    pkgName: string,
    pkgVersion: string,
  ): void;
  createDependencyLinks(
    vfs: MemFS,
    cwd: string,
    pkg: ResolvedPackage,
    allResolved: Map<string, ResolvedPackage>,
  ): void;
  createBinStub(
    vfs: MemFS,
    cwd: string,
    cmdName: string,
    targetPath: string,
  ): void;
}

export class NpmLayout implements LayoutStrategy {
  getPackageDir(cwd: string, pkgName: string, _pkgVersion: string): string {
    return path.join(cwd, "node_modules", pkgName);
  }

  createTopLevelLink(): void {}
  createDependencyLinks(): void {}

  createBinStub(
    vfs: MemFS,
    cwd: string,
    cmdName: string,
    targetPath: string,
  ): void {
    const binDir = path.join(cwd, "node_modules", ".bin");
    vfs.mkdirSync(binDir, { recursive: true });
    const stubPath = path.join(binDir, cmdName);
    vfs.writeFileSync(
      stubPath,
      `#!/usr/bin/env node\nrequire("${targetPath}");\n`,
    );
  }
}

function normalizeBin(
  pkgName: string,
  bin?: Record<string, string> | string,
): Record<string, string> {
  if (!bin) return {};
  if (typeof bin === "string") {
    const cmdName = pkgName.includes("/") ? pkgName.split("/").pop()! : pkgName;
    return { [cmdName]: bin };
  }
  return bin;
}

export function parsePackageSpec(spec: string): {
  name: string;
  version: string;
} {
  if (spec.startsWith("@")) {
    const atIdx = spec.indexOf("@", 1);
    if (atIdx > 0)
      return { name: spec.slice(0, atIdx), version: spec.slice(atIdx + 1) };
    return { name: spec, version: "latest" };
  }
  const atIdx = spec.lastIndexOf("@");
  if (atIdx > 0)
    return { name: spec.slice(0, atIdx), version: spec.slice(atIdx + 1) };
  return { name: spec, version: "latest" };
}

export interface InstallOptions {
  registry?: string;
  save?: boolean;
  saveDev?: boolean;
  includeDev?: boolean;
  includeOptional?: boolean;
  onProgress?: (message: string) => void;
  transform?: boolean;
  concurrency?: number;
}

export interface InstallResult {
  installed: Map<string, ResolvedPackage>;
  added: string[];
}

const DEFAULT_CONCURRENCY =
  typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 6;

export class PackageManager {
  private vfs: MemFS;
  private registry: Registry;
  private cwd: string;
  readonly layout: LayoutStrategy;
  /** Package cache for manifests and tarballs. */
  readonly cache: PackageCache;

  constructor(
    vfs: MemFS,
    options: {
      cwd?: string;
      layout?: LayoutStrategy;
      cache?: PackageCache;
    } & RegistryOptions = {},
  ) {
    this.vfs = vfs;
    this.cache = options.cache || new PackageCache();
    this.registry = new Registry({ ...options, cache: this.cache });
    this.cwd = options.cwd || "/";
    this.layout = options.layout || new NpmLayout();
  }

  /** Clear the package cache (manifests and tarballs). */
  clearCache(): void {
    this.cache.clear();
  }

  async install(
    packageSpec: string | string[],
    options: InstallOptions = {},
  ): Promise<InstallResult> {
    const specs = Array.isArray(packageSpec) ? packageSpec : [packageSpec];
    const { onProgress } = options;
    const allResolved = new Map<string, ResolvedPackage>();
    const added: string[] = [];

    const results = await Promise.all(
      specs.map(async spec => {
        const { name, version } = parsePackageSpec(spec);
        onProgress?.(`Resolving ${name}@${version || "latest"}...`);
        return resolveDependencies(name, version || "latest", {
          registry: this.registry,
          includeDev: options.includeDev,
          includeOptional: options.includeOptional,
        });
      }),
    );

    for (const result of results) {
      for (const [name, pkg] of result) {
        if (!allResolved.has(name)) {
          allResolved.set(name, pkg);
        } else {
          // Deduplicate: keep the higher version when two specs resolve the same package
          const existing = allResolved.get(name)!;
          if (
            pkg.version !== existing.version &&
            compareVersions(pkg.version, existing.version) > 0
          ) {
            allResolved.set(name, pkg);
          }
        }
      }
    }

    const packages = Array.from(allResolved.values());
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    onProgress?.(`Downloading ${packages.length} packages...`);

    for (let i = 0; i < packages.length; i += concurrency) {
      const batch = packages.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async pkg => {
          const destDir = this.layout.getPackageDir(
            this.cwd,
            pkg.name,
            pkg.version,
          );
          if (this.vfs.existsSync(destDir)) return;
          onProgress?.(`Installing ${pkg.name}@${pkg.version}`);
          await downloadAndExtract(
            pkg.dist.tarball,
            this.vfs,
            destDir,
            1,
            this.cache,
          );
          added.push(`${pkg.name}@${pkg.version}`);

          this.layout.createTopLevelLink(
            this.vfs,
            this.cwd,
            pkg.name,
            pkg.version,
          );

          const binEntries = normalizeBin(pkg.name, pkg.bin);
          for (const [cmdName, binPath] of Object.entries(binEntries)) {
            const targetPath = path.join(destDir, binPath);
            this.layout.createBinStub(this.vfs, this.cwd, cmdName, targetPath);
          }
        }),
      );
    }

    for (const pkg of packages) {
      this.layout.createDependencyLinks(this.vfs, this.cwd, pkg, allResolved);
    }

    if (options.save || options.saveDev) {
      this.updatePackageJson(specs, allResolved, options.saveDev);
    }

    buildLockfile(this.vfs, allResolved, this.cwd);

    onProgress?.(`Installed ${added.length} packages.`);
    return { installed: allResolved, added };
  }

  async installFromPackageJson(
    options: InstallOptions = {},
  ): Promise<InstallResult> {
    const pkgJsonPath = path.join(this.cwd, "package.json");
    if (!this.vfs.existsSync(pkgJsonPath))
      throw new Error("No package.json found");

    // Try lockfile-first installation (deterministic, no network for resolution)
    const lockfile = readLockfile(this.vfs, this.cwd);
    let resolved: Map<string, ResolvedPackage>;
    if (lockfile && lockfile.packages.size > 0) {
      options.onProgress?.("Using lockfile for deterministic install...");
      resolved = lockfileToResolved(lockfile);
    } else {
      const pkgJson = JSON.parse(this.vfs.readFileSync(pkgJsonPath, "utf8"));
      resolved = await resolveFromPackageJson(pkgJson, {
        registry: this.registry,
        includeDev: options.includeDev,
        includeOptional: options.includeOptional,
      });
    }

    const added: string[] = [];
    const packages = Array.from(resolved.values());
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    options.onProgress?.(`Downloading ${packages.length} packages...`);

    for (let i = 0; i < packages.length; i += concurrency) {
      const batch = packages.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async pkg => {
          const destDir = this.layout.getPackageDir(
            this.cwd,
            pkg.name,
            pkg.version,
          );
          if (this.vfs.existsSync(destDir)) return;
          options.onProgress?.(`Installing ${pkg.name}@${pkg.version}`);
          await downloadAndExtract(
            pkg.dist.tarball,
            this.vfs,
            destDir,
            1,
            this.cache,
          );
          added.push(`${pkg.name}@${pkg.version}`);

          this.layout.createTopLevelLink(
            this.vfs,
            this.cwd,
            pkg.name,
            pkg.version,
          );

          const binEntries = normalizeBin(pkg.name, pkg.bin);
          for (const [cmdName, binPath] of Object.entries(binEntries)) {
            const targetPath = path.join(destDir, binPath);
            this.layout.createBinStub(this.vfs, this.cwd, cmdName, targetPath);
          }
        }),
      );
    }

    for (const pkg of packages) {
      this.layout.createDependencyLinks(this.vfs, this.cwd, pkg, resolved);
    }

    buildLockfile(this.vfs, resolved, this.cwd);

    return { installed: resolved, added };
  }

  list(): string[] {
    const nmDir = path.join(this.cwd, "node_modules");
    if (!this.vfs.existsSync(nmDir)) return [];
    const entries = this.vfs.readdirSync(nmDir);
    const packages: string[] = [];
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      if (entry.startsWith("@")) {
        const scopeDir = path.join(nmDir, entry);
        const scoped = this.vfs.readdirSync(scopeDir);
        for (const s of scoped) packages.push(`${entry}/${s}`);
      } else {
        packages.push(entry);
      }
    }
    return packages;
  }

  private updatePackageJson(
    specs: string[],
    resolved: Map<string, ResolvedPackage>,
    isDev?: boolean,
  ): void {
    const pkgJsonPath = path.join(this.cwd, "package.json");
    let pkgJson: Record<string, unknown> = {};
    if (this.vfs.existsSync(pkgJsonPath)) {
      pkgJson = JSON.parse(this.vfs.readFileSync(pkgJsonPath, "utf8"));
    }
    const field = isDev ? "devDependencies" : "dependencies";
    if (!pkgJson[field]) pkgJson[field] = {};
    const deps = pkgJson[field] as Record<string, string>;
    for (const spec of specs) {
      const { name } = parsePackageSpec(spec);
      const pkg = resolved.get(name);
      if (pkg) deps[name] = `^${pkg.version}`;
    }
    this.vfs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  }
}

export function buildLockfile(
  vfs: MemFS,
  resolved: Map<string, ResolvedPackage>,
  cwd: string = "/",
): void {
  const lockfile: Record<string, unknown> = {
    name: "jiki-project",
    lockfileVersion: 3,
    packages: {} as Record<
      string,
      {
        version: string;
        resolved: string;
        dependencies?: Record<string, string>;
      }
    >,
  };
  const packages = lockfile.packages as Record<string, any>;
  for (const [name, pkg] of resolved) {
    packages[`node_modules/${name}`] = {
      version: pkg.version,
      resolved: pkg.dist.tarball,
      dependencies:
        Object.keys(pkg.dependencies).length > 0 ? pkg.dependencies : undefined,
    };
  }
  const lockfilePath = path.join(cwd, "package-lock.json");
  vfs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
}

export { Registry } from "./registry";
export type { RegistryOptions } from "./registry";
export type { ResolvedPackage } from "./resolver";
export { satisfies, compareVersions } from "./resolver";
export { readLockfile, lockfileToResolved } from "./lockfile-reader";
export type { LockfileData, LockfileEntry } from "./lockfile-reader";
