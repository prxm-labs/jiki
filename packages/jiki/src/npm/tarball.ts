import pako from "pako";
import { MemFS } from "../memfs";
import * as pathShim from "../polyfills/path";
import type { PackageCache } from "./cache";

const BLOCK = 512;
const decoder = new TextDecoder();

function decodeField(buf: Uint8Array, start: number, len: number): string {
  let i = start;
  const limit = start + len;
  while (i < limit && buf[i] !== 0) i++;
  return decoder.decode(buf.subarray(start, i));
}

function readSize(buf: Uint8Array, offset: number, len: number): number {
  return parseInt(decodeField(buf, offset, len), 8) || 0;
}

function isZeroBlock(buf: Uint8Array): boolean {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0) return false;
  }
  return true;
}

function decompress(raw: Uint8Array): Uint8Array {
  try {
    return pako.ungzip(raw);
  } catch {
    return raw;
  }
}

async function fetchArchive(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function* iterateEntries(tar: Uint8Array): Generator<{
  name: string;
  size: number;
  type: number;
  linkTarget: string;
  data: Uint8Array | null;
}> {
  let pos = 0;
  while (pos + BLOCK <= tar.length) {
    const hdr = tar.subarray(pos, pos + BLOCK);
    pos += BLOCK;

    if (isZeroBlock(hdr)) break;

    const rawName = decodeField(hdr, 0, 100);
    if (!rawName) break;

    const size = readSize(hdr, 124, 12);
    const type = hdr[156];
    const linkTarget = decodeField(hdr, 157, 100);
    const prefix = decodeField(hdr, 345, 155);
    const name = prefix ? `${prefix}/${rawName}` : rawName;

    let data: Uint8Array | null = null;
    if (size > 0 && pos + size <= tar.length) {
      data = tar.subarray(pos, pos + size);
    }

    yield { name, size, type, linkTarget, data };
    pos += Math.ceil(size / BLOCK) * BLOCK;
  }
}

function stripPrefix(name: string, depth: number): string {
  if (depth <= 0) return name;
  return name.split("/").slice(depth).join("/");
}

function unpackEntries(
  tar: Uint8Array,
  vfs: MemFS,
  dest: string,
  stripDepth: number,
): void {
  vfs.mkdirSync(dest, { recursive: true });

  for (const entry of iterateEntries(tar)) {
    const relative = stripPrefix(entry.name, stripDepth);
    if (!relative || relative === ".") continue;

    const target = pathShim.join(dest, relative);
    const parentDir = pathShim.dirname(target);

    if (entry.type === 53 || entry.name.endsWith("/")) {
      vfs.mkdirSync(target, { recursive: true });
    } else if (entry.type === 0 || entry.type === 48) {
      vfs.mkdirSync(parentDir, { recursive: true });
      vfs.writeFileSync(
        target,
        entry.data ? new Uint8Array(entry.data) : new Uint8Array(0),
      );
    } else if (entry.type === 50 && entry.linkTarget) {
      try {
        vfs.mkdirSync(parentDir, { recursive: true });
        vfs.symlinkSync(entry.linkTarget, target);
      } catch {}
    }
  }
}

export async function downloadAndExtract(
  url: string,
  vfs: MemFS,
  destDir: string,
  stripComponents = 1,
  cache?: PackageCache,
): Promise<void> {
  let compressed: Uint8Array;
  if (cache) {
    compressed = await cache.getTarball(url, () => fetchArchive(url));
  } else {
    compressed = await fetchArchive(url);
  }
  const tar = decompress(compressed);
  unpackEntries(tar, vfs, destDir, stripComponents);
}

export async function extractTarball(
  data: Uint8Array,
  vfs: MemFS,
  destDir: string,
  stripComponents = 1,
): Promise<void> {
  const tar = decompress(data);
  unpackEntries(tar, vfs, destDir, stripComponents);
}
