import { describe, it, expect } from "vitest";
import { boot } from "../../src/container";

describe("Benchmark: require chains", () => {
  it("cold require of 50-module chain completes in reasonable time", () => {
    const container = boot();
    const chainLength = 50;

    for (let i = chainLength; i >= 1; i--) {
      if (i === chainLength) {
        container.writeFile(`/chain/mod-${i}.js`, `module.exports = ${i};`);
      } else {
        container.writeFile(
          `/chain/mod-${i}.js`,
          `
          const next = require('./mod-${i + 1}');
          module.exports = ${i} + next;
        `,
        );
      }
    }

    const start = performance.now();
    const result = container.runFile("/chain/mod-1.js");
    const coldTime = performance.now() - start;

    const expectedSum = (chainLength * (chainLength + 1)) / 2;
    expect(result.exports).toBe(expectedSum);
    expect(coldTime).toBeLessThan(500);

    container.destroy();
  });

  it("warm require (cached) is significantly faster than cold", () => {
    const container = boot();
    const chainLength = 30;

    for (let i = chainLength; i >= 1; i--) {
      if (i === chainLength) {
        container.writeFile(`/warm/mod-${i}.js`, `module.exports = ${i};`);
      } else {
        container.writeFile(
          `/warm/mod-${i}.js`,
          `
          const next = require('./mod-${i + 1}');
          module.exports = ${i} + next;
        `,
        );
      }
    }

    const coldStart = performance.now();
    container.runFile("/warm/mod-1.js");
    const coldTime = performance.now() - coldStart;

    container.writeFile(
      "/warm/entry.js",
      `module.exports = require('./mod-1');`,
    );
    const warmStart = performance.now();
    const result = container.runFile("/warm/entry.js");
    const warmTime = performance.now() - warmStart;

    const expectedSum = (chainLength * (chainLength + 1)) / 2;
    expect(result.exports).toBe(expectedSum);

    expect(warmTime).toBeLessThan(coldTime);

    container.destroy();
  });

  it("shared resolver memos improve performance across multiple executions", () => {
    const container = boot();

    container.writeFile("/shared/util.js", "module.exports = { value: 42 };");
    for (let i = 0; i < 20; i++) {
      container.writeFile(
        `/shared/consumer-${i}.js`,
        `
        module.exports = require('./util').value + ${i};
      `,
      );
    }

    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      const result = container.runFile(`/shared/consumer-${i}.js`);
      expect(result.exports).toBe(42 + i);
    }
    const totalTime = performance.now() - start;

    expect(totalTime).toBeLessThan(200);

    container.destroy();
  });

  it("clearCache and re-require still completes efficiently", () => {
    const container = boot();
    const depth = 20;

    for (let i = depth; i >= 1; i--) {
      if (i === depth) {
        container.writeFile(`/recache/mod-${i}.js`, `module.exports = ${i};`);
      } else {
        container.writeFile(
          `/recache/mod-${i}.js`,
          `
          module.exports = ${i} + require('./mod-${i + 1}');
        `,
        );
      }
    }

    container.runFile("/recache/mod-1.js");
    container.destroy();

    const start = performance.now();
    const result = container.runFile("/recache/mod-1.js");
    const reloadTime = performance.now() - start;

    const expectedSum = (depth * (depth + 1)) / 2;
    expect(result.exports).toBe(expectedSum);
    expect(reloadTime).toBeLessThan(200);

    container.destroy();
  });
});
