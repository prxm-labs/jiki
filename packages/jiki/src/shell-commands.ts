import * as pathShim from "./polyfills/path";
import { Kernel } from "./kernel";
import { bundle, initTranspiler } from "./transpiler";
import {
  getStreamingState,
  setActiveProcessStdin,
  getActiveForkedChildren,
  setOnForkedChildExit,
} from "./polyfills/child_process";
import type { ShellContext, ShellResult, CommandHandler } from "./shell";

const ok = (stdout = ""): ShellResult => ({ stdout, stderr: "", exitCode: 0 });
const fail = (stderr: string, code = 1): ShellResult => ({
  stdout: "",
  stderr,
  exitCode: code,
});

function echoCmd(args: string[]): ShellResult {
  return ok(args.join(" ") + "\n");
}

function cdCmd(args: string[], ctx: ShellContext): ShellResult {
  const target = args[0] || ctx.env.HOME || "/";
  const resolved = pathShim.isAbsolute(target)
    ? target
    : pathShim.resolve(ctx.cwd, target);
  if (
    ctx.vfs.existsSync(resolved) &&
    ctx.vfs.statSync(resolved).isDirectory()
  ) {
    ctx.setCwd(resolved);
    ctx.runtime.getProcess().chdir(resolved);
    return ok();
  }
  return fail(`cd: ${target}: No such file or directory\n`);
}

function pwdCmd(_args: string[], ctx: ShellContext): ShellResult {
  return ok(ctx.cwd + "\n");
}

function lsCmd(args: string[], ctx: ShellContext): ShellResult {
  const positional = args.filter(a => !a.startsWith("-"));
  const dir = positional[0]
    ? pathShim.resolve(ctx.cwd, positional[0])
    : ctx.cwd;
  try {
    const entries = ctx.vfs.readdirSync(dir);
    const showAll =
      args.includes("-a") || args.includes("-la") || args.includes("-al");
    const filtered = showAll
      ? entries
      : entries.filter(e => !e.startsWith("."));
    return ok(filtered.join("\n") + "\n");
  } catch (e) {
    return fail(`ls: cannot access '${dir}': ${(e as Error).message}\n`);
  }
}

function catCmd(args: string[], ctx: ShellContext): ShellResult {
  if (args.length === 0) {
    // No file args: read from stdin (pipe data)
    return ok(ctx.stdinData || "");
  }
  let out = "",
    err = "",
    code = 0;
  for (const file of args) {
    const p = pathShim.resolve(ctx.cwd, file);
    try {
      out += ctx.vfs.readFileSync(p, "utf8");
    } catch {
      err += `cat: ${file}: No such file or directory\n`;
      code = 1;
    }
  }
  return { stdout: out, stderr: err, exitCode: code };
}

function mkdirCmd(args: string[], ctx: ShellContext): ShellResult {
  const recursive = args.includes("-p");
  for (const dir of args.filter(a => !a.startsWith("-"))) {
    ctx.vfs.mkdirSync(pathShim.resolve(ctx.cwd, dir), { recursive });
  }
  return ok();
}

function rmCmd(args: string[], ctx: ShellContext): ShellResult {
  const recursive =
    args.includes("-r") || args.includes("-rf") || args.includes("-fr");
  const force =
    args.includes("-f") || args.includes("-rf") || args.includes("-fr");
  for (const file of args.filter(a => !a.startsWith("-"))) {
    const p = pathShim.resolve(ctx.cwd, file);
    try {
      ctx.vfs.rmSync(p, { recursive, force });
    } catch (e) {
      if (!force) return fail(`rm: ${file}: ${(e as Error).message}\n`);
    }
  }
  return ok();
}

function cpCmd(args: string[], ctx: ShellContext): ShellResult {
  const recursive =
    args.includes("-r") ||
    args.includes("-R") ||
    args.includes("-rp") ||
    args.includes("-pr");
  const positional = args.filter(a => !a.startsWith("-"));
  if (positional.length < 2) return fail("cp: missing file operand\n");
  const src = pathShim.resolve(ctx.cwd, positional[0]);
  const dest = pathShim.resolve(ctx.cwd, positional[1]);

  if (ctx.vfs.existsSync(src) && ctx.vfs.statSync(src).isDirectory()) {
    if (!recursive)
      return fail(
        `cp: -r not specified; omitting directory '${positional[0]}'\n`,
      );
    copyDirRecursive(ctx.vfs, src, dest);
  } else {
    ctx.vfs.copyFileSync(src, dest);
  }
  return ok();
}

function copyDirRecursive(
  vfs: import("./memfs").MemFS,
  src: string,
  dest: string,
): void {
  if (!vfs.existsSync(dest)) vfs.mkdirSync(dest, { recursive: true });
  const entries = vfs.readdirSync(src);
  for (const entry of entries) {
    const srcPath = pathShim.join(src, entry);
    const destPath = pathShim.join(dest, entry);
    const stat = vfs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(vfs, srcPath, destPath);
    } else {
      vfs.copyFileSync(srcPath, destPath);
    }
  }
}

function mvCmd(args: string[], ctx: ShellContext): ShellResult {
  if (args.length < 2) return fail("mv: missing file operand\n");
  ctx.vfs.renameSync(
    pathShim.resolve(ctx.cwd, args[0]),
    pathShim.resolve(ctx.cwd, args[1]),
  );
  return ok();
}

function touchCmd(args: string[], ctx: ShellContext): ShellResult {
  for (const file of args.filter(a => !a.startsWith("-"))) {
    const p = pathShim.resolve(ctx.cwd, file);
    if (ctx.vfs.existsSync(p)) {
      // Update mtime on existing file
      const now = new Date();
      ctx.vfs.utimesSync(p, now, now);
    } else {
      ctx.vfs.writeFileSync(p, "");
    }
  }
  return ok();
}

function whichCmd(args: string[], ctx: ShellContext): ShellResult {
  const target = args[0];
  if (!target) return fail("which: missing argument\n");
  if (["node", "npm", "npx", "pnpm"].includes(target))
    return ok(`/usr/local/bin/${target}\n`);

  // Search PATH directories
  const pathDirs = (ctx.env.PATH || "").split(":").filter(Boolean);
  for (const dir of pathDirs) {
    const candidate = pathShim.join(dir, target);
    if (ctx.vfs.existsSync(candidate)) return ok(candidate + "\n");
  }

  return fail(`which: no ${target} in (${ctx.env.PATH || ""})\n`);
}

async function envCmd(args: string[], ctx: ShellContext): Promise<ShellResult> {
  // Parse VAR=val prefixes; if remaining args form a command, execute with modified env
  const envOverrides: Record<string, string> = {};
  let i = 0;
  while (i < args.length && args[i].includes("=")) {
    const eqIdx = args[i].indexOf("=");
    envOverrides[args[i].slice(0, eqIdx)] = args[i].slice(eqIdx + 1);
    i++;
  }
  const remaining = args.slice(i);
  if (remaining.length > 0) {
    // Execute remaining command with modified env
    const savedEnv = { ...ctx.env };
    Object.assign(ctx.env, envOverrides);
    try {
      return await ctx.exec(remaining.join(" "));
    } finally {
      // Restore env
      Object.keys(envOverrides).forEach(k => {
        if (k in savedEnv) ctx.env[k] = savedEnv[k];
        else delete ctx.env[k];
      });
    }
  }
  // No command: just print environment
  const merged = { ...ctx.env, ...envOverrides };
  return ok(
    Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
  );
}

function exportCmd(args: string[], ctx: ShellContext): ShellResult {
  const validName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  for (const arg of args) {
    const [k, ...rest] = arg.split("=");
    if (!validName.test(k)) {
      return {
        stdout: "",
        stderr: `export: '${k}': not a valid identifier\n`,
        exitCode: 1,
      };
    }
    if (rest.length) ctx.env[k] = rest.join("=");
  }
  return ok();
}

async function nodeCmd(
  args: string[],
  ctx: ShellContext,
): Promise<ShellResult> {
  if (args.includes("-e") || args.includes("--eval")) {
    const idx =
      args.indexOf("-e") >= 0 ? args.indexOf("-e") : args.indexOf("--eval");
    const code = args[idx + 1];
    if (code) {
      try {
        ctx.runtime.execute(code);
      } catch (e) {
        return fail((e as Error).message + "\n");
      }
    }
    return ok();
  }

  const scriptPath = args[0];
  if (!scriptPath) return ok();

  const resolvedPath = pathShim.resolve(ctx.cwd, scriptPath);
  if (!ctx.vfs.existsSync(resolvedPath)) {
    return fail(`Error: Cannot find module '${resolvedPath}'\n`);
  }

  let stdout = "";
  let stderr = "";
  let exitCalled = false;
  let exitCode = 0;
  let syncExecution = true;
  let exitResolve: ((code: number) => void) | null = null;
  const exitPromise = new Promise<number>(resolve => {
    exitResolve = resolve;
  });

  const { streamStdout, streamStderr, abortSignal } = getStreamingState();

  const appendStdout = (data: string) => {
    stdout += data;
    if (streamStdout) streamStdout(data);
  };
  const appendStderr = (data: string) => {
    stderr += data;
    if (streamStderr) streamStderr(data);
  };

  // Pass the plugin registry from the parent runtime so plugins (onResolve,
  // onLoad, onTransform) are available inside `node` sub-processes.
  const parentPlugins = ctx.runtime.pluginRegistry;
  const runtime = new Kernel(
    ctx.vfs,
    {
      cwd: ctx.cwd,
      env: ctx.env,
      onConsole: (method: string, consoleArgs: unknown[]) => {
        const msg = consoleArgs.map(a => String(a)).join(" ") + "\n";
        if (method === "error") appendStderr(msg);
        else appendStdout(msg);
      },
      onStdout: (data: string) => {
        appendStdout(data);
      },
      onStderr: (data: string) => {
        appendStderr(data);
      },
    },
    parentPlugins,
  );

  const proc = runtime.getProcess();
  proc.exit = ((code = 0) => {
    if (!exitCalled) {
      exitCalled = true;
      exitCode = code;
      proc.emit("exit", code);
      exitResolve!(code);
    }
    if (syncExecution) throw new Error(`Process exited with code ${code}`);
  }) as (code?: number) => never;

  proc.argv = ["node", resolvedPath, ...args.slice(1)];

  if (abortSignal) {
    proc.stdout.isTTY = true;
    proc.stderr.isTTY = true;
    proc.stdin.isTTY = true;
    (proc.stdin as any).setRawMode = () => proc.stdin;
    setActiveProcessStdin(proc.stdin as any);
  }

  try {
    await runtime.prepareFile(resolvedPath);
    runtime.runFile(resolvedPath);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Process exited with code")
    ) {
      return { stdout, stderr, exitCode };
    }
    const errorMsg =
      error instanceof Error
        ? `${error.message}\n${error.stack || ""}`
        : String(error);
    return { stdout, stderr: stderr + `Error: ${errorMsg}\n`, exitCode: 1 };
  } finally {
    syncExecution = false;
  }

  if (exitCalled) return { stdout, stderr, exitCode };

  await new Promise(r => setTimeout(r, 0));
  if (exitCalled) return { stdout, stderr, exitCode };

  if (
    (stdout.length > 0 || stderr.length > 0) &&
    getActiveForkedChildren() <= 0
  ) {
    return { stdout, stderr, exitCode: 0 };
  }
  if (
    stdout.length === 0 &&
    stderr.length === 0 &&
    getActiveForkedChildren() <= 0
  ) {
    return { stdout, stderr, exitCode: 0 };
  }

  const addRejectionHandler = typeof globalThis.addEventListener === "function";
  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (
      reason instanceof Error &&
      reason.message.startsWith("Process exited with code")
    ) {
      event.preventDefault();
      return;
    }
    const msg =
      reason instanceof Error
        ? `Unhandled rejection: ${reason.message}\n${reason.stack || ""}\n`
        : `Unhandled rejection: ${String(reason)}\n`;
    appendStderr(msg);
  };
  if (addRejectionHandler) {
    globalThis.addEventListener("unhandledrejection", rejectionHandler);
  }

  let childrenExited = false;
  const prevChildExitHandler = setOnForkedChildExit(null);
  setOnForkedChildExit(() => {
    if (getActiveForkedChildren() <= 0) childrenExited = true;
    if (typeof prevChildExitHandler === "function") prevChildExitHandler();
  });

  try {
    const MAX_TOTAL_MS = 60000;
    const IDLE_TIMEOUT_MS = 500;
    const POST_CHILD_EXIT_IDLE_MS = 100;
    const CHECK_MS = 50;
    const startTime = Date.now();
    let lastOutputLen = stdout.length + stderr.length;
    let idleMs = 0;
    const isLongRunning = !!abortSignal;

    while (!exitCalled) {
      if (abortSignal?.aborted) break;
      const raceResult = await Promise.race([
        exitPromise.then(() => "exit" as const),
        new Promise<"tick">(r => setTimeout(() => r("tick"), CHECK_MS)),
      ]);
      if (raceResult === "exit" || exitCalled) break;
      if (abortSignal?.aborted) break;

      const currentLen = stdout.length + stderr.length;
      if (currentLen > lastOutputLen) {
        lastOutputLen = currentLen;
        idleMs = 0;
      } else {
        idleMs += CHECK_MS;
      }
      if (!isLongRunning) {
        const effectiveIdle = childrenExited
          ? POST_CHILD_EXIT_IDLE_MS
          : IDLE_TIMEOUT_MS;
        if (lastOutputLen > 0 && idleMs >= effectiveIdle) break;
      }
      if (!isLongRunning && Date.now() - startTime >= MAX_TOTAL_MS) break;
    }

    return { stdout, stderr, exitCode: exitCalled ? exitCode : 0 };
  } finally {
    setActiveProcessStdin(null);
    setOnForkedChildExit(prevChildExitHandler as (() => void) | null);
    if (addRejectionHandler) {
      globalThis.removeEventListener("unhandledrejection", rejectionHandler);
    }
  }
}

async function npmCmd(args: string[], ctx: ShellContext): Promise<ShellResult> {
  const subCmd = args[0] || "help";
  switch (subCmd) {
    case "install":
    case "i":
    case "add": {
      const packages = args.slice(1).filter(a => !a.startsWith("-"));
      const saveDev = args.includes("-D") || args.includes("--save-dev");
      const noSave = args.includes("--no-save");
      const lines: string[] = [];
      if (packages.length > 0) {
        const result = await ctx.pm.install(packages, {
          save: !noSave && !saveDev,
          saveDev,
          onProgress: msg => {
            lines.push(msg);
            ctx.write?.(msg + "\n");
          },
        });
        const summary = `added ${result.added.length} packages`;
        lines.push(summary);
        ctx.write?.(summary + "\n");
      } else {
        const result = await ctx.pm.installFromPackageJson({
          onProgress: msg => {
            lines.push(msg);
            ctx.write?.(msg + "\n");
          },
        });
        const summary = `added ${result.added.length} packages`;
        lines.push(summary);
        ctx.write?.(summary + "\n");
      }
      return ok(lines.join("\n") + "\n");
    }
    case "run":
    case "run-script": {
      const scriptName = args[1];
      if (!scriptName) return fail("npm run: missing script name\n");
      return runNpmScript(scriptName, ctx);
    }
    case "test":
    case "t":
    case "tst":
      return runNpmScript("test", ctx);
    case "start":
      return runNpmScript("start", ctx);
    case "stop":
      return runNpmScript("stop", ctx);
    case "ls":
    case "list":
      return ok(ctx.pm.list().join("\n") + "\n");
    case "init": {
      const pkgJson = {
        name: pathShim.basename(ctx.cwd),
        version: "1.0.0",
        description: "",
        main: "index.js",
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        keywords: [],
        author: "",
        license: "ISC",
      };
      ctx.vfs.writeFileSync(
        pathShim.join(ctx.cwd, "package.json"),
        JSON.stringify(pkgJson, null, 2),
      );
      return ok("Created package.json\n");
    }
    default:
      return fail(`npm ${subCmd}: unknown command\n`);
  }
}

async function runNpmScript(
  scriptName: string,
  ctx: ShellContext,
): Promise<ShellResult> {
  const pkgJsonPath = pathShim.join(ctx.cwd, "package.json");
  if (!ctx.vfs.existsSync(pkgJsonPath))
    return fail("npm run: no package.json found\n");
  const pkgJson = JSON.parse(ctx.vfs.readFileSync(pkgJsonPath, "utf8"));
  const script = pkgJson.scripts?.[scriptName];
  if (!script) return fail(`npm run: script "${scriptName}" not found\n`);
  return ctx.exec(script);
}

async function npxCmd(args: string[], ctx: ShellContext): Promise<ShellResult> {
  const pkgName = args[0];
  if (!pkgName) return fail("npx: missing package name\n");
  await ctx.pm.install(pkgName);
  const binPath = pathShim.join("/node_modules/.bin", pkgName);
  if (ctx.vfs.existsSync(binPath)) {
    try {
      ctx.runtime.runFile(binPath);
    } catch (e) {
      return fail((e as Error).message + "\n");
    }
  }
  return ok();
}

async function pnpmCmd(
  args: string[],
  ctx: ShellContext,
): Promise<ShellResult> {
  const pm = ctx.pnpmPm;
  if (!pm)
    return fail(
      'pnpm: not configured – set packageManager to "pnpm" in container options\n',
    );

  const subCmd = args[0] || "help";
  switch (subCmd) {
    case "install":
    case "i":
    case "add": {
      const packages = args.slice(1).filter(a => !a.startsWith("-"));
      const saveDev = args.includes("-D") || args.includes("--save-dev");
      const noSave = args.includes("--no-save");
      const lines: string[] = [];
      if (packages.length > 0) {
        const result = await pm.install(packages, {
          save: !noSave && !saveDev,
          saveDev,
          onProgress: msg => {
            lines.push(msg);
            ctx.write?.(msg + "\n");
          },
        });
        const summary = `added ${result.added.length} packages`;
        lines.push(summary);
        ctx.write?.(summary + "\n");
      } else {
        const result = await pm.installFromPackageJson({
          onProgress: msg => {
            lines.push(msg);
            ctx.write?.(msg + "\n");
          },
        });
        const summary = `added ${result.added.length} packages`;
        lines.push(summary);
        ctx.write?.(summary + "\n");
      }
      return ok(lines.join("\n") + "\n");
    }
    case "run": {
      const scriptName = args[1];
      if (!scriptName) return fail("pnpm run: missing script name\n");
      const pkgJsonPath = pathShim.join(ctx.cwd, "package.json");
      if (!ctx.vfs.existsSync(pkgJsonPath))
        return fail("pnpm run: no package.json found\n");
      const pkgJson = JSON.parse(ctx.vfs.readFileSync(pkgJsonPath, "utf8"));
      const script = pkgJson.scripts?.[scriptName];
      if (!script) return fail(`pnpm run: script "${scriptName}" not found\n`);
      return ctx.exec(script);
    }
    case "ls":
    case "list":
      return ok(pm.list().join("\n") + "\n");
    default:
      return fail(`pnpm ${subCmd}: unknown command\n`);
  }
}

async function esbuildCmd(
  args: string[],
  ctx: ShellContext,
): Promise<ShellResult> {
  const entryPoints: string[] = [];
  let outfile: string | undefined;
  let doBundle = false;
  let format: "esm" | "cjs" | "iife" = "esm";
  let platform: "browser" | "node" | "neutral" = "browser";
  let minify = false;
  const external: string[] = [];
  const loaderOverrides: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--bundle") {
      doBundle = true;
      continue;
    }
    if (arg === "--minify") {
      minify = true;
      continue;
    }
    if (arg.startsWith("--outfile=")) {
      outfile = arg.slice("--outfile=".length);
      continue;
    }
    if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length) as typeof format;
      continue;
    }
    if (arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length) as typeof platform;
      continue;
    }
    if (arg.startsWith("--external:")) {
      external.push(arg.slice("--external:".length));
      continue;
    }
    if (arg.startsWith("--loader:")) {
      const rest = arg.slice("--loader:".length);
      const eqIdx = rest.indexOf("=");
      if (eqIdx > 0)
        loaderOverrides[rest.slice(0, eqIdx)] = rest.slice(eqIdx + 1);
      continue;
    }
    if (!arg.startsWith("-")) entryPoints.push(arg);
  }

  if (entryPoints.length === 0)
    return fail("esbuild: no entry points specified\n");

  const entry = pathShim.resolve(ctx.cwd, entryPoints[0]);
  if (!ctx.vfs.existsSync(entry))
    return fail(`esbuild: entry not found: ${entry}\n`);

  const resolvedOutfile = outfile
    ? pathShim.resolve(ctx.cwd, outfile)
    : undefined;

  try {
    await initTranspiler();
    const result = await bundle(ctx.vfs, {
      entryPoint: entry,
      format,
      platform,
      minify,
      external,
      outfile: resolvedOutfile,
      loader: loaderOverrides,
    });

    if (result.errors.length > 0) {
      return fail(
        `esbuild errors:\n${result.errors.map(e => e.text).join("\n")}\n`,
      );
    }
    return resolvedOutfile ? ok() : ok(result.code);
  } catch (e) {
    return fail(`esbuild: ${(e as Error).message}\n`);
  }
}

export function createDefaultCommands(): Map<string, CommandHandler> {
  const cmds = new Map<string, CommandHandler>();
  cmds.set("echo", echoCmd);
  cmds.set("cd", cdCmd);
  cmds.set("pwd", pwdCmd);
  cmds.set("ls", lsCmd);
  cmds.set("cat", catCmd);
  cmds.set("mkdir", mkdirCmd);
  cmds.set("rm", rmCmd);
  cmds.set("cp", cpCmd);
  cmds.set("mv", mvCmd);
  cmds.set("touch", touchCmd);
  cmds.set("which", whichCmd);
  cmds.set("env", (args, ctx) => envCmd(args, ctx));
  cmds.set("printenv", (args, ctx) => envCmd(args, ctx));
  cmds.set("export", exportCmd);
  cmds.set("true", () => ok());
  cmds.set("false", () => fail("", 1));
  cmds.set("node", nodeCmd);
  cmds.set("npm", (args, ctx) => npmCmd(args, ctx));
  cmds.set("npx", (args, ctx) => npxCmd(args, ctx));
  cmds.set("pnpm", (args, ctx) => pnpmCmd(args, ctx));
  cmds.set("esbuild", (args, ctx) => esbuildCmd(args, ctx));
  return cmds;
}
