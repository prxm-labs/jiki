import type { VFSSnapshot, VFSFileEntry } from "./runtime-interface";
import { uint8ToBase64, base64ToUint8 } from "./utils/binary-encoding";
import {
  createNodeError,
  buildStats,
  type NodeError,
  type Stats,
  type ErrorCode,
} from "./fs-errors";
import {
  nodeToEntry,
  type PersistenceAdapter,
  type PersistedEntry,
} from "./persistence";
import type { SandboxGuard } from "./sandbox";

export { createNodeError, type NodeError, type Stats };

let _nodeInoSeq = 1;

export interface FSNode {
  type: "file" | "directory" | "symlink";
  content?: Uint8Array;
  children?: Map<string, FSNode>;
  target?: string;
  mtime: number;
  ino: number;
}

type ChangeListener = (path: string, content: string) => void;
type DeleteListener = (path: string) => void;
type AnyListener = ChangeListener | DeleteListener;

export type WatchEventType = "change" | "rename";
export type WatchListener = (
  eventType: WatchEventType,
  filename: string | null,
) => void;

export interface FSWatcher {
  close(): void;
  ref(): this;
  unref(): this;
}

interface WatcherEntry {
  listener: WatchListener;
  recursive: boolean;
  closed: boolean;
}

// ---- Path helpers (consolidated into an object) ----

const pops = {
  normalize(p: string): string {
    if (!p.startsWith("/")) p = "/" + p;
    const parts = p.split("/").filter(Boolean);
    const out: string[] = [];
    for (const seg of parts) {
      if (seg === "..") out.pop();
      else if (seg !== ".") out.push(seg);
    }
    return "/" + out.join("/");
  },

  segments(p: string): string[] {
    return pops.normalize(p).split("/").filter(Boolean);
  },

  parent(p: string): string {
    const norm = pops.normalize(p);
    const idx = norm.lastIndexOf("/");
    return idx <= 0 ? "/" : norm.slice(0, idx);
  },

  name(p: string): string {
    const norm = pops.normalize(p);
    return norm.slice(norm.lastIndexOf("/") + 1);
  },
};

// ---- Snapshot serialization (standalone functions) ----

function serializeTree(path: string, node: FSNode, acc: VFSFileEntry[]): void {
  if (node.type === "file") {
    acc.push({
      path,
      type: "file",
      content: node.content?.length ? uint8ToBase64(node.content) : "",
    });
  } else if (node.type === "symlink") {
    acc.push({ path, type: "symlink", target: node.target });
  } else if (node.type === "directory") {
    acc.push({ path, type: "directory" });
    if (node.children) {
      for (const [childName, childNode] of node.children) {
        const childPath =
          path === "/" ? `/${childName}` : `${path}/${childName}`;
        serializeTree(childPath, childNode, acc);
      }
    }
  }
}

function deserializeInto(vfs: MemFS, snapshot: VFSSnapshot): void {
  const ordered = snapshot.files
    .map((e, i) => ({ e, depth: e.path.split("/").length, i }))
    .sort((a, b) => a.depth - b.depth || a.i - b.i)
    .map(x => x.e);

  for (const entry of ordered) {
    if (entry.path === "/") continue;
    switch (entry.type) {
      case "directory":
        vfs.mkdirSync(entry.path, { recursive: true });
        break;
      case "symlink":
        if (entry.target) vfs.symlinkSync(entry.target, entry.path);
        break;
      case "file": {
        const dir = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
        if (dir !== "/" && !vfs.existsSync(dir))
          vfs.mkdirSync(dir, { recursive: true });
        const bytes = entry.content
          ? base64ToUint8(entry.content)
          : new Uint8Array(0);
        vfs.putFile(entry.path, bytes, false);
        break;
      }
    }
  }
}

/** Options for MemFS construction. */
export interface MemFSOptions {
  /** Optional persistence adapter. When provided, filesystem mutations are
   *  automatically persisted to the backend. */
  persistence?: PersistenceAdapter;
  /** Optional sandbox guard. When provided, all write operations are
   *  checked against resource limits and path restrictions. */
  sandbox?: SandboxGuard;
}

export class MemFS {
  private root: FSNode;
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  private watchers = new Map<string, Set<WatcherEntry>>();
  private eventSubs = new Map<string, Set<AnyListener>>();
  private nodeIndex = new Map<string, FSNode>();
  private symlinkLimit = 20;
  private fdCounter = 3; // 0,1,2 reserved for stdin/stdout/stderr
  private fdMap = new Map<number, { path: string; flags: string }>();
  /** Persistence adapter (if configured). */
  private persistence?: PersistenceAdapter;
  /** Sandbox guard (if configured). */
  private sandboxGuard?: SandboxGuard;

  constructor(options?: MemFSOptions) {
    this.root = {
      type: "directory",
      children: new Map(),
      mtime: Date.now(),
      ino: _nodeInoSeq++,
    };
    this.nodeIndex.set("/", this.root);
    this.persistence = options?.persistence;
    this.sandboxGuard = options?.sandbox;
  }

  /**
   * Rehydrate the VFS from the persistence adapter.
   * Call this once during initialisation (e.g. in `Container.init()`) to
   * restore previously persisted state.
   */
  async hydrate(): Promise<number> {
    if (!this.persistence) return 0;
    const entries = await this.persistence.loadAll();
    // Sort by path depth so parents are created before children.
    entries.sort((a, b) => a.path.split("/").length - b.path.split("/").length);

    let count = 0;
    for (const entry of entries) {
      if (entry.path === "/") continue;
      try {
        switch (entry.type) {
          case "directory":
            if (!this.existsSync(entry.path)) {
              this.mkdirSync(entry.path, { recursive: true });
            }
            break;
          case "symlink":
            if (entry.target && !this.existsSync(entry.path)) {
              this.symlinkSync(entry.target, entry.path);
            }
            break;
          case "file": {
            const dir =
              entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
            if (dir !== "/" && !this.existsSync(dir)) {
              this.mkdirSync(dir, { recursive: true });
            }
            const bytes = entry.content ?? new Uint8Array(0);
            // Use putFile with notify=false to avoid triggering watchers
            // and persistence hooks during hydration.
            this.putFile(entry.path, bytes, false);
            break;
          }
        }
        count++;
      } catch {
        // Skip entries that fail to hydrate (e.g. corrupted data).
      }
    }
    return count;
  }

  /**
   * Flush any pending persistence writes immediately.
   * Useful before page unload or when you need to guarantee data is saved.
   */
  async flushPersistence(): Promise<void> {
    if (this.persistence) await this.persistence.flush();
  }

  /** Queue a node for persistence (fire-and-forget). */
  private persist(path: string, node: FSNode): void {
    if (this.persistence) this.persistence.save(nodeToEntry(path, node));
  }

  /** Queue a path deletion for persistence (fire-and-forget). */
  private unpersist(path: string): void {
    if (this.persistence) this.persistence.delete(path);
  }

  /** Queue deletion of a path and all its descendants. */
  private unpersistTree(path: string): void {
    if (!this.persistence) return;
    this.persistence.delete(path);
    // Also delete descendants based on nodeIndex keys.
    const prefix = path === "/" ? "/" : path + "/";
    for (const key of this.nodeIndex.keys()) {
      if (key.startsWith(prefix)) this.persistence.delete(key);
    }
  }

  // ---- Event subscription ----

  on(event: "change", listener: ChangeListener): this;
  on(event: "delete", listener: DeleteListener): this;
  on(event: string, listener: AnyListener): this {
    if (!this.eventSubs.has(event)) this.eventSubs.set(event, new Set());
    this.eventSubs.get(event)!.add(listener);
    return this;
  }

  off(event: "change", listener: ChangeListener): this;
  off(event: "delete", listener: DeleteListener): this;
  off(event: string, listener: AnyListener): this {
    this.eventSubs.get(event)?.delete(listener);
    return this;
  }

  private fire(event: "change", path: string, content: string): void;
  private fire(event: "delete", path: string): void;
  private fire(event: string, ...args: unknown[]): void {
    const subs = this.eventSubs.get(event);
    if (!subs) return;
    for (const fn of subs) {
      try {
        (fn as (...a: unknown[]) => void)(...args);
      } catch (err) {
        console.error("VFS event listener error:", err);
      }
    }
  }

  // ---- Snapshot ----

  toSnapshot(): VFSSnapshot {
    const entries: VFSFileEntry[] = [];
    serializeTree("/", this.root, entries);
    return { files: entries };
  }

  static fromSnapshot(snapshot: VFSSnapshot): MemFS {
    const fs = new MemFS();
    deserializeInto(fs, snapshot);
    return fs;
  }

  // ---- Export ----

  export(
    path: string,
    _options?: { format?: "json" },
  ): Record<string, unknown> {
    const node = this.followLinks(path);
    if (!node || node.type !== "directory")
      throw createNodeError("ENOTDIR", "export", path);
    return this.treeToJson(path, node);
  }

  private treeToJson(path: string, node: FSNode): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!node.children) return out;
    for (const [name, child] of node.children) {
      switch (child.type) {
        case "file":
          out[name] = {
            file: {
              contents: this.dec.decode(child.content || new Uint8Array(0)),
            },
          };
          break;
        case "directory":
          out[name] = { directory: this.treeToJson(`${path}/${name}`, child) };
          break;
        case "symlink":
          out[name] = { file: { symlink: child.target } };
          break;
      }
    }
    return out;
  }

  // ---- Node traversal ----

  private lookupDirect(path: string): FSNode | undefined {
    const norm = pops.normalize(path);
    const cached = this.nodeIndex.get(norm);
    if (cached) return cached;
    const segs = pops.segments(path);
    let cur = this.root;
    for (const seg of segs) {
      if (cur.type !== "directory" || !cur.children) return undefined;
      const next = cur.children.get(seg);
      if (!next) return undefined;
      cur = next;
    }
    this.nodeIndex.set(norm, cur);
    return cur;
  }

  private followLinks(path: string, depth = 0): FSNode | undefined {
    if (depth >= this.symlinkLimit)
      throw createNodeError("ELOOP", "stat", path);

    // Fast path: direct lookup works when no intermediate symlinks exist
    const direct = this.lookupDirect(path);
    if (direct) {
      if (direct.type === "symlink" && direct.target) {
        const dest = direct.target.startsWith("/")
          ? direct.target
          : pops.normalize(pops.parent(path) + "/" + direct.target);
        return this.followLinks(dest, depth + 1);
      }
      return direct;
    }

    // Slow path: walk segment by segment, resolving symlinks at each component
    const segs = pops.segments(path);
    let cur = this.root;
    for (let i = 0; i < segs.length; i++) {
      if (cur.type !== "directory" || !cur.children) return undefined;
      const next = cur.children.get(segs[i]);
      if (!next) return undefined;
      if (next.type === "symlink" && next.target) {
        const builtSoFar = "/" + segs.slice(0, i + 1).join("/");
        const dest = next.target.startsWith("/")
          ? next.target
          : pops.normalize(pops.parent(builtSoFar) + "/" + next.target);
        const remaining = segs.slice(i + 1);
        const full =
          remaining.length > 0 ? dest + "/" + remaining.join("/") : dest;
        return this.followLinks(full, depth + 1);
      }
      cur = next;
    }
    return cur;
  }

  private ensureDir(path: string): FSNode {
    const segs = pops.segments(path);
    let cur = this.root;
    let built = "";
    for (const seg of segs) {
      built += "/" + seg;
      if (!cur.children) cur.children = new Map();
      let child = cur.children.get(seg);
      if (!child) {
        child = {
          type: "directory",
          children: new Map(),
          mtime: Date.now(),
          ino: _nodeInoSeq++,
        };
        cur.children.set(seg, child);
        this.nodeIndex.set(built, child);
      } else if (child.type === "symlink" && child.target) {
        const resolved = this.followLinks(built);
        if (resolved && resolved.type === "directory") {
          child = resolved;
        } else {
          throw createNodeError("ENOTDIR", "mkdir", path);
        }
      } else if (child.type !== "directory") {
        throw createNodeError("ENOTDIR", "mkdir", path);
      }
      cur = child;
    }
    return cur;
  }

  private dropIndex(path: string): void {
    const prefix = pops.normalize(path);
    const fullPrefix = prefix === "/" ? "/" : prefix + "/";
    this.nodeIndex.delete(prefix);
    for (const key of this.nodeIndex.keys()) {
      if (key === prefix || key.startsWith(fullPrefix))
        this.nodeIndex.delete(key);
    }
  }

  // ---- Core FS operations ----

  existsSync(path: string): boolean {
    return this.followLinks(path) !== undefined;
  }

  statSync(path: string): Stats {
    const node = this.followLinks(path);
    if (!node) throw createNodeError("ENOENT", "stat", path);
    return this.toStats(node);
  }

  lstatSync(path: string): Stats {
    const node = this.lookupDirect(path);
    if (!node) throw createNodeError("ENOENT", "lstat", path);
    return this.toStats(node);
  }

  private toStats(node: FSNode): Stats {
    const sz = node.type === "file" ? node.content?.length || 0 : 0;
    return buildStats(node.type, sz, node.mtime, node.ino);
  }

  readFileSync(path: string): Uint8Array;
  readFileSync(path: string, encoding: "utf8" | "utf-8"): string;
  readFileSync(path: string, encoding?: "utf8" | "utf-8"): Uint8Array | string {
    const node = this.followLinks(path);
    if (!node) throw createNodeError("ENOENT", "open", path);
    if (node.type !== "file") throw createNodeError("EISDIR", "read", path);
    const raw = node.content || new Uint8Array(0);
    return encoding === "utf8" || encoding === "utf-8"
      ? this.dec.decode(raw)
      : raw;
  }

  writeFileSync(path: string, data: string | Uint8Array): void {
    this.putFile(path, data, true);
  }

  putFile(path: string, data: string | Uint8Array, notify: boolean): void {
    const norm = pops.normalize(path);
    const dir = pops.parent(norm);
    const base = pops.name(norm);
    if (!base) throw createNodeError("EISDIR", "write", path);

    const bytes = typeof data === "string" ? this.enc.encode(data) : data;

    // Enforce sandbox at the VFS level so all callers are checked.
    if (this.sandboxGuard?.isActive && notify) {
      this.sandboxGuard.checkWrite(norm, bytes.length);
    }

    const parent = this.ensureDir(dir);
    const existed = parent.children!.has(base);

    const fileNode: FSNode = {
      type: "file",
      content: bytes,
      mtime: Date.now(),
      ino: _nodeInoSeq++,
    };
    parent.children!.set(base, fileNode);
    this.nodeIndex.set(norm, fileNode);

    if (notify) {
      if (this.sandboxGuard?.isActive && !existed) {
        this.sandboxGuard.trackWrite(bytes.length);
      }
      this.signalWatchers(norm, existed ? "change" : "rename");
      this.fire(
        "change",
        norm,
        typeof data === "string" ? data : this.dec.decode(data),
      );
      this.persist(norm, fileNode);
    }
  }

  // ---- Symlink ----

  symlinkSync(target: string, linkPath: string): void {
    const norm = pops.normalize(linkPath);
    const dir = pops.parent(norm);
    const base = pops.name(norm);
    if (!base) throw createNodeError("EEXIST", "symlink", linkPath);

    const parent = this.ensureDir(dir);
    if (parent.children!.has(base))
      throw createNodeError("EEXIST", "symlink", linkPath);
    const node: FSNode = {
      type: "symlink",
      target,
      mtime: Date.now(),
      ino: _nodeInoSeq++,
    };
    parent.children!.set(base, node);
    this.nodeIndex.set(norm, node);
    this.persist(norm, node);
  }

  readlinkSync(path: string): string {
    const node = this.lookupDirect(path);
    if (!node) throw createNodeError("ENOENT", "readlink", path);
    if (node.type !== "symlink")
      throw createNodeError("EINVAL", "readlink", path);
    return node.target!;
  }

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    const norm = pops.normalize(path);
    if (options?.recursive) {
      this.ensureDir(norm);
      return;
    }
    const dir = pops.parent(norm);
    const base = pops.name(norm);
    if (!base) {
      // Normalized to "/" — root already exists, nothing to do
      if (norm === "/") return;
      // Empty filename from malformed path
      throw createNodeError("ENOENT", "mkdir", path);
    }

    const parent = this.followLinks(dir);
    if (!parent) throw createNodeError("ENOENT", "mkdir", dir);
    if (parent.type !== "directory")
      throw createNodeError("ENOTDIR", "mkdir", dir);
    if (parent.children!.has(base))
      throw createNodeError("EEXIST", "mkdir", path);
    const newDir: FSNode = {
      type: "directory",
      children: new Map(),
      mtime: Date.now(),
      ino: _nodeInoSeq++,
    };
    parent.children!.set(base, newDir);
    this.nodeIndex.set(norm, newDir);
  }

  readdirSync(path: string): string[];
  readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
  }[];
  readdirSync(path: string, options?: { withFileTypes?: boolean }): unknown {
    const node = this.followLinks(path);
    if (!node) throw createNodeError("ENOENT", "scandir", path);
    if (node.type !== "directory")
      throw createNodeError("ENOTDIR", "scandir", path);
    const names = Array.from(node.children!.keys());
    if (!options?.withFileTypes) return names;
    return names.map(n => {
      const child = node.children!.get(n)!;
      return {
        name: n,
        isFile: () => child.type === "file",
        isDirectory: () => child.type === "directory",
        isSymbolicLink: () => child.type === "symlink",
      };
    });
  }

  unlinkSync(path: string): void {
    const norm = pops.normalize(path);
    const dir = pops.parent(norm);
    const base = pops.name(norm);
    const parent = this.followLinks(dir);
    if (!parent || parent.type !== "directory")
      throw createNodeError("ENOENT", "unlink", path);
    const target = parent.children!.get(base);
    if (!target) throw createNodeError("ENOENT", "unlink", path);
    if (target.type === "directory")
      throw createNodeError("EISDIR", "unlink", path);
    const targetSize =
      target.type === "file" ? (target.content?.length ?? 0) : 0;
    parent.children!.delete(base);
    this.nodeIndex.delete(norm);
    this.signalWatchers(norm, "rename");
    this.fire("delete", norm);
    this.unpersist(norm);
    if (this.sandboxGuard?.isActive) this.sandboxGuard.trackDelete(targetSize);
  }

  rmdirSync(path: string, options?: { recursive?: boolean }): void {
    const norm = pops.normalize(path);
    const dir = pops.parent(norm);
    const base = pops.name(norm);
    if (!base) throw createNodeError("EPERM", "rmdir", path);

    const parent = this.followLinks(dir);
    if (!parent || parent.type !== "directory")
      throw createNodeError("ENOENT", "rmdir", path);
    const target = parent.children!.get(base);
    if (!target) throw createNodeError("ENOENT", "rmdir", path);
    if (target.type !== "directory")
      throw createNodeError("ENOTDIR", "rmdir", path);

    if (options?.recursive) {
      this.unpersistTree(norm);
      parent.children!.delete(base);
      this.dropIndex(norm);
      return;
    }
    if (target.children!.size > 0)
      throw createNodeError("ENOTEMPTY", "rmdir", path);
    parent.children!.delete(base);
    this.nodeIndex.delete(norm);
    this.unpersist(norm);
  }

  rmSync(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): void {
    const norm = pops.normalize(path);
    try {
      const node = this.followLinks(norm);
      if (!node) {
        if (options?.force) return;
        throw createNodeError("ENOENT", "rm", path);
      }
      if (node.type === "directory") {
        if (!options?.recursive) throw createNodeError("EISDIR", "rm", path);
        this.rmdirSync(path, { recursive: true });
      } else {
        this.unlinkSync(path);
      }
    } catch (e) {
      if (options?.force && (e as NodeError).code === "ENOENT") return;
      throw e;
    }
  }

  renameSync(oldPath: string, newPath: string): void {
    const normOld = pops.normalize(oldPath);
    const normNew = pops.normalize(newPath);
    const oldDir = pops.parent(normOld);
    const oldBase = pops.name(normOld);
    const newDir = pops.parent(normNew);
    const newBase = pops.name(normNew);

    const oldParent = this.followLinks(oldDir);
    if (!oldParent || oldParent.type !== "directory")
      throw createNodeError("ENOENT", "rename", oldPath);
    const node = oldParent.children!.get(oldBase);
    if (!node) throw createNodeError("ENOENT", "rename", oldPath);

    const newParent = this.ensureDir(newDir);
    oldParent.children!.delete(oldBase);
    newParent.children!.set(newBase, node);
    this.dropIndex(normOld);
    this.nodeIndex.set(normNew, node);
    this.signalWatchers(normOld, "rename");
    this.signalWatchers(normNew, "rename");
    this.unpersist(normOld);
    this.persist(normNew, node);
  }

  copyFileSync(src: string, dest: string): void {
    const raw = this.readFileSync(src);
    this.writeFileSync(dest, new Uint8Array(raw));
  }

  utimesSync(path: string, _atime: number | Date, mtime: number | Date): void {
    const node = this.followLinks(path);
    if (!node) throw createNodeError("ENOENT", "utimes", path);
    node.mtime = typeof mtime === "number" ? mtime : mtime.getTime();
  }

  accessSync(path: string, _mode?: number): void {
    if (!this.existsSync(path)) throw createNodeError("ENOENT", "access", path);
  }

  realpathSync(path: string): string {
    const norm = pops.normalize(path);
    if (!this.existsSync(norm))
      throw createNodeError("ENOENT", "realpath", path);
    return norm;
  }

  // ---- File descriptor APIs ----

  openSync(path: string, flags: string | number = "r"): number {
    const norm = pops.normalize(path);
    const flagStr = typeof flags === "number" ? "r" : flags;
    if (flagStr === "r" || flagStr === "r+") {
      // File must exist for reading
      this.readFileSync(norm); // throws ENOENT if missing
    }
    if (flagStr === "w" || flagStr === "w+" || flagStr === "a") {
      // Create file if it doesn't exist
      if (!this.existsSync(norm)) {
        this.writeFileSync(norm, "");
      }
    }
    const fd = this.fdCounter++;
    this.fdMap.set(fd, { path: norm, flags: flagStr });
    return fd;
  }

  closeSync(fd: number): void {
    if (!this.fdMap.has(fd)) {
      throw new Error(`EBADF: bad file descriptor, close`);
    }
    this.fdMap.delete(fd);
  }

  readSync(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): number {
    const entry = this.fdMap.get(fd);
    if (!entry) throw new Error(`EBADF: bad file descriptor, read`);
    const content = this.readFileSync(entry.path) as Uint8Array;
    const pos = position ?? 0;
    const end = Math.min(pos + length, content.length);
    const bytesRead = end - pos;
    buffer.set(content.subarray(pos, end), offset);
    return bytesRead;
  }

  writeSync(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): number {
    const entry = this.fdMap.get(fd);
    if (!entry) throw new Error(`EBADF: bad file descriptor, write`);
    const existing = this.existsSync(entry.path)
      ? (this.readFileSync(entry.path) as Uint8Array)
      : new Uint8Array(0);
    const pos = position ?? existing.length;
    const newLen = Math.max(existing.length, pos + length);
    const result = new Uint8Array(newLen);
    result.set(existing);
    result.set(buffer.subarray(offset, offset + length), pos);
    this.writeFileSync(entry.path, result);
    return length;
  }

  fstatSync(fd: number): Stats {
    const entry = this.fdMap.get(fd);
    if (!entry) throw new Error(`EBADF: bad file descriptor, fstat`);
    return this.statSync(entry.path);
  }

  // ---- Async wrappers ----

  readFile(
    path: string,
    optionsOrCb?:
      | { encoding?: string }
      | ((err: Error | null, data?: Uint8Array | string) => void),
    cb?: (err: Error | null, data?: Uint8Array | string) => void,
  ): void {
    const callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
    const opts = typeof optionsOrCb === "object" ? optionsOrCb : undefined;
    try {
      const data = opts?.encoding
        ? this.readFileSync(path, opts.encoding as "utf8")
        : this.readFileSync(path);
      if (callback) setTimeout(() => callback(null, data), 0);
    } catch (err) {
      if (callback) setTimeout(() => callback(err as Error), 0);
    }
  }

  stat(path: string, cb: (err: Error | null, stats?: Stats) => void): void {
    try {
      cb(null, this.statSync(path));
    } catch (err) {
      cb(err as Error);
    }
  }

  lstat(path: string, cb: (err: Error | null, stats?: Stats) => void): void {
    try {
      cb(null, this.lstatSync(path));
    } catch (err) {
      cb(err as Error);
    }
  }

  readdir(
    path: string,
    optionsOrCb?:
      | { withFileTypes?: boolean }
      | ((err: Error | null, files?: string[]) => void),
    cb?: (err: Error | null, files?: unknown) => void,
  ): void {
    const callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
    const opts = typeof optionsOrCb === "object" ? optionsOrCb : undefined;
    try {
      const files = opts?.withFileTypes
        ? this.readdirSync(path, { withFileTypes: true })
        : this.readdirSync(path);
      if (callback) setTimeout(() => callback(null, files as string[]), 0);
    } catch (err) {
      if (callback) setTimeout(() => callback(err as Error), 0);
    }
  }

  realpath(
    path: string,
    cb: (err: Error | null, resolved?: string) => void,
  ): void {
    try {
      cb(null, this.realpathSync(path));
    } catch (err) {
      cb(err as Error);
    }
  }

  access(
    path: string,
    modeOrCb?: number | ((err: Error | null) => void),
    cb?: (err: Error | null) => void,
  ): void {
    const callback = typeof modeOrCb === "function" ? modeOrCb : cb;
    try {
      this.accessSync(path);
      if (callback) setTimeout(() => callback(null), 0);
    } catch (err) {
      if (callback) setTimeout(() => callback(err as Error), 0);
    }
  }

  // ---- File watching ----

  watch(
    filename: string,
    optionsOrListener?:
      | { persistent?: boolean; recursive?: boolean; encoding?: string }
      | WatchListener,
    listener?: WatchListener,
  ): FSWatcher {
    const norm = pops.normalize(filename);
    let opts: { recursive?: boolean } = {};
    let actualListener: WatchListener | undefined;

    if (typeof optionsOrListener === "function") {
      actualListener = optionsOrListener;
    } else if (optionsOrListener) {
      opts = optionsOrListener;
      actualListener = listener;
    } else {
      actualListener = listener;
    }

    const entry: WatcherEntry = {
      listener: actualListener || (() => {}),
      recursive: opts.recursive || false,
      closed: false,
    };

    if (!this.watchers.has(norm)) this.watchers.set(norm, new Set());
    this.watchers.get(norm)!.add(entry);

    const handle: FSWatcher = {
      close: () => {
        entry.closed = true;
        const bucket = this.watchers.get(norm);
        if (bucket) {
          bucket.delete(entry);
          if (bucket.size === 0) this.watchers.delete(norm);
        }
      },
      ref: () => handle,
      unref: () => handle,
    };
    return handle;
  }

  private signalWatchers(changedPath: string, kind: WatchEventType): void {
    const norm = pops.normalize(changedPath);
    const leaf = pops.name(norm);

    for (const [watchPath, bucket] of this.watchers) {
      if (watchPath === norm) {
        for (const w of bucket) {
          if (!w.closed) {
            try {
              w.listener(kind, leaf);
            } catch {}
          }
        }
        continue;
      }

      if (!norm.startsWith(watchPath + "/") && watchPath !== "/") continue;

      const isDirectChild = pops.parent(norm) === watchPath;
      const rel =
        norm === watchPath
          ? ""
          : norm.slice((watchPath === "/" ? 0 : watchPath.length) + 1);

      for (const w of bucket) {
        if (w.closed) continue;
        if (w.recursive || isDirectChild) {
          try {
            w.listener(kind, rel);
          } catch {}
        }
      }
    }
  }

  // ---- Stream helpers ----

  createReadStream(path: string): {
    on: (event: string, cb: (...args: unknown[]) => void) => unknown;
    pipe: (dest: unknown) => unknown;
  } {
    const self = this;
    const subs: Record<string, ((...args: unknown[]) => void)[]> = {};
    const stream = {
      on(ev: string, cb: (...args: unknown[]) => void) {
        (subs[ev] ??= []).push(cb);
        return stream;
      },
      pipe(dest: unknown) {
        return dest;
      },
    };
    setTimeout(() => {
      try {
        const data = self.readFileSync(path);
        subs["data"]?.forEach(cb => cb(data));
        subs["end"]?.forEach(cb => cb());
      } catch (err) {
        subs["error"]?.forEach(cb => cb(err));
      }
    }, 0);
    return stream;
  }

  createWriteStream(path: string): {
    write: (data: string | Uint8Array) => boolean;
    end: (data?: string | Uint8Array) => void;
    on: (event: string, cb: (...args: unknown[]) => void) => unknown;
  } {
    const self = this;
    const parts: Uint8Array[] = [];
    const subs: Record<string, ((...args: unknown[]) => void)[]> = {};
    const encoder = new TextEncoder();
    return {
      write(data: string | Uint8Array): boolean {
        parts.push(typeof data === "string" ? encoder.encode(data) : data);
        return true;
      },
      end(data?: string | Uint8Array): void {
        if (data)
          parts.push(typeof data === "string" ? encoder.encode(data) : data);
        const total = parts.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const chunk of parts) {
          merged.set(chunk, off);
          off += chunk.length;
        }
        self.writeFileSync(path, merged);
        subs["finish"]?.forEach(cb => cb());
        subs["close"]?.forEach(cb => cb());
      },
      on(ev: string, cb: (...args: unknown[]) => void) {
        (subs[ev] ??= []).push(cb);
        return this;
      },
    };
  }
}
