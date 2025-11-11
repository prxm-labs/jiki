import type { Registry, PackageVersion } from "./registry";

export interface ResolvedPackage {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  dist: { tarball: string; shasum: string };
  bin?: string | Record<string, string>;
}

export interface ResolveOptions {
  registry: Registry;
  includeDev?: boolean;
  includeOptional?: boolean;
}

export class SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly pre: string;

  constructor(raw: string) {
    const cleaned = raw.replace(/^[=v]+/, "");
    const [mainPart, prePart = ""] = cleaned.split("-");
    const nums = mainPart.split(".").map(Number);
    this.major = nums[0] || 0;
    this.minor = nums[1] || 0;
    this.patch = nums[2] || 0;
    this.pre = prePart;
  }

  compareTo(other: SemVer): number {
    if (this.major !== other.major) return this.major - other.major;
    if (this.minor !== other.minor) return this.minor - other.minor;
    if (this.patch !== other.patch) return this.patch - other.patch;
    if (!this.pre && other.pre) return 1;
    if (this.pre && !other.pre) return -1;
    if (this.pre && other.pre) {
      // Compare prerelease segments per semver spec:
      // split on ".", compare each segment numerically if both numeric, otherwise lexically
      const aParts = this.pre.split(".");
      const bParts = other.pre.split(".");
      const len = Math.max(aParts.length, bParts.length);
      for (let i = 0; i < len; i++) {
        if (i >= aParts.length) return -1; // fewer segments = lower precedence
        if (i >= bParts.length) return 1;
        const aNum = /^\d+$/.test(aParts[i]);
        const bNum = /^\d+$/.test(bParts[i]);
        if (aNum && bNum) {
          const diff = Number(aParts[i]) - Number(bParts[i]);
          if (diff !== 0) return diff;
        } else if (aNum !== bNum) {
          // Numeric identifiers have lower precedence than string identifiers
          return aNum ? -1 : 1;
        } else {
          if (aParts[i] < bParts[i]) return -1;
          if (aParts[i] > bParts[i]) return 1;
        }
      }
    }
    return 0;
  }

  matches(range: string): boolean {
    return satisfies(this.toString(), range);
  }

  toString(): string {
    const base = `${this.major}.${this.minor}.${this.patch}`;
    return this.pre ? `${base}-${this.pre}` : base;
  }
}

interface RangeConstraint {
  op:
    | "="
    | ">="
    | "<="
    | ">"
    | "<"
    | "^"
    | "~"
    | "partial-major"
    | "partial-minor"
    | "any";
  target: SemVer;
  raw?: string;
}

function parseConstraint(token: string): RangeConstraint | null {
  const t = token.trim();
  if (!t || t === "*" || t === "latest")
    return { op: "any", target: new SemVer("0.0.0") };
  if (t.startsWith("npm:")) return { op: "any", target: new SemVer("0.0.0") };

  if (t.startsWith(">=")) return { op: ">=", target: new SemVer(t.slice(2)) };
  if (t.startsWith("<=")) return { op: "<=", target: new SemVer(t.slice(2)) };
  if (t.startsWith(">") && !t.startsWith(">="))
    return { op: ">", target: new SemVer(t.slice(1)) };
  if (t.startsWith("<") && !t.startsWith("<="))
    return { op: "<", target: new SemVer(t.slice(1)) };
  if (t.startsWith("^")) return { op: "^", target: new SemVer(t.slice(1)) };
  if (t.startsWith("~")) return { op: "~", target: new SemVer(t.slice(1)) };
  if (t.startsWith("=")) return { op: "=", target: new SemVer(t.slice(1)) };

  const dots = (t.match(/\./g) || []).length;
  if (dots === 0 && /^\d+$/.test(t))
    return { op: "partial-major", target: new SemVer(t + ".0.0") };
  if (dots === 1 && /^\d+\.\d+$/.test(t))
    return { op: "partial-minor", target: new SemVer(t + ".0") };

  return { op: "=", target: new SemVer(t) };
}

function testConstraint(ver: SemVer, c: RangeConstraint): boolean {
  switch (c.op) {
    case "any":
      return true;
    case "=":
      return ver.compareTo(c.target) === 0;
    case ">=":
      return ver.compareTo(c.target) >= 0;
    case "<=":
      return ver.compareTo(c.target) <= 0;
    case ">":
      return ver.compareTo(c.target) > 0;
    case "<":
      return ver.compareTo(c.target) < 0;
    case "~":
      return (
        ver.major === c.target.major &&
        ver.minor === c.target.minor &&
        ver.patch >= c.target.patch
      );
    case "^": {
      const r = c.target;
      if (ver.compareTo(r) < 0) return false; // below minimum
      if (r.major > 0) return ver.major === r.major;
      if (r.minor > 0) return ver.major === 0 && ver.minor === r.minor;
      return ver.major === 0 && ver.minor === 0 && ver.patch === r.patch;
    }
    case "partial-major":
      return ver.major === c.target.major;
    case "partial-minor":
      return ver.major === c.target.major && ver.minor === c.target.minor;
  }
}

function satisfies(version: string, range: string): boolean {
  range = range.trim();
  if (range === "*" || range === "" || range === "latest") return true;
  if (range.startsWith("npm:")) return true;

  if (range.includes("||")) {
    return range.split("||").some(alt => satisfies(version, alt.trim()));
  }

  range = range.replace(/(>=?|<=?|[~^=])\s+/g, "$1");

  const tokens = range.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens[1] === "-" && tokens.length === 3) {
    return (
      satisfies(version, `>=${tokens[0]}`) &&
      satisfies(version, `<=${tokens[2]}`)
    );
  }

  const ver = new SemVer(version);
  for (const tok of tokens) {
    const c = parseConstraint(tok);
    if (!c || !testConstraint(ver, c)) return false;
  }
  return true;
}

function compareVersions(a: string, b: string): number {
  return new SemVer(a).compareTo(new SemVer(b));
}

function findBestVersion(versions: string[], range: string): string | null {
  const valid = versions.filter(v => satisfies(v, range));
  if (valid.length === 0) return null;
  return valid.sort(compareVersions).pop()!;
}

interface QueueEntry {
  name: string;
  range: string;
  optional?: boolean;
}

export async function resolveDependencies(
  name: string,
  versionRange: string,
  options: ResolveOptions,
): Promise<Map<string, ResolvedPackage>> {
  const resolved = new Map<string, ResolvedPackage>();
  const visited = new Set<string>();
  const queue: QueueEntry[] = [{ name, range: versionRange }];

  while (queue.length > 0) {
    const batch = queue.splice(0, queue.length);
    const pending = batch.filter(entry => {
      const key = `${entry.name}@${entry.range}`;
      if (visited.has(key)) return false;
      visited.add(key);
      return true;
    });

    const results = await Promise.all(
      pending.map(async entry => {
        try {
          const manifest = await options.registry.getManifest(entry.name);
          const versions = Object.keys(manifest.versions);
          let target = entry.range;

          if (manifest["dist-tags"][entry.range]) {
            target = manifest["dist-tags"][entry.range];
          } else {
            const best = findBestVersion(versions, entry.range);
            if (!best) {
              if (entry.optional) return null;
              throw new Error(
                `No matching version for ${entry.name}@${entry.range}`,
              );
            }
            target = best;
          }

          if (resolved.has(entry.name)) return null;

          const pkgVersion = manifest.versions[target];
          if (!pkgVersion) {
            if (entry.optional) return null;
            throw new Error(`Version ${target} not found for ${entry.name}`);
          }

          const deps = mergePeerDeps(
            pkgVersion.dependencies || {},
            pkgVersion.peerDependencies || {},
            pkgVersion.peerDependenciesMeta,
          );

          // Include optional dependencies when includeOptional is set
          if (options.includeOptional && pkgVersion.optionalDependencies) {
            for (const [optName, optRange] of Object.entries(
              pkgVersion.optionalDependencies,
            )) {
              if (!deps[optName]) {
                deps[optName] = optRange;
              }
            }
          }

          // Track which dependency names came from optionalDependencies
          const optionalDepNames = new Set<string>(
            options.includeOptional && pkgVersion.optionalDependencies
              ? Object.keys(pkgVersion.optionalDependencies)
              : [],
          );

          const pkg: ResolvedPackage = {
            name: entry.name,
            version: target,
            dependencies: deps,
            dist: pkgVersion.dist,
            bin: pkgVersion.bin,
          };
          return { pkg, optionalDepNames };
        } catch (err) {
          // Optional dependencies should fail gracefully
          if (entry.optional) return null;
          throw err;
        }
      }),
    );

    for (const result of results) {
      if (!result || resolved.has(result.pkg.name)) continue;
      const { pkg, optionalDepNames } = result;
      resolved.set(pkg.name, pkg);
      for (const [depName, depRange] of Object.entries(pkg.dependencies)) {
        queue.push({
          name: depName,
          range: depRange,
          optional: optionalDepNames.has(depName),
        });
      }
    }
  }

  return resolved;
}

export async function resolveFromPackageJson(
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  },
  options: ResolveOptions,
): Promise<Map<string, ResolvedPackage>> {
  const all = new Map<string, ResolvedPackage>();
  const deps = { ...packageJson.dependencies };
  if (options.includeDev) Object.assign(deps, packageJson.devDependencies);

  const results = await Promise.all(
    Object.entries(deps).map(([n, r]) =>
      resolveDependencies(n, r, options).catch(
        () => new Map<string, ResolvedPackage>(),
      ),
    ),
  );

  for (const result of results) {
    for (const [n, pkg] of result) {
      if (!all.has(n)) all.set(n, pkg);
    }
  }

  return all;
}

/** Merge non-optional peerDependencies into deps. Existing deps take precedence. */
export function mergePeerDeps(
  deps: Record<string, string>,
  peerDeps: Record<string, string>,
  peerMeta?: Record<string, { optional?: boolean }>,
): Record<string, string> {
  const merged = { ...deps };
  for (const [name, range] of Object.entries(peerDeps)) {
    if (!peerMeta?.[name]?.optional && !merged[name]) {
      merged[name] = range;
    }
  }
  return merged;
}

export { satisfies, compareVersions, findBestVersion };
