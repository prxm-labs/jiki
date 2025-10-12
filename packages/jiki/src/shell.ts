import { MemFS } from "./memfs";
import { Kernel } from "./kernel";
import { PackageManager } from "./npm/index";
import * as pathShim from "./polyfills/path";
import { EventEmitter } from "./polyfills/events";
import { createDefaultCommands } from "./shell-commands";

export interface ShellOptions {
  cwd?: string;
  env?: Record<string, string>;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number) => void;
  pnpmPm?: PackageManager;
  lazyPnpmPm?: () => PackageManager;
}

export interface ShellProcess {
  stdin: { write(data: string): void };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill(signal?: string): void;
  wait(): Promise<number>;
  pid: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellContext {
  vfs: MemFS;
  runtime: Kernel;
  pm: PackageManager;
  pnpmPm?: PackageManager;
  cwd: string;
  env: Record<string, string>;
  stdinData?: string;
  setCwd(dir: string): void;
  exec(command: string, options?: ShellOptions): Promise<ShellResult>;
  write?(text: string): void;
  writeErr?(text: string): void;
}

export type CommandHandler = (
  args: string[],
  ctx: ShellContext,
) => ShellResult | Promise<ShellResult>;

const ok = (stdout = ""): ShellResult => ({ stdout, stderr: "", exitCode: 0 });
const fail = (stderr: string, code = 1): ShellResult => ({
  stdout: "",
  stderr,
  exitCode: code,
});

/** Command history with up/down navigation. */
export class ShellHistory {
  private entries: string[] = [];
  private cursor = -1;
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  push(command: string): void {
    // Don't add duplicates of the last entry or empty commands.
    if (!command.trim()) return;
    if (
      this.entries.length > 0 &&
      this.entries[this.entries.length - 1] === command
    )
      return;
    this.entries.push(command);
    if (this.entries.length > this.maxSize) this.entries.shift();
    this.cursor = this.entries.length; // reset cursor to end
  }

  up(): string | undefined {
    if (this.cursor > 0) {
      this.cursor--;
      return this.entries[this.cursor];
    }
    return this.entries[0];
  }

  down(): string | undefined {
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor];
    }
    this.cursor = this.entries.length;
    return undefined; // past the end = empty input
  }

  reset(): void {
    this.cursor = this.entries.length;
  }

  getAll(): string[] {
    return [...this.entries];
  }

  get length(): number {
    return this.entries.length;
  }
}

export class Shell {
  private vfs: MemFS;
  private runtime: Kernel;
  private packageManager: PackageManager;
  private pnpmPm?: PackageManager;
  private lazyPnpmPm?: () => PackageManager;
  private binCache = new Map<string, string>();
  private cwd: string;
  private env: Record<string, string>;
  private commands: Map<string, CommandHandler>;
  /** Command history for this shell session. */
  readonly history = new ShellHistory();
  /** Background jobs spawned with `&`. */
  private backgroundJobs: Array<{
    id: number;
    command: string;
    promise: Promise<ShellResult>;
    done: boolean;
    result?: ShellResult;
  }> = [];
  private nextJobId = 1;

  constructor(
    vfs: MemFS,
    runtime: Kernel,
    packageManager: PackageManager,
    options: ShellOptions = {},
  ) {
    this.vfs = vfs;
    this.runtime = runtime;
    this.packageManager = packageManager;
    this.pnpmPm = options.pnpmPm;
    this.lazyPnpmPm = options.lazyPnpmPm;
    this.cwd = options.cwd || "/";
    this.env = {
      PATH: "/usr/local/bin:/usr/bin:/bin:/node_modules/.bin",
      HOME: "/",
      ...options.env,
    };
    this.commands = createDefaultCommands();
    // Register built-in history/jobs/fg commands.
    this.commands.set("history", (_args, ctx) => {
      const lines = this.history
        .getAll()
        .map((cmd, i) => `  ${i + 1}  ${cmd}`)
        .join("\n");
      return ok(lines ? lines + "\n" : "");
    });
    this.commands.set("jobs", (_args, ctx) => {
      const lines = this.backgroundJobs
        .filter(j => !j.done)
        .map(j => `[${j.id}]  Running  ${j.command}`)
        .join("\n");
      return ok(lines ? lines + "\n" : "");
    });
    this.commands.set("fg", args => {
      const id = args[0]
        ? parseInt(args[0], 10)
        : this.backgroundJobs.length > 0
          ? this.backgroundJobs[this.backgroundJobs.length - 1].id
          : 0;
      const job = this.backgroundJobs.find(j => j.id === id);
      if (!job) return fail(`fg: no such job: ${id}\n`);
      if (job.done && job.result) return job.result;
      return ok(`[${id}]  ${job.command}\n`);
    });
  }

  registerCommand(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
  }

  /**
   * Tab completion for a partial input string.
   * Returns sorted candidate completions.
   */
  complete(partial: string): string[] {
    const trimmed = partial.trimStart();
    const parts = trimmed.split(/\s+/);

    if (parts.length <= 1) {
      // Completing a command name
      const prefix = parts[0] || "";
      const candidates: string[] = [];
      // Built-in / registered commands
      for (const name of this.commands.keys()) {
        if (name.startsWith(prefix)) candidates.push(name);
      }
      // Binaries in .bin
      try {
        const binDir = pathShim.join("/node_modules/.bin");
        if (this.vfs.existsSync(binDir)) {
          for (const name of this.vfs.readdirSync(binDir)) {
            if (name.startsWith(prefix) && !candidates.includes(name))
              candidates.push(name);
          }
        }
      } catch {}
      return candidates.sort();
    }

    // Completing a file path argument
    const lastToken = parts[parts.length - 1];
    return this.completeFilePath(lastToken);
  }

  private completeFilePath(partial: string): string[] {
    const abs = partial.startsWith("/")
      ? partial
      : pathShim.resolve(this.cwd, partial);

    // Try to list the directory the partial is in.
    const dir = abs.endsWith("/") ? abs : pathShim.dirname(abs);
    const prefix = abs.endsWith("/") ? "" : pathShim.basename(abs);

    try {
      const entries = this.vfs.readdirSync(dir);
      return entries
        .filter(e => e.startsWith(prefix))
        .map(e => {
          const full = pathShim.join(dir, e);
          // Append / for directories
          try {
            if (this.vfs.statSync(full).isDirectory()) return e + "/";
          } catch {}
          return e;
        })
        .sort();
    } catch {
      return [];
    }
  }

  async exec(
    command: string,
    options: ShellOptions = {},
  ): Promise<ShellResult> {
    this.history.push(command);

    // Background job support: if command ends with `&`, run in background.
    const trimmedCmd = command.trim();
    if (trimmedCmd.endsWith("&") && !trimmedCmd.endsWith("&&")) {
      const fgCmd = trimmedCmd.slice(0, -1).trim();
      const jobId = this.nextJobId++;
      const job = {
        id: jobId,
        command: fgCmd,
        promise: this.exec(fgCmd, options).then(r => {
          job.done = true;
          job.result = r;
          return r;
        }),
        done: false,
        result: undefined as ShellResult | undefined,
      };
      this.backgroundJobs.push(job);
      return ok(`[${jobId}] started\n`);
    }

    const segments = this.splitControlFlow(command);
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    let skip: "&&" | "||" | null = null;

    for (const { cmd, op } of segments) {
      if (!cmd) continue;

      // Skip logic: propagate skip through matching operator chains
      // e.g., `false && B && C` skips both B and C
      // e.g., `true || B || C` skips both B and C
      if (skip) {
        // A ';' always breaks the skip chain (unconditional separator)
        // A different operator type also breaks the chain:
        //   `false && B || C` — skip B (&&), but C runs (|| sees prior failure)
        //   `true || B && C` — skip B (||), but C runs (&& sees prior success)
        if (op === ";") {
          skip = null;
          continue;
        }
        if (skip === "&&" && op === "||") {
          skip = null;
          continue;
        }
        if (skip === "||" && op === "&&") {
          skip = null;
          continue;
        }
        // Same operator type: keep skipping (propagate through chain)
        continue;
      }

      const result = await this.execPipeline(cmd, options);
      stdout += result.stdout;
      stderr += result.stderr;
      exitCode = result.exitCode;

      // Set skip for the NEXT segment based on operator + exit code
      if (op === "&&" && exitCode !== 0) {
        skip = "&&";
      } else if (op === "||" && exitCode === 0) {
        skip = "||";
      }
      // ';' always continues, skip stays null
    }
    return { stdout, stderr, exitCode };
  }

  private async execPipeline(
    command: string,
    options: ShellOptions = {},
  ): Promise<ShellResult> {
    let stderr = "";
    const onStderr = (data: string) => {
      stderr += data;
      options.onStderr?.(data);
    };

    const pipeSegments = command.split("|").map(s => s.trim());
    let lastOutput = "";

    for (let i = 0; i < pipeSegments.length; i++) {
      const isLast = i === pipeSegments.length - 1;
      // Only forward stdout to the caller for the last segment in the pipeline;
      // intermediate segments' stdout is captured as stdin for the next segment.
      let segStdout = "";
      const onStdout = (data: string) => {
        segStdout += data;
        if (isLast) options.onStdout?.(data);
      };
      const result = await this.execSingle(
        pipeSegments[i],
        { ...options, onStdout, onStderr },
        lastOutput,
      );
      lastOutput = result.stdout;
      if (result.exitCode !== 0)
        return {
          stdout: isLast ? segStdout : "",
          stderr,
          exitCode: result.exitCode,
        };
    }

    return { stdout: lastOutput, stderr, exitCode: 0 };
  }

  private splitControlFlow(
    command: string,
  ): Array<{ cmd: string; op: "&&" | "||" | ";" | null }> {
    const segments: Array<{ cmd: string; op: "&&" | "||" | ";" | null }> = [];
    let current = "";
    let inQuote = "";

    for (let i = 0; i < command.length; i++) {
      const ch = command[i];
      if (inQuote) {
        current += ch;
        if (ch === inQuote) inQuote = "";
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        current += ch;
        continue;
      }
      if (ch === "&" && command[i + 1] === "&") {
        segments.push({ cmd: current.trim(), op: "&&" });
        current = "";
        i++; // skip second &
        continue;
      }
      if (ch === "|" && command[i + 1] === "|") {
        segments.push({ cmd: current.trim(), op: "||" });
        current = "";
        i++; // skip second |
        continue;
      }
      if (ch === ";") {
        segments.push({ cmd: current.trim(), op: ";" });
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) segments.push({ cmd: current.trim(), op: null });
    return segments;
  }

  private parseRedirects(tokens: string[]): {
    args: string[];
    stdoutFile?: string;
    append?: boolean;
  } {
    const args: string[] = [];
    let stdoutFile: string | undefined;
    let append = false;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === ">>" && tokens[i + 1]) {
        stdoutFile = tokens[++i];
        append = true;
      } else if (tokens[i] === ">" && tokens[i + 1]) {
        stdoutFile = tokens[++i];
        append = false;
      } else if (tokens[i].endsWith(">>")) {
        stdoutFile = tokens[i].slice(0, -2) || tokens[++i];
        append = true;
      } else {
        args.push(tokens[i]);
      }
    }
    return { args, stdoutFile, append };
  }

  private async execSingle(
    command: string,
    options: ShellOptions & {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    },
    stdinData?: string,
  ): Promise<ShellResult> {
    const parts = this.parseCommand(command);
    if (parts.length === 0) return ok();

    const redirect = this.parseRedirects(parts);
    const [cmd, ...args] = redirect.args;

    const resolvePnpmPm = () => this.pnpmPm ?? this.lazyPnpmPm?.();
    const ctx: ShellContext = {
      vfs: this.vfs,
      runtime: this.runtime,
      pm: this.packageManager,
      get pnpmPm() {
        return resolvePnpmPm();
      },
      cwd: this.cwd,
      env: this.env,
      stdinData,
      setCwd: (dir: string) => {
        this.cwd = dir;
      },
      exec: (cmd: string, opts?: ShellOptions) => this.exec(cmd, opts),
      write: (text: string) => options.onStdout?.(text),
      writeErr: (text: string) => options.onStderr?.(text),
    };

    let result: ShellResult;

    const handler = this.commands.get(cmd);
    if (handler) {
      try {
        result = await handler(args, ctx);
        if (result.stderr) options.onStderr?.(result.stderr);
      } catch (e) {
        const errMsg = `${cmd}: ${(e as Error).message}\n`;
        options.onStderr?.(errMsg);
        return fail(errMsg);
      }
    } else {
      const binPath = this.resolveBin(cmd);
      if (binPath) {
        try {
          this.runtime.runFile(binPath);
          result = ok();
        } catch (e) {
          const errMsg = `${cmd}: ${(e as Error).message}\n`;
          options.onStderr?.(errMsg);
          return fail(errMsg);
        }
      } else {
        const errMsg = `${cmd}: command not found\n`;
        options.onStderr?.(errMsg);
        return { stdout: "", stderr: errMsg, exitCode: 127 };
      }
    }

    // Handle stdout redirects
    if (redirect.stdoutFile) {
      const filePath = pathShim.isAbsolute(redirect.stdoutFile)
        ? redirect.stdoutFile
        : pathShim.resolve(this.cwd, redirect.stdoutFile);
      try {
        if (redirect.append) {
          const existing = this.vfs.existsSync(filePath)
            ? (this.vfs.readFileSync(filePath, "utf-8") as string)
            : "";
          this.vfs.writeFileSync(filePath, existing + result.stdout);
        } else {
          this.vfs.writeFileSync(filePath, result.stdout);
        }
        result = { ...result, stdout: "" };
      } catch (e) {
        const errMsg = `${(e as Error).message}\n`;
        options.onStderr?.(errMsg);
        return { stdout: "", stderr: errMsg, exitCode: 1 };
      }
    } else {
      if (result.stdout) options.onStdout?.(result.stdout);
    }

    return result;
  }

  private expandVar(name: string): string {
    return this.env[name] || "";
  }

  private parseCommand(cmd: string): string[] {
    const tokens: string[] = [];
    const quoted: boolean[] = []; // track whether each token was quoted
    let current = "";
    let wasQuoted = false;

    for (let i = 0; i < cmd.length; i++) {
      const ch = cmd[i];
      if (wasQuoted === false && ch === "'") {
        // Single quotes: no variable expansion
        wasQuoted = true;
        i++;
        while (i < cmd.length && cmd[i] !== "'") {
          current += cmd[i];
          i++;
        }
        // i now points at closing quote (or end of string)
        continue;
      } else if (wasQuoted === false && ch === '"') {
        // Double quotes: expand variables inside
        wasQuoted = true;
        i++;
        while (i < cmd.length && cmd[i] !== '"') {
          if (cmd[i] === "$") {
            const varStr = this.consumeVariable(cmd, i);
            current += varStr.value;
            i = varStr.end;
          } else {
            current += cmd[i];
            i++;
          }
        }
        // i now points at closing quote (or end of string)
        continue;
      } else if (ch === " " || ch === "\t") {
        if (current) {
          tokens.push(current);
          quoted.push(wasQuoted);
          current = "";
          wasQuoted = false;
        }
      } else if (ch === "\\" && i + 1 < cmd.length) {
        current += cmd[++i];
      } else if (ch === "$") {
        // Unquoted variable expansion
        const varStr = this.consumeVariable(cmd, i);
        current += varStr.value;
        i = varStr.end - 1; // -1 because for loop will i++
      } else {
        current += ch;
      }
    }
    if (current) {
      tokens.push(current);
      quoted.push(wasQuoted);
    }

    // Expand globs on unquoted tokens
    const result: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (
        !quoted[i] &&
        (tokens[i].includes("*") ||
          tokens[i].includes("?") ||
          tokens[i].includes("{"))
      ) {
        result.push(...this.expandGlob(tokens[i], this.cwd));
      } else {
        result.push(tokens[i]);
      }
    }
    return result;
  }

  /** Consume a $VAR or ${VAR} starting at position i (pointing at '$'), returning expanded value and end index */
  private consumeVariable(
    cmd: string,
    i: number,
  ): { value: string; end: number } {
    i++; // skip '$'
    if (i < cmd.length && cmd[i] === "{") {
      // ${VAR} syntax
      i++; // skip '{'
      let name = "";
      while (i < cmd.length && cmd[i] !== "}") {
        name += cmd[i];
        i++;
      }
      if (i < cmd.length) i++; // skip '}'
      return { value: this.expandVar(name), end: i };
    } else {
      // $VAR syntax — consume word characters
      let name = "";
      while (i < cmd.length && /\w/.test(cmd[i])) {
        name += cmd[i];
        i++;
      }
      if (!name) return { value: "$", end: i };
      return { value: this.expandVar(name), end: i };
    }
  }

  private expandGlob(pattern: string, cwd: string): string[] {
    if (
      !pattern.includes("*") &&
      !pattern.includes("?") &&
      !pattern.includes("{")
    )
      return [pattern];

    // Brace expansion: {a,b} → expand into multiple patterns
    if (pattern.includes("{")) {
      const expanded = this.expandBraces(pattern);
      const results: string[] = [];
      for (const p of expanded) {
        results.push(...this.expandGlob(p, cwd));
      }
      return results.length > 0 ? [...new Set(results)].sort() : [pattern];
    }

    // Recursive glob: ** support
    if (pattern.includes("**")) {
      return this.expandRecursiveGlob(pattern, cwd);
    }

    // Simple single-level glob
    const dir = pattern.includes("/")
      ? pattern.substring(0, pattern.lastIndexOf("/")) || "/"
      : cwd;
    const filePattern = pattern.includes("/")
      ? pattern.substring(pattern.lastIndexOf("/") + 1)
      : pattern;

    const regexStr = filePattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp("^" + regexStr + "$");
    try {
      const entries = this.vfs.readdirSync(dir);
      const matches = entries
        .filter(e => regex.test(e))
        .map(e => (dir === cwd ? e : `${dir}/${e}`));
      return matches.length > 0 ? matches.sort() : [pattern];
    } catch {
      return [pattern];
    }
  }

  /** Expand brace patterns like `{a,b}` into multiple strings. */
  private expandBraces(pattern: string): string[] {
    const start = pattern.indexOf("{");
    if (start === -1) return [pattern];
    const end = pattern.indexOf("}", start);
    if (end === -1) return [pattern];

    const prefix = pattern.slice(0, start);
    const suffix = pattern.slice(end + 1);
    const parts = pattern.slice(start + 1, end).split(",");

    const results: string[] = [];
    for (const part of parts) {
      results.push(...this.expandBraces(prefix + part + suffix));
    }
    return results;
  }

  /** Expand `**` recursive glob patterns. */
  private expandRecursiveGlob(pattern: string, cwd: string): string[] {
    const isAbsolute = pattern.startsWith("/");
    const base = isAbsolute ? "/" : cwd;

    // Split pattern into segments
    const patternSegs = pattern.split("/").filter(Boolean);

    const results: string[] = [];
    this.matchGlobSegments(base, patternSegs, 0, results);
    return results.length > 0 ? results.sort() : [pattern];
  }

  private matchGlobSegments(
    dir: string,
    segments: string[],
    segIdx: number,
    results: string[],
  ): void {
    if (segIdx >= segments.length) return;

    const seg = segments[segIdx];
    const isLast = segIdx === segments.length - 1;

    if (seg === "**") {
      // ** matches zero or more directories
      // Match zero directories: skip this segment
      this.matchGlobSegments(dir, segments, segIdx + 1, results);

      // Match one or more directories: recurse into each subdirectory
      try {
        const entries = this.vfs.readdirSync(dir);
        for (const entry of entries) {
          const full = dir === "/" ? `/${entry}` : `${dir}/${entry}`;
          try {
            if (this.vfs.statSync(full).isDirectory()) {
              this.matchGlobSegments(full, segments, segIdx, results); // keep ** active
              this.matchGlobSegments(full, segments, segIdx + 1, results); // move past **
            }
          } catch {}
        }
      } catch {}
      return;
    }

    // Normal segment (may contain * or ?)
    const regexStr = seg
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp("^" + regexStr + "$");

    try {
      const entries = this.vfs.readdirSync(dir);
      for (const entry of entries) {
        if (!regex.test(entry)) continue;
        const full = dir === "/" ? `/${entry}` : `${dir}/${entry}`;
        if (isLast) {
          results.push(full);
        } else {
          try {
            if (this.vfs.statSync(full).isDirectory()) {
              this.matchGlobSegments(full, segments, segIdx + 1, results);
            }
          } catch {}
        }
      }
    } catch {}
  }

  private resolveBin(cmd: string): string | null {
    const cached = this.binCache.get(cmd);
    if (cached !== undefined) return cached;
    const binPath = pathShim.join("/node_modules/.bin", cmd);
    if (this.vfs.existsSync(binPath)) {
      this.binCache.set(cmd, binPath);
      return binPath;
    }
    return null;
  }

  clearBinCache(): void {
    this.binCache.clear();
  }

  getCwd(): string {
    return this.cwd;
  }
  setCwd(dir: string): void {
    this.cwd = dir;
  }
  getEnv(): Record<string, string> {
    return { ...this.env };
  }
  setEnv(key: string, value: string): void {
    this.env[key] = value;
  }
}

export function createShell(
  vfs: MemFS,
  runtime: Kernel,
  pm: PackageManager,
  options?: ShellOptions,
): Shell {
  return new Shell(vfs, runtime, pm, options);
}
