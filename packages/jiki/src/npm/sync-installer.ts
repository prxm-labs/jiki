import pako from "pako";
import { MemFS } from "../memfs";
import * as pathShim from "../polyfills/path";
import type { AutoInstallProvider } from "../module-resolver";
import type { LayoutStrategy } from "./index";

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

function unpackTarSync(tar: Uint8Array, vfs: MemFS, dest: string): void {
  vfs.mkdirSync(dest, { recursive: true });
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
    const fullName = prefix ? `${prefix}/${rawName}` : rawName;

    const relative = fullName.split("/").slice(1).join("/");
    if (!relative || relative === ".") {
      pos += Math.ceil(size / BLOCK) * BLOCK;
      continue;
    }

    const target = pathShim.join(dest, relative);
    const parentDir = pathShim.dirname(target);

    if (type === 53 || fullName.endsWith("/")) {
      vfs.mkdirSync(target, { recursive: true });
    } else if (type === 0 || type === 48) {
      vfs.mkdirSync(parentDir, { recursive: true });
      const data =
        size > 0 && pos + size <= tar.length
          ? new Uint8Array(tar.subarray(pos, pos + size))
          : new Uint8Array(0);
      vfs.writeFileSync(target, data);
    } else if (type === 50 && linkTarget) {
      try {
        vfs.mkdirSync(parentDir, { recursive: true });
        vfs.symlinkSync(linkTarget, target);
      } catch {
        /* skip symlink errors */
      }
    }

    pos += Math.ceil(size / BLOCK) * BLOCK;
  }
}

function syncFetch(url: string): Uint8Array {
  if (typeof XMLHttpRequest === "undefined") {
    throw new Error(
      "Synchronous auto-install requires XMLHttpRequest (browser environment)",
    );
  }
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.responseType = "arraybuffer";
  xhr.send();
  if (xhr.status < 200 || xhr.status >= 300) {
    throw new Error(`Failed to fetch ${url}: ${xhr.status}`);
  }
  return new Uint8Array(xhr.response as ArrayBuffer);
}

interface ManifestVersion {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  dist: { tarball: string; shasum: string };
  bin?: string | Record<string, string>;
}

interface Manifest {
  name: string;
  "dist-tags": Record<string, string>;
  versions: Record<string, ManifestVersion>;
}

function normalizeBin(
  pkgName: string,
  bin?: Record<string, string> | string,
): Record<string, string> {
  if (!bin) return {};
  if (typeof bin === "string") {
    const cmdName = pkgName.includes("/") ? pkgName.split("/").pop()! : pkgName;
    return { [cmdName]: bin };
  }
  return bin;
}

export class SyncAutoInstaller implements AutoInstallProvider {
  private vfs: MemFS;
  private registryUrl: string;
  private cwd: string;
  private layout: LayoutStrategy;
  private manifestCache = new Map<string, Manifest>();
  private installed = new Set<string>();

  constructor(
    vfs: MemFS,
    layout: LayoutStrategy,
    options: { cwd?: string; registry?: string } = {},
  ) {
    this.vfs = vfs;
    this.cwd = options.cwd || "/";
    this.registryUrl = (
      options.registry || "https://registry.npmjs.org"
    ).replace(/\/$/, "");
    this.layout = layout;
  }

  installSync(name: string): void {
    if (this.installed.has(name)) return;
    const destDir = this.layout.getPackageDir(this.cwd, name, "latest");
    if (this.vfs.existsSync(destDir)) {
      this.installed.add(name);
      return;
    }

    const manifest = this.fetchManifestSync(name);
    const latestTag = manifest["dist-tags"]?.latest;
    if (!latestTag) throw new Error(`No latest version for ${name}`);

    const version = manifest.versions[latestTag];
    if (!version) throw new Error(`Version ${latestTag} not found for ${name}`);

    this.installPackageSync(version);
    this.installed.add(name);
  }

  private installPackageSync(pkg: ManifestVersion): void {
    const destDir = this.layout.getPackageDir(this.cwd, pkg.name, pkg.version);
    if (this.vfs.existsSync(destDir)) return;

    const compressed = syncFetch(pkg.dist.tarball);
    let tar: Uint8Array;
    try {
      tar = pako.ungzip(compressed);
    } catch {
      tar = compressed;
    }

    unpackTarSync(tar, this.vfs, destDir);
    this.layout.createTopLevelLink(this.vfs, this.cwd, pkg.name, pkg.version);

    const binEntries = normalizeBin(pkg.name, pkg.bin);
    for (const [cmdName, binPath] of Object.entries(binEntries)) {
      const targetPath = pathShim.join(destDir, binPath);
      this.layout.createBinStub(this.vfs, this.cwd, cmdName, targetPath);
    }

    if (pkg.dependencies) {
      for (const depName of Object.keys(pkg.dependencies)) {
        try {
          this.installSync(depName);
        } catch {
          /* skip optional failures */
        }
      }
    }
  }

  private fetchManifestSync(name: string): Manifest {
    if (this.manifestCache.has(name)) return this.manifestCache.get(name)!;

    const encodedName = name.startsWith("@")
      ? `@${encodeURIComponent(name.slice(1))}`
      : encodeURIComponent(name);
    const url = `${this.registryUrl}/${encodedName}`;

    if (typeof XMLHttpRequest === "undefined") {
      throw new Error(
        "Synchronous auto-install requires XMLHttpRequest (browser environment)",
      );
    }
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.send();

    if (xhr.status < 200 || xhr.status >= 300) {
      throw new Error(`Failed to fetch manifest for ${name}: ${xhr.status}`);
    }

    const manifest = JSON.parse(xhr.responseText) as Manifest;
    this.manifestCache.set(name, manifest);
    return manifest;
  }
}
