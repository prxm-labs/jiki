/**
 * Performance metrics for jiki containers.
 *
 * Tracks timing and counts for key operations: module resolution,
 * transpilation, file I/O, cache hits/misses, and package installs.
 *
 * @example
 * ```ts
 * const container = boot();
 * // ... do work ...
 * const m = container.metrics.snapshot();
 * console.log(`Resolved ${m.resolveCount} modules in ${m.resolveTimeMs}ms`);
 * ```
 */

export interface MetricsSnapshot {
  /** Total module resolutions performed. */
  resolveCount: number;
  /** Total time spent in module resolution (ms). */
  resolveTimeMs: number;
  /** Total transpilation calls. */
  transpileCount: number;
  /** Total time spent in transpilation (ms). */
  transpileTimeMs: number;
  /** Total VFS read operations. */
  vfsReadCount: number;
  /** Total VFS write operations. */
  vfsWriteCount: number;
  /** Module cache hits. */
  cacheHits: number;
  /** Module cache misses. */
  cacheMisses: number;
  /** Cache hit rate (0–1). */
  cacheHitRate: number;
  /** Total shell commands executed. */
  commandCount: number;
  /** Total packages installed. */
  installCount: number;
  /** Total time spent installing packages (ms). */
  installTimeMs: number;
  /** Timestamp of when metrics collection started. */
  startedAt: number;
  /** Elapsed time since metrics collection started (ms). */
  uptimeMs: number;
}

export class Metrics {
  private _resolveCount = 0;
  private _resolveTimeMs = 0;
  private _transpileCount = 0;
  private _transpileTimeMs = 0;
  private _vfsReadCount = 0;
  private _vfsWriteCount = 0;
  private _cacheHits = 0;
  private _cacheMisses = 0;
  private _commandCount = 0;
  private _installCount = 0;
  private _installTimeMs = 0;
  private _startedAt = Date.now();

  /** Record a module resolution. */
  trackResolve(durationMs: number): void {
    this._resolveCount++;
    this._resolveTimeMs += durationMs;
  }

  /** Record a transpilation. */
  trackTranspile(durationMs: number): void {
    this._transpileCount++;
    this._transpileTimeMs += durationMs;
  }

  /** Record a VFS read. */
  trackRead(): void {
    this._vfsReadCount++;
  }

  /** Record a VFS write. */
  trackWrite(): void {
    this._vfsWriteCount++;
  }

  /** Record a cache hit. */
  trackCacheHit(): void {
    this._cacheHits++;
  }

  /** Record a cache miss. */
  trackCacheMiss(): void {
    this._cacheMisses++;
  }

  /** Record a shell command execution. */
  trackCommand(): void {
    this._commandCount++;
  }

  /** Record a package install. */
  trackInstall(durationMs: number): void {
    this._installCount++;
    this._installTimeMs += durationMs;
  }

  /** Get a snapshot of all metrics. */
  snapshot(): MetricsSnapshot {
    const total = this._cacheHits + this._cacheMisses;
    return {
      resolveCount: this._resolveCount,
      resolveTimeMs: Math.round(this._resolveTimeMs * 100) / 100,
      transpileCount: this._transpileCount,
      transpileTimeMs: Math.round(this._transpileTimeMs * 100) / 100,
      vfsReadCount: this._vfsReadCount,
      vfsWriteCount: this._vfsWriteCount,
      cacheHits: this._cacheHits,
      cacheMisses: this._cacheMisses,
      cacheHitRate: total > 0 ? this._cacheHits / total : 0,
      commandCount: this._commandCount,
      installCount: this._installCount,
      installTimeMs: Math.round(this._installTimeMs * 100) / 100,
      startedAt: this._startedAt,
      uptimeMs: Date.now() - this._startedAt,
    };
  }

  /** Reset all metrics. */
  reset(): void {
    this._resolveCount = 0;
    this._resolveTimeMs = 0;
    this._transpileCount = 0;
    this._transpileTimeMs = 0;
    this._vfsReadCount = 0;
    this._vfsWriteCount = 0;
    this._cacheHits = 0;
    this._cacheMisses = 0;
    this._commandCount = 0;
    this._installCount = 0;
    this._installTimeMs = 0;
    this._startedAt = Date.now();
  }
}
