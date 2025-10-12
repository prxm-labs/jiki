import type { MemFS } from "../memfs";
import * as pathShim from "./path";

let _vfs: MemFS | null = null;
export function initReaddirp(vfs: MemFS): void {
  _vfs = vfs;
}

export interface ReaddirpEntry {
  path: string;
  fullPath: string;
  basename: string;
  dirent: { isFile(): boolean; isDirectory(): boolean };
}

export default function readdirp(
  root: string,
  options?: {
    fileFilter?: string | string[];
    directoryFilter?: string | string[];
    depth?: number;
  },
): AsyncIterable<ReaddirpEntry> & {
  [Symbol.asyncIterator](): AsyncIterableIterator<ReaddirpEntry>;
} {
  const entries: ReaddirpEntry[] = [];

  if (_vfs) {
    const collect = (dir: string, depth: number) => {
      if (options?.depth !== undefined && depth > options.depth) return;
      try {
        const items = _vfs!.readdirSync(dir);
        for (const name of items) {
          const fullPath = pathShim.join(dir, name);
          try {
            const stat = _vfs!.statSync(fullPath);
            entries.push({
              path: pathShim.relative(root, fullPath),
              fullPath,
              basename: name,
              dirent: {
                isFile: () => stat.isFile(),
                isDirectory: () => stat.isDirectory(),
              },
            });
            if (stat.isDirectory()) collect(fullPath, depth + 1);
          } catch {}
        }
      } catch {}
    };
    collect(root, 0);
  }

  let idx = 0;
  return {
    [Symbol.asyncIterator](): AsyncIterableIterator<ReaddirpEntry> {
      return {
        next(): Promise<IteratorResult<ReaddirpEntry>> {
          if (idx < entries.length)
            return Promise.resolve({ value: entries[idx++], done: false });
          return Promise.resolve({
            value: undefined as unknown as ReaddirpEntry,
            done: true,
          });
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  };
}
