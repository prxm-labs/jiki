export interface NodeError extends Error {
  code: string;
  errno: number;
  syscall: string;
  path?: string;
}

export type ErrorCode =
  | "ENOENT"
  | "ENOTDIR"
  | "EISDIR"
  | "EEXIST"
  | "ENOTEMPTY"
  | "ELOOP"
  | "EINVAL"
  | "EPERM";

const ERRORS: Record<string, { errno: number; text: string }> = {
  ENOENT: { errno: -2, text: "no such file or directory" },
  ENOTDIR: { errno: -20, text: "not a directory" },
  EISDIR: { errno: -21, text: "is a directory" },
  EEXIST: { errno: -17, text: "file already exists" },
  ENOTEMPTY: { errno: -39, text: "directory not empty" },
  ELOOP: { errno: -40, text: "too many levels of symbolic links" },
  EINVAL: { errno: -22, text: "invalid argument" },
  EPERM: { errno: -1, text: "operation not permitted" },
};

export function createNodeError(
  code: ErrorCode,
  syscall: string,
  path: string,
  message?: string,
): NodeError {
  const info = ERRORS[code];
  const e = new Error(
    message || `[${code}] ${syscall}: ${info.text} (${path})`,
  ) as NodeError;
  e.code = code;
  e.errno = info.errno;
  e.syscall = syscall;
  e.path = path;
  return e;
}

export interface Stats {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  size: number;
  mode: number;
  mtime: Date;
  atime: Date;
  ctime: Date;
  birthtime: Date;
  mtimeMs: number;
  atimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  nlink: number;
  uid: number;
  gid: number;
  dev: number;
  ino: number;
  rdev: number;
  blksize: number;
  blocks: number;
}

let inoSeq = 1;

function modeForType(type: "file" | "directory" | "symlink"): number {
  if (type === "directory") return 0o755;
  if (type === "symlink") return 0o777;
  return 0o644;
}

export function buildStats(
  type: "file" | "directory" | "symlink",
  size: number,
  mtime: number,
  ino?: number,
): Stats {
  const ts = mtime;
  const id = ino ?? inoSeq++;
  const m = modeForType(type);
  return {
    isFile: () => type === "file",
    isDirectory: () => type === "directory",
    isSymbolicLink: () => type === "symlink",
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    size,
    mode: m,
    mtime: new Date(ts),
    atime: new Date(ts),
    ctime: new Date(ts),
    birthtime: new Date(ts),
    mtimeMs: ts,
    atimeMs: ts,
    ctimeMs: ts,
    birthtimeMs: ts,
    nlink: 1,
    uid: 1000,
    gid: 1000,
    dev: 0,
    ino: id,
    rdev: 0,
    blksize: 4096,
    blocks: Math.ceil(size / 512),
  };
}
