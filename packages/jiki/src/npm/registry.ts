import type { PackageCache } from "./cache";

export interface RegistryOptions {
  registry?: string;
  token?: string;
  /** Optional package cache for manifest and tarball caching. */
  cache?: PackageCache;
}

export interface PackageManifest {
  name: string;
  "dist-tags": Record<string, string>;
  versions: Record<string, PackageVersion>;
}

export interface PackageVersion {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  bin?: string | Record<string, string>;
  main?: string;
  module?: string;
  exports?: unknown;
  dist: {
    tarball: string;
    shasum: string;
    integrity?: string;
  };
}

export class Registry {
  private baseUrl: string;
  private token?: string;
  private inMemoryCache = new Map<string, PackageManifest>();
  private packageCache?: PackageCache;

  constructor(options: RegistryOptions = {}) {
    this.baseUrl = (options.registry || "https://registry.npmjs.org").replace(
      /\/$/,
      "",
    );
    this.token = options.token;
    this.packageCache = options.cache;
  }

  async getManifest(name: string): Promise<PackageManifest> {
    // Check in-memory cache first (legacy behaviour)
    if (this.inMemoryCache.has(name)) return this.inMemoryCache.get(name)!;

    // Check package cache (with TTL)
    if (this.packageCache) {
      return this.packageCache.getManifest(name, () =>
        this.fetchManifest(name),
      );
    }

    return this.fetchManifest(name);
  }

  private async fetchManifest(name: string): Promise<PackageManifest> {
    const encodedName = name.startsWith("@")
      ? `@${encodeURIComponent(name.slice(1))}`
      : encodeURIComponent(name);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${this.baseUrl}/${encodedName}`, {
      headers,
    });

    if (!response.ok)
      throw new Error(`Failed to fetch package ${name}: ${response.status}`);

    const manifest = (await response.json()) as PackageManifest;
    this.inMemoryCache.set(name, manifest);
    return manifest;
  }

  async getVersion(name: string, version: string): Promise<PackageVersion> {
    const manifest = await this.getManifest(name);
    if (manifest["dist-tags"][version])
      version = manifest["dist-tags"][version];
    const pkgVersion = manifest.versions[version];
    if (!pkgVersion)
      throw new Error(`Version ${version} not found for ${name}`);
    return pkgVersion;
  }

  async downloadTarball(url: string): Promise<ArrayBuffer> {
    // Check tarball cache
    if (this.packageCache) {
      const data = await this.packageCache.getTarball(url, async () => {
        const raw = await this.fetchTarball(url);
        return new Uint8Array(raw);
      });
      return data.buffer as ArrayBuffer;
    }
    return this.fetchTarball(url);
  }

  private async fetchTarball(url: string): Promise<ArrayBuffer> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok)
      throw new Error(`Failed to download tarball: ${response.status}`);
    return response.arrayBuffer();
  }

  clearCache(): void {
    this.inMemoryCache.clear();
  }
}
