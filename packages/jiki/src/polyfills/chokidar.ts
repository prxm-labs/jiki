import { EventEmitter } from "./events";
import type { MemFS } from "../memfs";

let _vfs: MemFS | null = null;
export function initChokidar(vfs: MemFS): void {
  _vfs = vfs;
}

export class FSWatcher extends EventEmitter {
  closed = false;
  private watchers: { close(): void }[] = [];

  add(paths: string | string[]): this {
    if (!_vfs) return this;
    const pathList = Array.isArray(paths) ? paths : [paths];
    for (const p of pathList) {
      try {
        const watcher = _vfs.watch(
          p,
          { recursive: true },
          (eventType, filename) => {
            if (this.closed) return;
            this.emit("change", `${p}/${filename}`);
            this.emit("all", eventType, `${p}/${filename}`);
          },
        );
        this.watchers.push(watcher);
      } catch {}
    }
    setTimeout(() => this.emit("ready"), 0);
    return this;
  }

  unwatch(_paths: string | string[]): this {
    return this;
  }
  close(): Promise<void> {
    this.closed = true;
    this.watchers.forEach(w => w.close());
    return Promise.resolve();
  }
  getWatched(): Record<string, string[]> {
    return {};
  }
}

export function watch(paths: string | string[], _options?: unknown): FSWatcher {
  const watcher = new FSWatcher();
  return watcher.add(paths);
}

export default { watch, FSWatcher, initChokidar };
