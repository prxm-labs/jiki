/**
 * Lightweight TypeScript type-checker for jiki.
 *
 * Provides on-demand batch type checking by analyzing TypeScript files
 * in the VFS. Uses a simple heuristic-based approach that catches common
 * type errors without requiring the full TypeScript compiler.
 *
 * For full type checking, the TypeScript compiler can be installed as an
 * npm package and run via the shell: `npx tsc --noEmit`.
 *
 * @example
 * ```ts
 * const checker = new TypeChecker(container.vfs);
 * const diagnostics = checker.check(['/src/app.ts', '/src/utils.ts']);
 * for (const d of diagnostics) {
 *   console.log(`${d.file}:${d.line} - ${d.message}`);
 * }
 * ```
 */

import type { MemFS } from "./memfs";
import * as pathShim from "./polyfills/path";

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
  code?: string;
}

export interface TypeCheckerOptions {
  /** Strict mode (default: true). */
  strict?: boolean;
  /** Check for unused variables (default: false). */
  noUnusedLocals?: boolean;
  /** Check for implicit any (default: true in strict mode). */
  noImplicitAny?: boolean;
}

/**
 * Lightweight TypeScript type-checker that catches common errors
 * using pattern matching and heuristics. Not a full type system,
 * but catches the most common mistakes quickly.
 */
export class TypeChecker {
  private vfs: MemFS;
  private opts: Required<TypeCheckerOptions>;

  constructor(vfs: MemFS, options: TypeCheckerOptions = {}) {
    this.vfs = vfs;
    this.opts = {
      strict: options.strict ?? true,
      noUnusedLocals: options.noUnusedLocals ?? false,
      noImplicitAny: options.noImplicitAny ?? options.strict !== false,
    };
  }

  /**
   * Check a list of TypeScript files for common errors.
   * Returns diagnostics sorted by file and line number.
   */
  check(files: string[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const file of files) {
      if (!file.match(/\.(ts|tsx)$/)) continue;
      try {
        const source = this.vfs.readFileSync(file, "utf8");
        diagnostics.push(...this.checkFile(file, source));
      } catch {
        diagnostics.push({
          file,
          line: 0,
          column: 0,
          message: `Cannot read file: ${file}`,
          severity: "error",
        });
      }
    }

    return diagnostics.sort(
      (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
    );
  }

  /**
   * Discover all .ts/.tsx files in a directory and check them.
   */
  checkAll(dir: string = "/src"): Diagnostic[] {
    const files = this.discoverFiles(dir);
    return this.check(files);
  }

  private discoverFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      for (const entry of this.vfs.readdirSync(dir)) {
        const full = pathShim.join(dir, entry);
        try {
          if (this.vfs.statSync(full).isDirectory()) {
            if (entry !== "node_modules" && !entry.startsWith(".")) {
              files.push(...this.discoverFiles(full));
            }
          } else if (entry.match(/\.(ts|tsx)$/) && !entry.endsWith(".d.ts")) {
            files.push(full);
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* dir may not exist */
    }
    return files;
  }

  private checkFile(file: string, source: string): Diagnostic[] {
    const diags: Diagnostic[] = [];
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for common TypeScript errors

      // 1. Missing return type on exported functions (noImplicitAny)
      if (this.opts.noImplicitAny) {
        const exportFnMatch = line.match(
          /^export\s+(?:default\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/,
        );
        if (exportFnMatch && !line.includes("):")) {
          diags.push({
            file,
            line: lineNum,
            column: 0,
            message: `Function '${exportFnMatch[1]}' has no return type annotation`,
            severity: "warning",
            code: "TS7030",
          });
        }
      }

      // 2. Duplicate variable declarations in same scope
      const constMatch = line.match(/^\s*(const|let|var)\s+(\w+)/);
      if (constMatch) {
        const varName = constMatch[2];
        // Check for redeclaration in subsequent lines (same indentation level)
        for (let j = i + 1; j < lines.length && j < i + 50; j++) {
          const reDecl = lines[j].match(
            new RegExp(`^\\s*(const|let)\\s+${varName}\\b`),
          );
          if (
            reDecl &&
            lines[j].match(/^\s*/)?.[0] === line.match(/^\s*/)?.[0]
          ) {
            diags.push({
              file,
              line: j + 1,
              column: 0,
              message: `Cannot redeclare block-scoped variable '${varName}'`,
              severity: "error",
              code: "TS2451",
            });
            break;
          }
        }
      }

      // 3. Using `any` when noImplicitAny is enabled
      if (this.opts.noImplicitAny && this.opts.strict) {
        const anyTypeMatch = line.match(/:\s*any\b/);
        if (
          anyTypeMatch &&
          !line.includes("// @ts-ignore") &&
          !line.includes("eslint-disable")
        ) {
          diags.push({
            file,
            line: lineNum,
            column: anyTypeMatch.index ?? 0,
            message: "Unexpected use of 'any' type",
            severity: "warning",
            code: "TS7006",
          });
        }
      }

      // 4. Unreachable code after return/throw
      if (line.match(/^\s*(return|throw)\b/) && i + 1 < lines.length) {
        const nextLine = lines[i + 1]?.trim();
        if (
          nextLine &&
          !nextLine.startsWith("}") &&
          !nextLine.startsWith("//") &&
          !nextLine.startsWith("/*") &&
          nextLine !== ""
        ) {
          diags.push({
            file,
            line: lineNum + 1,
            column: 0,
            message: "Unreachable code detected",
            severity: "warning",
            code: "TS7027",
          });
        }
      }

      // 5. Syntax: missing semicolons at statement boundaries (if strict)
      // Only flag obvious cases: variable declarations without semicolons
      if (this.opts.strict) {
        const stmtMatch = line.match(
          /^\s*(const|let|var)\s+\w+\s*=\s*.+[^;{,\s]\s*$/,
        );
        if (
          stmtMatch &&
          !line.includes("//") &&
          !line.endsWith("=>") &&
          !line.endsWith("(")
        ) {
          // Skip multi-line expressions
          const nextLine = lines[i + 1]?.trim() || "";
          if (
            nextLine &&
            !nextLine.startsWith(".") &&
            !nextLine.startsWith("+") &&
            !nextLine.startsWith("?") &&
            !nextLine.startsWith(":")
          ) {
            // This is a potential missing semicolon — but too noisy, skip for now
          }
        }
      }
    }

    return diags;
  }
}
