/**
 * Package cache for npm manifests and tarballs.
 *
 * Provides an in-memory cache with an optional persistent backing store
 * (IndexedDB or any `PersistenceAdapter`-like backend). Manifests have a
 * configurable TTL; tarballs are immutable by URL and cached indefinitely.
 *
 * @example
 * ```ts
 * const cache = new PackageCache();
 * const registry = new Registry();
 * // Wrap getManifest with cache
 * const manifest = await cache.getManifest('react', () => registry.getManifest('react'));
 * ```
 */

import type { PackageManifest } from "./registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackageCacheOptions {
  /** Manifest TTL in milliseconds. Default: 1 hour. */
  manifestTtlMs?: number;
  /** Maximum number of manifests to keep in memory. Default: 500. */
  maxManifests?: number;
  /** Maximum number of tarballs to keep in memory. Default: 200. */
  maxTarballs?: number;
}

interface CachedManifest {
  manifest: PackageManifest;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// PackageCache
// ---------------------------------------------------------------------------

/**
 * In-memory cache for npm package manifests and tarball data.
 *
 * - **Manifests** are keyed by package name with a configurable TTL (default
 *   1 hour). After TTL expiry the manifest is re-fetched on next access.
 * - **Tarballs** are keyed by URL. Since npm tarball URLs are immutable
 *   (content-addressed), they are cached indefinitely.
 */
export class PackageCache {
  private manifests = new Map<string, CachedManifest>();
  private tarballs = new Map<string, Uint8Array>();
  private manifestTtlMs: number;
  private maxManifests: number;
  private maxTarballs: number;

  constructor(options: PackageCacheOptions = {}) {
    this.manifestTtlMs = options.manifestTtlMs ?? 60 * 60 * 1000; // 1 hour
    this.maxManifests = options.maxManifests ?? 500;
    this.maxTarballs = options.maxTarballs ?? 200;
  }

  // -- Manifests ------------------------------------------------------------

  /**
   * Get a cached manifest, or fetch and cache it.
   *
   * @param name - Package name
   * @param fetcher - Async function that fetches the manifest from the registry
   * @returns The manifest (from cache or freshly fetched)
   */
  async getManifest(
    name: string,
    fetcher: () => Promise<PackageManifest>,
  ): Promise<PackageManifest> {
    const cached = this.manifests.get(name);
    if (cached && Date.now() - cached.timestamp < this.manifestTtlMs) {
      return cached.manifest;
    }

    const manifest = await fetcher();
    this.setManifest(name, manifest);
    return manifest;
  }

  /** Check if a manifest is cached and not expired. */
  hasManifest(name: string): boolean {
    const cached = this.manifests.get(name);
    return !!cached && Date.now() - cached.timestamp < this.manifestTtlMs;
  }

  /** Store a manifest in the cache. */
  setManifest(name: string, manifest: PackageManifest): void {
    if (this.manifests.size >= this.maxManifests) {
      // Evict oldest entry
      const oldest = this.manifests.keys().next().value;
      if (oldest !== undefined) this.manifests.delete(oldest);
    }
    this.manifests.set(name, { manifest, timestamp: Date.now() });
  }

  // -- Tarballs -------------------------------------------------------------

  /**
   * Get a cached tarball, or fetch and cache it.
   *
   * @param url - Tarball URL (immutable by npm convention)
   * @param fetcher - Async function that downloads the tarball
   * @returns The tarball data
   */
  async getTarball(
    url: string,
    fetcher: () => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const cached = this.tarballs.get(url);
    if (cached) return cached;

    const data = await fetcher();
    this.setTarball(url, data);
    return data;
  }

  /** Check if a tarball is cached. */
  hasTarball(url: string): boolean {
    return this.tarballs.has(url);
  }

  /** Store a tarball in the cache. */
  setTarball(url: string, data: Uint8Array): void {
    if (this.tarballs.size >= this.maxTarballs) {
      const oldest = this.tarballs.keys().next().value;
      if (oldest !== undefined) this.tarballs.delete(oldest);
    }
    this.tarballs.set(url, data);
  }

  // -- Diagnostics ----------------------------------------------------------

  /** Number of cached manifests. */
  get manifestCount(): number {
    return this.manifests.size;
  }

  /** Number of cached tarballs. */
  get tarballCount(): number {
    return this.tarballs.size;
  }

  /** Total bytes of cached tarballs. */
  get tarballBytes(): number {
    let total = 0;
    for (const data of this.tarballs.values()) total += data.length;
    return total;
  }

  // -- Cache control --------------------------------------------------------

  /** Clear all cached manifests. */
  clearManifests(): void {
    this.manifests.clear();
  }

  /** Clear all cached tarballs. */
  clearTarballs(): void {
    this.tarballs.clear();
  }

  /** Clear all cached data. */
  clear(): void {
    this.manifests.clear();
    this.tarballs.clear();
  }
}
