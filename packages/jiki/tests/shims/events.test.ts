import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../../src/polyfills/events";
import events from "../../src/polyfills/events";

describe("EventEmitter", () => {
  it("on + emit: listener called with args", () => {
    const ee = new EventEmitter();
    const fn = vi.fn();
    ee.on("test", fn);
    ee.emit("test", "a", "b");
    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("emit returns true when listeners exist", () => {
    const ee = new EventEmitter();
    ee.on("test", () => {});
    expect(ee.emit("test")).toBe(true);
  });

  it("emit returns false when no listeners", () => {
    const ee = new EventEmitter();
    expect(ee.emit("test")).toBe(false);
  });

  it("once: listener called only once", () => {
    const ee = new EventEmitter();
    const fn = vi.fn();
    ee.once("test", fn);
    ee.emit("test");
    ee.emit("test");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("off / removeListener stops events", () => {
    const ee = new EventEmitter();
    const fn = vi.fn();
    ee.on("test", fn);
    ee.off("test", fn);
    ee.emit("test");
    expect(fn).not.toHaveBeenCalled();
  });

  it("removeAllListeners with event name", () => {
    const ee = new EventEmitter();
    ee.on("a", () => {});
    ee.on("b", () => {});
    ee.removeAllListeners("a");
    expect(ee.listenerCount("a")).toBe(0);
    expect(ee.listenerCount("b")).toBe(1);
  });

  it("removeAllListeners without args clears all", () => {
    const ee = new EventEmitter();
    ee.on("a", () => {});
    ee.on("b", () => {});
    ee.removeAllListeners();
    expect(ee.eventNames().length).toBe(0);
  });

  it("prependListener fires before existing listeners", () => {
    const ee = new EventEmitter();
    const order: number[] = [];
    ee.on("test", () => order.push(1));
    ee.prependListener("test", () => order.push(0));
    ee.emit("test");
    expect(order).toEqual([0, 1]);
  });

  it('emit("error") with no listener throws', () => {
    const ee = new EventEmitter();
    expect(() => ee.emit("error", new Error("fail"))).toThrow("fail");
  });

  it("listenerCount / listeners / eventNames", () => {
    const ee = new EventEmitter();
    const fn1 = () => {};
    const fn2 = () => {};
    ee.on("test", fn1);
    ee.on("test", fn2);
    ee.on("other", fn1);
    expect(ee.listenerCount("test")).toBe(2);
    expect(ee.listeners("test").length).toBe(2);
    expect(ee.eventNames().sort()).toEqual(["other", "test"]);
  });

  it("setMaxListeners / getMaxListeners", () => {
    const ee = new EventEmitter();
    expect(ee.getMaxListeners()).toBe(10);
    ee.setMaxListeners(20);
    expect(ee.getMaxListeners()).toBe(20);
  });

  it("prependOnceListener fires once at the front", () => {
    const ee = new EventEmitter();
    const order: number[] = [];
    ee.on("test", () => order.push(1));
    ee.prependOnceListener("test", () => order.push(0));
    ee.emit("test");
    ee.emit("test");
    expect(order).toEqual([0, 1, 1]);
  });

  describe("static methods", () => {
    it("events.once returns promise that resolves", async () => {
      const ee = new EventEmitter();
      const promise = events.once(ee, "done");
      ee.emit("done", "result");
      const args = await promise;
      expect(args).toEqual(["result"]);
    });

    it("EventEmitter.once (static) returns a promise", async () => {
      const ee = new EventEmitter();
      setTimeout(() => ee.emit("done", 42), 10);
      const [result] = await EventEmitter.once(ee, "done");
      expect(result).toBe(42);
    });

    it("EventEmitter.once (static) rejects on error", async () => {
      const ee = new EventEmitter();
      setTimeout(() => ee.emit("error", new Error("boom")), 10);
      await expect(EventEmitter.once(ee, "done")).rejects.toThrow("boom");
    });

    it("EventEmitter.listenerCount (static)", () => {
      const ee = new EventEmitter();
      ee.on("x", () => {});
      ee.on("x", () => {});
      expect(EventEmitter.listenerCount(ee, "x")).toBe(2);
    });
  });
});
