/**
 * Resource limits and sandboxing for jiki containers.
 *
 * Provides configurable limits for memory, execution time, file count,
 * network access, and filesystem path boundaries. Essential for
 * production deployments where untrusted code runs.
 *
 * @example
 * ```ts
 * const container = boot({
 *   sandbox: {
 *     limits: { maxMemoryMB: 256, maxExecutionMs: 30000, maxFileCount: 10000 },
 *     network: { allowedHosts: ['registry.npmjs.org'] },
 *     fs: { allowedPaths: ['/app', '/node_modules'] },
 *   },
 * });
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandboxLimits {
  /** Maximum total VFS memory in megabytes. Default: unlimited. */
  maxMemoryMB?: number;
  /** Maximum execution time per run/execute call in milliseconds. Default: unlimited. */
  maxExecutionMs?: number;
  /** Maximum number of files in the VFS. Default: unlimited. */
  maxFileCount?: number;
  /** Maximum single file size in megabytes. Default: unlimited. */
  maxFileSizeMB?: number;
}

export interface SandboxNetwork {
  /** List of allowed hostnames for network requests. */
  allowedHosts?: string[];
  /** Block all network requests. */
  blockAll?: boolean;
}

export interface SandboxFs {
  /** List of allowed path prefixes. Writes outside these paths are rejected. */
  allowedPaths?: string[];
  /** Make the entire VFS read-only. */
  readOnly?: boolean;
}

export interface SandboxOptions {
  limits?: SandboxLimits;
  network?: SandboxNetwork;
  fs?: SandboxFs;
}

// ---------------------------------------------------------------------------
// SandboxGuard
// ---------------------------------------------------------------------------

/**
 * Enforces resource limits and access controls for a container.
 */
export class SandboxGuard {
  private opts: SandboxOptions;
  private fileCount = 0;
  private totalBytes = 0;

  constructor(options: SandboxOptions = {}) {
    this.opts = options;
  }

  /** Check if the sandbox has any restrictions configured. */
  get isActive(): boolean {
    return !!(this.opts.limits || this.opts.network || this.opts.fs);
  }

  // -- VFS limits -----------------------------------------------------------

  /** Check if a file write is allowed by size and count limits. */
  checkWrite(path: string, sizeBytes: number): void {
    if (this.opts.fs?.readOnly) {
      throw new Error(
        `[sandbox] VFS is read-only: write to '${path}' rejected`,
      );
    }

    if (this.opts.fs?.allowedPaths) {
      const allowed = this.opts.fs.allowedPaths.some(
        prefix => path === prefix || path.startsWith(prefix + "/"),
      );
      if (!allowed) {
        throw new Error(
          `[sandbox] Write to '${path}' rejected: outside allowed paths`,
        );
      }
    }

    const limits = this.opts.limits;
    if (limits?.maxFileSizeMB) {
      const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
      if (sizeBytes > maxBytes) {
        throw new Error(
          `[sandbox] File '${path}' exceeds max file size (${(sizeBytes / 1024 / 1024).toFixed(1)} MB > ${limits.maxFileSizeMB} MB)`,
        );
      }
    }

    if (limits?.maxMemoryMB) {
      const maxBytes = limits.maxMemoryMB * 1024 * 1024;
      if (this.totalBytes + sizeBytes > maxBytes) {
        throw new Error(
          `[sandbox] VFS memory limit exceeded (${limits.maxMemoryMB} MB)`,
        );
      }
    }

    if (limits?.maxFileCount && this.fileCount >= limits.maxFileCount) {
      throw new Error(
        `[sandbox] VFS file count limit exceeded (${limits.maxFileCount})`,
      );
    }
  }

  /** Track a file being added to the VFS. */
  trackWrite(sizeBytes: number): void {
    this.fileCount++;
    this.totalBytes += sizeBytes;
  }

  /** Track a file being removed from the VFS. */
  trackDelete(sizeBytes: number): void {
    this.fileCount = Math.max(0, this.fileCount - 1);
    this.totalBytes = Math.max(0, this.totalBytes - sizeBytes);
  }

  // -- Network limits -------------------------------------------------------

  /** Check if a network request to the given URL is allowed. */
  checkNetwork(url: string): void {
    if (!this.opts.network) return;

    if (this.opts.network.blockAll) {
      throw new Error(`[sandbox] All network requests are blocked`);
    }

    if (this.opts.network.allowedHosts) {
      try {
        const hostname = new URL(url).hostname;
        if (!this.opts.network.allowedHosts.includes(hostname)) {
          throw new Error(
            `[sandbox] Network request to '${hostname}' rejected: not in allowed hosts`,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("[sandbox]")) throw e;
        throw new Error(`[sandbox] Invalid URL: ${url}`);
      }
    }
  }

  // -- Execution limits -----------------------------------------------------

  /** Get the execution timeout in milliseconds, or `undefined` if unlimited. */
  get executionTimeout(): number | undefined {
    return this.opts.limits?.maxExecutionMs;
  }

  // -- Diagnostics ----------------------------------------------------------

  get currentFileCount(): number {
    return this.fileCount;
  }
  get currentMemoryBytes(): number {
    return this.totalBytes;
  }
  get currentMemoryMB(): number {
    return this.totalBytes / (1024 * 1024);
  }
}
