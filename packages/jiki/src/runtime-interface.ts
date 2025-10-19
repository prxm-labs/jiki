import type { MemFS } from "./memfs";

export interface IRuntimeOptions {
  cwd?: string;
  env?: Record<string, string>;
  onConsole?: (method: string, args: unknown[]) => void;
}

export interface IModule {
  id: string;
  filename: string;
  exports: unknown;
  loaded: boolean;
  children: IModule[];
  paths: string[];
}

export interface IExecuteResult {
  exports: unknown;
  module: IModule;
}

export interface IRuntime {
  execute(code: string, filename?: string): Promise<IExecuteResult>;
  runFile(filename: string): Promise<IExecuteResult>;
  clearCache(): void;
  getVFS?(): MemFS;
  terminate?(): void;
}

export interface CreateRuntimeOptions extends IRuntimeOptions {
  sandbox?: string;
  dangerouslyAllowSameOrigin?: boolean;
  useWorker?: boolean | "auto";
}

export interface VFSSnapshot {
  files: VFSFileEntry[];
}

export interface VFSFileEntry {
  path: string;
  type: "file" | "directory" | "symlink";
  content?: string;
  target?: string;
}
