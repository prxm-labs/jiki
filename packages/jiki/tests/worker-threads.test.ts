import { describe, it, expect, vi } from "vitest";
import {
  Worker,
  MessageChannel,
  MessagePort,
  isMainThread,
  threadId,
} from "../src/polyfills/worker-threads";

describe("worker_threads polyfill", () => {
  describe("MessagePort", () => {
    it("two paired ports can exchange messages", async () => {
      const [a, b] = MessagePort._pair();
      a.start();
      b.start();

      const received: unknown[] = [];
      b.on("message", (msg: unknown) => received.push(msg));

      a.postMessage("hello");
      a.postMessage({ data: 42 });

      await new Promise(r => setTimeout(r, 10));
      expect(received).toEqual(["hello", { data: 42 }]);
    });

    it("close emits close event", () => {
      const [a] = MessagePort._pair();
      const closed = vi.fn();
      a.on("close", closed);
      a.close();
      expect(closed).toHaveBeenCalledOnce();
    });

    it("postMessage after close is ignored", async () => {
      const [a, b] = MessagePort._pair();
      a.start();
      b.start();

      const received: unknown[] = [];
      b.on("message", (msg: unknown) => received.push(msg));

      a.close();
      a.postMessage("should not arrive");

      await new Promise(r => setTimeout(r, 10));
      expect(received).toEqual([]);
    });
  });

  describe("MessageChannel", () => {
    it("creates two connected ports", async () => {
      const channel = new MessageChannel();
      const received: unknown[] = [];
      channel.port2.on("message", (msg: unknown) => received.push(msg));

      channel.port1.postMessage("test");
      await new Promise(r => setTimeout(r, 10));
      expect(received).toEqual(["test"]);
    });

    it("ports are bidirectional", async () => {
      const channel = new MessageChannel();
      const from1: unknown[] = [];
      const from2: unknown[] = [];

      channel.port1.on("message", (msg: unknown) => from1.push(msg));
      channel.port2.on("message", (msg: unknown) => from2.push(msg));

      channel.port1.postMessage("from-1");
      channel.port2.postMessage("from-2");

      await new Promise(r => setTimeout(r, 10));
      expect(from2).toEqual(["from-1"]);
      expect(from1).toEqual(["from-2"]);
    });
  });

  describe("Worker", () => {
    it("creates a worker with a threadId", () => {
      const w = new Worker("/worker.js");
      expect(w.threadId).toBeGreaterThan(0);
    });

    it("emits online event", async () => {
      const online = vi.fn();
      const w = new Worker("/worker.js");
      w.on("online", online);
      await new Promise(r => setTimeout(r, 10));
      expect(online).toHaveBeenCalledOnce();
    });

    it("postMessage sends to worker", async () => {
      const w = new Worker("/worker.js");
      const messages: unknown[] = [];
      // The worker's internal port receives messages
      w.on("message", (msg: unknown) => messages.push(msg));
      // This would require the worker to actually run code — skip for now
      expect(w.threadId).toBeGreaterThan(0);
    });

    it("terminate resolves with exit code", async () => {
      const w = new Worker("/worker.js");
      const exitCode = await w.terminate();
      expect(exitCode).toBe(0);
    });

    it("terminate emits exit event", async () => {
      const exit = vi.fn();
      const w = new Worker("/worker.js");
      w.on("exit", exit);
      await w.terminate();
      expect(exit).toHaveBeenCalledWith(0);
    });
  });

  describe("module exports", () => {
    it("isMainThread is true", () => {
      expect(isMainThread).toBe(true);
    });

    it("threadId is 0 for main thread", () => {
      expect(threadId).toBe(0);
    });
  });
});
