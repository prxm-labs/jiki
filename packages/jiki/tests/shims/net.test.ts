import { describe, it, expect, vi } from "vitest";
import { Socket, Server, createServer } from "../../src/polyfills/net";

describe("net.Socket", () => {
  it("connect emits warning about browser limitation", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const socket = new Socket();
    socket.connect(3000, "127.0.0.1");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("browser"));
    warnSpy.mockRestore();
  });

  it("connect calls callback when provided as last argument", async () => {
    const cb = vi.fn();
    const socket = new Socket();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    socket.connect(3000, "127.0.0.1", cb);
    await new Promise(r => setTimeout(r, 10));
    expect(cb).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("has destroy method that sets destroyed and emits close", () => {
    const socket = new Socket();
    const closeFn = vi.fn();
    socket.on("close", closeFn);
    expect(typeof socket.destroy).toBe("function");
    socket.destroy();
    expect(socket.destroyed).toBe(true);
    expect(closeFn).toHaveBeenCalledWith(false);
  });

  it("destroy with error emits close with true", () => {
    const socket = new Socket();
    const closeFn = vi.fn();
    socket.on("close", closeFn);
    socket.destroy(new Error("test"));
    expect(closeFn).toHaveBeenCalledWith(true);
  });
});

describe("net.createServer", () => {
  it("emits warning about browser limitation", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    createServer();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("browser"));
    warnSpy.mockRestore();
  });

  it("returns a Server instance", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = createServer();
    expect(server).toBeInstanceOf(Server);
    vi.restoreAllMocks();
  });
});
