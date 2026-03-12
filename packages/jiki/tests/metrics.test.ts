import { describe, it, expect, beforeEach } from "vitest";
import { Metrics } from "../src/metrics";
import { Container, boot } from "../src/container";

describe("Metrics", () => {
  let m: Metrics;

  beforeEach(() => {
    m = new Metrics();
  });

  it("starts with zero counts", () => {
    const s = m.snapshot();
    expect(s.resolveCount).toBe(0);
    expect(s.transpileCount).toBe(0);
    expect(s.vfsReadCount).toBe(0);
    expect(s.vfsWriteCount).toBe(0);
    expect(s.cacheHits).toBe(0);
    expect(s.cacheMisses).toBe(0);
    expect(s.commandCount).toBe(0);
    expect(s.installCount).toBe(0);
  });

  it("tracks resolve", () => {
    m.trackResolve(5);
    m.trackResolve(3);
    const s = m.snapshot();
    expect(s.resolveCount).toBe(2);
    expect(s.resolveTimeMs).toBe(8);
  });

  it("tracks transpile", () => {
    m.trackTranspile(10);
    expect(m.snapshot().transpileCount).toBe(1);
    expect(m.snapshot().transpileTimeMs).toBe(10);
  });

  it("tracks reads and writes", () => {
    m.trackRead();
    m.trackRead();
    m.trackWrite();
    expect(m.snapshot().vfsReadCount).toBe(2);
    expect(m.snapshot().vfsWriteCount).toBe(1);
  });

  it("tracks cache hits and misses with rate", () => {
    m.trackCacheHit();
    m.trackCacheHit();
    m.trackCacheMiss();
    const s = m.snapshot();
    expect(s.cacheHits).toBe(2);
    expect(s.cacheMisses).toBe(1);
    expect(s.cacheHitRate).toBeCloseTo(2 / 3);
  });

  it("cacheHitRate is 0 when no lookups", () => {
    expect(m.snapshot().cacheHitRate).toBe(0);
  });

  it("tracks commands", () => {
    m.trackCommand();
    m.trackCommand();
    expect(m.snapshot().commandCount).toBe(2);
  });

  it("tracks installs", () => {
    m.trackInstall(500);
    expect(m.snapshot().installCount).toBe(1);
    expect(m.snapshot().installTimeMs).toBe(500);
  });

  it("reports uptime", () => {
    const s = m.snapshot();
    expect(s.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(s.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it("reset clears everything", () => {
    m.trackRead();
    m.trackWrite();
    m.trackCommand();
    m.reset();
    const s = m.snapshot();
    expect(s.vfsReadCount).toBe(0);
    expect(s.vfsWriteCount).toBe(0);
    expect(s.commandCount).toBe(0);
  });
});

describe("Container metrics integration", () => {
  it("container has metrics", () => {
    const c = boot();
    expect(c.metrics).toBeDefined();
    expect(c.getMetrics().vfsReadCount).toBe(0);
  });

  it("writeFile tracks writes", () => {
    const c = boot();
    c.writeFile("/a.txt", "hello");
    expect(c.getMetrics().vfsWriteCount).toBe(1);
  });

  it("readFile tracks reads", () => {
    const c = boot();
    c.writeFile("/a.txt", "hello");
    c.readFile("/a.txt");
    expect(c.getMetrics().vfsReadCount).toBe(1);
  });

  it("run tracks commands", async () => {
    const c = boot();
    await c.run("echo hello");
    expect(c.getMetrics().commandCount).toBe(1);
  });
});
