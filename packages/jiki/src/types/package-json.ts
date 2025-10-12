export interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  module?: string;
  browser?: string | Record<string, string | false>;
  exports?: unknown;
  imports?: Record<string, unknown>;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  type?: "module" | "commonjs";
  [key: string]: unknown;
}
