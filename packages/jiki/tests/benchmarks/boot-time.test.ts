import { describe, it, expect } from "vitest";
import { Container, boot } from "../../src/container";

describe("Benchmark: boot time", () => {
  it("Container boot completes under 50ms without transpiler init", () => {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const c = boot();
      times.push(performance.now() - start);
      c.destroy();
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);

    expect(avg).toBeLessThan(50);
    expect(max).toBeLessThan(100);
  });

  it("Container boot with pnpm layout under 50ms", () => {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const c = new Container({ packageManager: "pnpm" });
      times.push(performance.now() - start);
      c.destroy();
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(50);
  });

  it("snapshot restore time scales linearly with file count", () => {
    const sizes = [100, 500, 1000];
    const timings: { count: number; ms: number }[] = [];

    for (const count of sizes) {
      const c = boot();
      for (let i = 0; i < count; i++) {
        c.writeFile(`/file-${i}.txt`, `content-${i}`);
      }
      const snapshot = c.toSnapshot();
      c.destroy();

      const start = performance.now();
      const restored = Container.fromSnapshot(snapshot);
      timings.push({ count, ms: performance.now() - start });
      restored.destroy();
    }

    for (const t of timings) {
      expect(t.ms).toBeLessThan(t.count * 2);
    }

    if (timings.length >= 2) {
      const ratio = timings[timings.length - 1].ms / timings[0].ms;
      const countRatio = sizes[sizes.length - 1] / sizes[0];
      expect(ratio).toBeLessThan(countRatio * 5);
    }
  });

  it("Container with autoInstall boots under 50ms", () => {
    const start = performance.now();
    const c = new Container({ autoInstall: true });
    const bootTime = performance.now() - start;

    expect(bootTime).toBeLessThan(50);
    c.destroy();
  });
});
