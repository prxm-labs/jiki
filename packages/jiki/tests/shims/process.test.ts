import { describe, it, expect, vi } from "vitest";
import { createProcess } from "../../src/polyfills/process";

describe("process shim", () => {
  it("createProcess returns object with expected properties", () => {
    const proc = createProcess();
    expect(proc.env).toBeDefined();
    expect(typeof proc.cwd).toBe("function");
    expect(typeof proc.chdir).toBe("function");
    expect(proc.platform).toBe("linux");
    expect(proc.version).toBe("v20.0.0");
    expect(proc.pid).toBe(1);
  });

  it("cwd() returns initial cwd, chdir() changes it", () => {
    const proc = createProcess({ cwd: "/app" });
    expect(proc.cwd()).toBe("/app");
    proc.chdir("/other");
    expect(proc.cwd()).toBe("/other");
  });

  it("env has NODE_ENV, PATH, HOME; custom env merges", () => {
    const proc = createProcess({ env: { CUSTOM: "val" } });
    expect(proc.env.NODE_ENV).toBe("development");
    expect(proc.env.PATH).toBeDefined();
    expect(proc.env.HOME).toBe("/");
    expect(proc.env.CUSTOM).toBe("val");
  });

  it("nextTick executes callback asynchronously", async () => {
    const proc = createProcess();
    const fn = vi.fn();
    proc.nextTick(fn, "arg");
    expect(fn).not.toHaveBeenCalled();
    await new Promise(r => setTimeout(r, 10));
    expect(fn).toHaveBeenCalledWith("arg");
  });

  it("stdout.write calls onStdout callback", () => {
    const output: string[] = [];
    const proc = createProcess({ onStdout: d => output.push(d) });
    proc.stdout.write("hello");
    expect(output).toContain("hello");
  });

  it("stderr.write calls onStderr callback", () => {
    const output: string[] = [];
    const proc = createProcess({ onStderr: d => output.push(d) });
    proc.stderr.write("err");
    expect(output).toContain("err");
  });

  it("hrtime() returns tuple", () => {
    const proc = createProcess();
    const t = proc.hrtime();
    expect(Array.isArray(t)).toBe(true);
    expect(t.length).toBe(2);
    expect(typeof t[0]).toBe("number");
    expect(typeof t[1]).toBe("number");
  });

  it("hrtime.bigint() returns bigint", () => {
    const proc = createProcess();
    expect(typeof proc.hrtime.bigint()).toBe("bigint");
  });

  it("EventEmitter methods work on process", () => {
    const proc = createProcess();
    const fn = vi.fn();
    proc.on("test", fn);
    proc.emit("test", "data");
    expect(fn).toHaveBeenCalledWith("data");
    proc.off("test", fn);
    proc.emit("test", "data2");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exit() emits exit event and throws", () => {
    const exitCodes: number[] = [];
    const proc = createProcess({ onExit: c => exitCodes.push(c) });
    const fn = vi.fn();
    proc.on("exit", fn);
    expect(() => proc.exit(0)).toThrow("Process exited with code 0");
    expect(fn).toHaveBeenCalledWith(0);
    expect(exitCodes).toContain(0);
  });

  it("memoryUsage() returns object with expected keys", () => {
    const proc = createProcess();
    const mem = proc.memoryUsage();
    expect(mem.rss).toBeGreaterThan(0);
    expect(mem.heapTotal).toBeGreaterThan(0);
    expect(mem.heapUsed).toBeGreaterThan(0);
  });

  it("uptime() returns a number", () => {
    const proc = createProcess();
    expect(typeof proc.uptime()).toBe("number");
  });

  it("exit() emits beforeExit event before exit event", () => {
    const order: string[] = [];
    const proc = createProcess();
    proc.on("beforeExit", code => order.push(`beforeExit:${code}`));
    proc.on("exit", code => order.push(`exit:${code}`));
    expect(() => proc.exit(1)).toThrow("Process exited with code 1");
    expect(order).toEqual(["beforeExit:1", "exit:1"]);
  });

  it("exit() emits beforeExit only once even if called multiple times", () => {
    const beforeExitCalls: number[] = [];
    const proc = createProcess();
    proc.on("beforeExit", code => beforeExitCalls.push(code as number));
    expect(() => proc.exit(0)).toThrow();
    // Second call should not emit again because _exiting is true
    expect(() => proc.exit(0)).toThrow();
    expect(beforeExitCalls).toEqual([0]);
  });
});
