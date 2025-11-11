import { MemFS } from "../memfs";
import { LayoutStrategy } from "./index";
import { ResolvedPackage } from "./resolver";
import * as path from "../polyfills/path";

/**
 * pnpm-style content-addressable store layout.
 *
 * Structure:
 *   node_modules/.pnpm/<name>@<version>/node_modules/<name>/  ← actual files
 *   node_modules/<name>  →  symlink to store path above
 *   node_modules/.pnpm/<name>@<version>/node_modules/<dep>  →  symlink to dep store
 */
export class PnpmLayout implements LayoutStrategy {
  private storePath(cwd: string, pkgName: string, pkgVersion: string): string {
    const storeKey = `${sanitiseName(pkgName)}@${pkgVersion}`;
    return path.join(
      cwd,
      "node_modules",
      ".pnpm",
      storeKey,
      "node_modules",
      pkgName,
    );
  }

  getPackageDir(cwd: string, pkgName: string, pkgVersion: string): string {
    return this.storePath(cwd, pkgName, pkgVersion);
  }

  createTopLevelLink(
    vfs: MemFS,
    cwd: string,
    pkgName: string,
    pkgVersion: string,
  ): void {
    const linkPath = path.join(cwd, "node_modules", pkgName);

    if (pkgName.startsWith("@")) {
      const scopeDir = path.join(cwd, "node_modules", pkgName.split("/")[0]);
      if (!vfs.existsSync(scopeDir)) {
        vfs.mkdirSync(scopeDir, { recursive: true });
      }
    }

    if (vfs.existsSync(linkPath)) return;

    const target = this.storePath(cwd, pkgName, pkgVersion);
    vfs.symlinkSync(target, linkPath);
  }

  createDependencyLinks(
    vfs: MemFS,
    cwd: string,
    pkg: ResolvedPackage,
    allResolved: Map<string, ResolvedPackage>,
  ): void {
    const declared = pkg.dependencies;
    if (!declared || Object.keys(declared).length === 0) return;

    const storeKey = `${sanitiseName(pkg.name)}@${pkg.version}`;
    const parentNm = path.join(
      cwd,
      "node_modules",
      ".pnpm",
      storeKey,
      "node_modules",
    );

    for (const depName of Object.keys(declared)) {
      const resolved = allResolved.get(depName);
      if (!resolved) continue;

      const depLink = path.join(parentNm, depName);
      if (vfs.existsSync(depLink)) continue;

      if (depName.startsWith("@")) {
        const scopeDir = path.join(parentNm, depName.split("/")[0]);
        if (!vfs.existsSync(scopeDir)) {
          vfs.mkdirSync(scopeDir, { recursive: true });
        }
      }

      const depStore = this.storePath(cwd, resolved.name, resolved.version);
      vfs.symlinkSync(depStore, depLink);
    }
  }

  createBinStub(
    vfs: MemFS,
    cwd: string,
    cmdName: string,
    targetPath: string,
  ): void {
    const binDir = path.join(cwd, "node_modules", ".bin");
    vfs.mkdirSync(binDir, { recursive: true });
    const stubPath = path.join(binDir, cmdName);
    vfs.writeFileSync(
      stubPath,
      `#!/usr/bin/env node\nrequire("${targetPath}");\n`,
    );
  }
}

/** Replace `/` in scoped names with `+` for flat store keys (matches real pnpm). */
function sanitiseName(name: string): string {
  return name.replace(/\//g, "+");
}
