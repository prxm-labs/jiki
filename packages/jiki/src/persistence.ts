/**
 * Persistence layer for MemFS.
 *
 * Provides a `PersistenceAdapter` interface and an `IndexedDBAdapter`
 * implementation that synchronises the in-memory filesystem to IndexedDB.
 *
 * Writes are fire-and-forget — they never block the synchronous VFS API.
 * Mutations are batched and flushed via microtask debounce (~100 ms) so
 * rapid consecutive writes result in a single IndexedDB transaction.
 *
 * @example
 * ```ts
 * const adapter = new IndexedDBAdapter('my-project');
 * const vfs = new MemFS({ persistence: adapter });
 * await vfs.hydrate(); // load persisted state
 * vfs.writeFileSync('/hello.txt', 'world'); // auto-persisted
 * ```
 */

import type { FSNode } from "./memfs";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Serialised form of a single filesystem entry stored in the adapter. */
export interface PersistedEntry {
  path: string;
  type: "file" | "directory" | "symlink";
  /** File content as Uint8Array. Only set for type === "file". */
  content?: Uint8Array;
  /** Symlink target. Only set for type === "symlink". */
  target?: string;
  mtime: number;
}

/**
 * Backend-agnostic interface for persisting MemFS state.
 * Implement this to plug in any storage backend (IndexedDB, OPFS,
 * localStorage, etc.).
 */
export interface PersistenceAdapter {
  /** Persist a single entry (upsert by path). */
  save(entry: PersistedEntry): void;
  /** Delete a persisted entry by path. */
  delete(path: string): void;
  /** Load all persisted entries. */
  loadAll(): Promise<PersistedEntry[]>;
  /** Delete all persisted entries. */
  clear(): Promise<void>;
  /** Flush any pending writes immediately. Returns when the flush completes. */
  flush(): Promise<void>;
}

// ---------------------------------------------------------------------------
// IndexedDB adapter
// ---------------------------------------------------------------------------

/** Options for the IndexedDB adapter. */
export interface IndexedDBAdapterOptions {
  /** IndexedDB database name. Defaults to `"jiki-vfs"`. */
  dbName?: string;
  /** Object store name. Defaults to `"files"`. */
  storeName?: string;
  /** Batch flush interval in milliseconds. Defaults to 100. */
  flushIntervalMs?: number;
}

/**
 * Persists MemFS entries to IndexedDB.
 *
 * Mutations are batched into a queue and flushed periodically (default
 * every 100 ms) in a single readwrite transaction for performance.
 */
export class IndexedDBAdapter implements PersistenceAdapter {
  private dbName: string;
  private storeName: string;
  private flushIntervalMs: number;
  private db: IDBDatabase | null = null;
  private queue: Array<
    { type: "save"; entry: PersistedEntry } | { type: "delete"; path: string }
  > = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;

  constructor(options: IndexedDBAdapterOptions = {}) {
    this.dbName = options.dbName ?? "jiki-vfs";
    this.storeName = options.storeName ?? "files";
    this.flushIntervalMs = options.flushIntervalMs ?? 100;
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "path" });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  save(entry: PersistedEntry): void {
    this.queue.push({ type: "save", entry });
    this.scheduleFlush();
  }

  delete(path: string): void {
    this.queue.push({ type: "delete", path });
    this.scheduleFlush();
  }

  async loadAll(): Promise<PersistedEntry[]> {
    const db = await this.openDB();
    return new Promise<PersistedEntry[]>((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as PersistedEntry[]);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async flush(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);

      for (const op of batch) {
        if (op.type === "save") {
          store.put(op.entry);
        } else {
          store.delete(op.path);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPromise = this.flush().catch(err => {
        console.error("[jiki:persistence] flush failed:", err);
      });
    }, this.flushIntervalMs);
  }
}

// ---------------------------------------------------------------------------
// In-memory adapter (for testing and non-browser environments)
// ---------------------------------------------------------------------------

/**
 * In-memory adapter that stores entries in a `Map`.
 * Useful for tests and server-side usage where IndexedDB is unavailable.
 */
export class InMemoryAdapter implements PersistenceAdapter {
  private store = new Map<string, PersistedEntry>();

  save(entry: PersistedEntry): void {
    this.store.set(entry.path, entry);
  }

  delete(path: string): void {
    this.store.delete(path);
  }

  async loadAll(): Promise<PersistedEntry[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async flush(): Promise<void> {
    // No-op — writes are synchronous in memory.
  }

  /** Return the number of stored entries (test helper). */
  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Helper: convert FSNode ↔ PersistedEntry
// ---------------------------------------------------------------------------

/** Convert an FSNode at the given path to a PersistedEntry. */
export function nodeToEntry(path: string, node: FSNode): PersistedEntry {
  const entry: PersistedEntry = {
    path,
    type: node.type,
    mtime: node.mtime,
  };
  if (node.type === "file" && node.content) {
    entry.content = node.content;
  }
  if (node.type === "symlink" && node.target) {
    entry.target = node.target;
  }
  return entry;
}
