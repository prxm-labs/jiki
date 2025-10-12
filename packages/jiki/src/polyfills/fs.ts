import type { MemFS, Stats } from "../memfs";
import * as pathShim from "./path";
import { BufferImpl } from "./stream";

export interface FsShim {
  readFileSync: (
    path: string,
    encoding?: string | { encoding?: string },
  ) => string | Uint8Array;
  writeFileSync: (path: string, data: string | Uint8Array) => void;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  readdirSync: (path: string, options?: { withFileTypes?: boolean }) => unknown;
  statSync: (path: string) => Stats;
  lstatSync: (path: string) => Stats;
  unlinkSync: (path: string) => void;
  rmdirSync: (path: string, options?: { recursive?: boolean }) => void;
  rmSync: (
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ) => void;
  renameSync: (old: string, n: string) => void;
  copyFileSync: (src: string, dest: string) => void;
  accessSync: (path: string, mode?: number) => void;
  realpathSync: (path: string) => string;
  symlinkSync: (target: string, linkPath: string) => void;
  readlinkSync: (path: string) => string;
  chmodSync: (path: string, mode: number) => void;
  chownSync: (path: string, uid: number, gid: number) => void;
  lchmodSync: (path: string, mode: number) => void;
  lchownSync: (path: string, uid: number, gid: number) => void;
  openSync: (path: string, flags?: string | number) => number;
  closeSync: (fd: number) => void;
  readSync: (
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ) => number;
  writeSync: (
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ) => number;
  fstatSync: (fd: number) => Stats;
  watch: MemFS["watch"];
  createReadStream: MemFS["createReadStream"];
  createWriteStream: MemFS["createWriteStream"];
  readFile: MemFS["readFile"];
  stat: MemFS["stat"];
  lstat: MemFS["lstat"];
  readdir: MemFS["readdir"];
  realpath: MemFS["realpath"];
  access: MemFS["access"];
  promises: {
    readFile: (
      path: string,
      encoding?: string | { encoding?: string },
    ) => Promise<string | Uint8Array>;
    writeFile: (path: string, data: string | Uint8Array) => Promise<void>;
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    readdir: (
      path: string,
      options?: { withFileTypes?: boolean },
    ) => Promise<unknown>;
    stat: (path: string) => Promise<Stats>;
    lstat: (path: string) => Promise<Stats>;
    unlink: (path: string) => Promise<void>;
    rmdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    rm: (
      path: string,
      options?: { recursive?: boolean; force?: boolean },
    ) => Promise<void>;
    rename: (old: string, n: string) => Promise<void>;
    access: (path: string, mode?: number) => Promise<void>;
    realpath: (path: string) => Promise<string>;
    copyFile: (src: string, dest: string) => Promise<void>;
    symlink: (target: string, linkPath: string) => Promise<void>;
    readlink: (path: string) => Promise<string>;
    chmod: (path: string, mode: number) => Promise<void>;
    chown: (path: string, uid: number, gid: number) => Promise<void>;
    lchmod: (path: string, mode: number) => Promise<void>;
    lchown: (path: string, uid: number, gid: number) => Promise<void>;
  };
  constants: Record<string, number>;
}

export function createFsShim(vfs: MemFS, getCwd: () => string): FsShim {
  const resolvePath = (p: string): string => {
    if (typeof p !== "string") p = String(p);
    if (p.startsWith("file://")) p = p.replace(/^file:\/\//, "");
    return pathShim.isAbsolute(p) ? p : pathShim.resolve(getCwd(), p);
  };

  const parseEncoding = (
    enc?: string | { encoding?: string },
  ): string | undefined => {
    if (typeof enc === "string") return enc;
    if (enc && typeof enc === "object") return enc.encoding;
    return undefined;
  };

  const shim: FsShim = {
    readFileSync(path, encoding?) {
      const enc = parseEncoding(encoding);
      if (enc) return vfs.readFileSync(resolvePath(path), enc as "utf8");
      const raw = vfs.readFileSync(resolvePath(path));
      return raw instanceof Uint8Array ? BufferImpl.from(raw) : raw;
    },
    writeFileSync(path, data) {
      vfs.writeFileSync(resolvePath(path), data);
    },
    existsSync(path) {
      return vfs.existsSync(resolvePath(path));
    },
    mkdirSync(path, opts?) {
      vfs.mkdirSync(resolvePath(path), opts);
    },
    readdirSync(path, opts?) {
      if (opts?.withFileTypes)
        return vfs.readdirSync(resolvePath(path), { withFileTypes: true });
      return vfs.readdirSync(resolvePath(path));
    },
    statSync(path) {
      return vfs.statSync(resolvePath(path));
    },
    lstatSync(path) {
      return vfs.lstatSync(resolvePath(path));
    },
    unlinkSync(path) {
      vfs.unlinkSync(resolvePath(path));
    },
    rmdirSync(path, opts?) {
      vfs.rmdirSync(resolvePath(path), opts);
    },
    rmSync(path, opts?) {
      vfs.rmSync(resolvePath(path), opts);
    },
    renameSync(old, n) {
      vfs.renameSync(resolvePath(old), resolvePath(n));
    },
    copyFileSync(src, dest) {
      vfs.copyFileSync(resolvePath(src), resolvePath(dest));
    },
    accessSync(path, mode?) {
      vfs.accessSync(resolvePath(path), mode);
    },
    realpathSync: Object.assign(
      (path: string) => vfs.realpathSync(resolvePath(path)),
      { native: (path: string) => vfs.realpathSync(resolvePath(path)) },
    ),
    symlinkSync(target, linkPath) {
      vfs.symlinkSync(target, resolvePath(linkPath));
    },
    readlinkSync(path) {
      return vfs.readlinkSync(resolvePath(path));
    },
    chmodSync(path: string, _mode: number) {
      console.warn(
        `[jiki] fs.chmodSync('${resolvePath(path)}') is a no-op — file permissions not supported in browser runtime`,
      );
    },
    chownSync(path: string, _uid: number, _gid: number) {
      console.warn(
        `[jiki] fs.chownSync('${resolvePath(path)}') is a no-op — file ownership not supported in browser runtime`,
      );
    },
    lchmodSync(path: string, _mode: number) {
      console.warn(
        `[jiki] fs.lchmodSync('${resolvePath(path)}') is a no-op — file permissions not supported in browser runtime`,
      );
    },
    lchownSync(path: string, _uid: number, _gid: number) {
      console.warn(
        `[jiki] fs.lchownSync('${resolvePath(path)}') is a no-op — file ownership not supported in browser runtime`,
      );
    },
    openSync(path, flags?) {
      return vfs.openSync(resolvePath(path), flags);
    },
    closeSync(fd) {
      vfs.closeSync(fd);
    },
    readSync(fd, buffer, offset, length, position) {
      return vfs.readSync(fd, buffer, offset, length, position);
    },
    writeSync(fd, buffer, offset, length, position) {
      return vfs.writeSync(fd, buffer, offset, length, position);
    },
    fstatSync(fd) {
      return vfs.fstatSync(fd);
    },
    watch: vfs.watch.bind(vfs),
    createReadStream: vfs.createReadStream.bind(vfs),
    createWriteStream: vfs.createWriteStream.bind(vfs),
    readFile: vfs.readFile.bind(vfs),
    stat: vfs.stat.bind(vfs),
    lstat: vfs.lstat.bind(vfs),
    readdir: vfs.readdir.bind(vfs),
    realpath: vfs.realpath.bind(vfs),
    access: vfs.access.bind(vfs),
    promises: {
      async readFile(path, encoding?) {
        const enc = parseEncoding(encoding);
        if (enc) return vfs.readFileSync(resolvePath(path), enc as "utf8");
        const raw = vfs.readFileSync(resolvePath(path));
        return raw instanceof Uint8Array ? BufferImpl.from(raw) : raw;
      },
      async writeFile(path, data) {
        vfs.writeFileSync(resolvePath(path), data);
      },
      async mkdir(path, opts?) {
        vfs.mkdirSync(resolvePath(path), opts);
      },
      async readdir(path, opts?) {
        if (opts?.withFileTypes)
          return vfs.readdirSync(resolvePath(path), { withFileTypes: true });
        return vfs.readdirSync(resolvePath(path));
      },
      async stat(path) {
        return vfs.statSync(resolvePath(path));
      },
      async lstat(path) {
        return vfs.lstatSync(resolvePath(path));
      },
      async unlink(path) {
        vfs.unlinkSync(resolvePath(path));
      },
      async rmdir(path, opts?) {
        vfs.rmdirSync(resolvePath(path), opts);
      },
      async rm(path, opts?) {
        vfs.rmSync(resolvePath(path), opts);
      },
      async rename(old, n) {
        vfs.renameSync(resolvePath(old), resolvePath(n));
      },
      async access(path, mode?) {
        vfs.accessSync(resolvePath(path), mode);
      },
      async realpath(path) {
        return vfs.realpathSync(resolvePath(path));
      },
      async copyFile(src, dest) {
        vfs.copyFileSync(resolvePath(src), resolvePath(dest));
      },
      async symlink(target, linkPath) {
        vfs.symlinkSync(target, resolvePath(linkPath));
      },
      async readlink(path) {
        return vfs.readlinkSync(resolvePath(path));
      },
      async chmod(path: string, _mode: number) {
        console.warn(
          `[jiki] fs.promises.chmod('${resolvePath(path)}') is a no-op — file permissions not supported in browser runtime`,
        );
      },
      async chown(path: string, _uid: number, _gid: number) {
        console.warn(
          `[jiki] fs.promises.chown('${resolvePath(path)}') is a no-op — file ownership not supported in browser runtime`,
        );
      },
      async lchmod(path: string, _mode: number) {
        console.warn(
          `[jiki] fs.promises.lchmod('${resolvePath(path)}') is a no-op — file permissions not supported in browser runtime`,
        );
      },
      async lchown(path: string, _uid: number, _gid: number) {
        console.warn(
          `[jiki] fs.promises.lchown('${resolvePath(path)}') is a no-op — file ownership not supported in browser runtime`,
        );
      },
    },
    constants: {
      F_OK: 0,
      R_OK: 4,
      W_OK: 2,
      X_OK: 1,
      O_RDONLY: 0,
      O_WRONLY: 1,
      O_RDWR: 2,
      O_CREAT: 64,
      O_EXCL: 128,
      O_TRUNC: 512,
      O_APPEND: 1024,
      S_IFMT: 61440,
      S_IFREG: 32768,
      S_IFDIR: 16384,
      S_IFLNK: 40960,
    },
  };

  return shim;
}
