import { describe, it, expect, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: vitest example workflow", () => {
  let container: Container;

  afterEach(() => {
    container?.destroy();
  });

  it("boot -> write test files + framework -> run tests", async () => {
    container = boot({
      cwd: "/",
      onConsole: () => {},
    });

    container.writeFile(
      "/src/math.js",
      `
      function sum(a, b) { return a + b; }
      function multiply(a, b) { return a * b; }
      module.exports = { sum, multiply };
    `,
    );

    container.writeFile(
      "/src/test-framework.js",
      `
      const suites = [];
      let currentSuite = null;

      function describe(name, fn) {
        const suite = { name, tests: [] };
        const prev = currentSuite;
        currentSuite = suite;
        fn();
        currentSuite = prev;
        suites.push(suite);
      }

      function test(name, fn) {
        if (!currentSuite) throw new Error('test() must be called inside describe()');
        currentSuite.tests.push({ name, fn });
      }

      function expect(actual) {
        return {
          toBe(expected) {
            if (actual !== expected) {
              throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
            }
          },
        };
      }

      function runAll() {
        let passed = 0, failed = 0;
        const results = [];
        for (const suite of suites) {
          for (const t of suite.tests) {
            try {
              t.fn();
              passed++;
              results.push({ suite: suite.name, name: t.name, status: 'pass' });
            } catch (err) {
              failed++;
              results.push({ suite: suite.name, name: t.name, status: 'fail', error: err.message });
            }
          }
        }
        console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
        suites.length = 0;
        return results;
      }

      module.exports = { describe, test, expect, runAll };
    `,
    );

    container.writeFile(
      "/src/math.test.js",
      `
      const { describe, test, expect } = require('./test-framework');
      const { sum, multiply } = require('./math');

      describe('sum', () => {
        test('adds two positive numbers', () => {
          expect(sum(1, 2)).toBe(3);
        });
        test('adds negative numbers', () => {
          expect(sum(-1, -2)).toBe(-3);
        });
      });

      describe('multiply', () => {
        test('multiplies two numbers', () => {
          expect(multiply(3, 4)).toBe(12);
        });
      });
    `,
    );

    container.writeFile(
      "/run-tests.js",
      `
      require('/src/math.test');
      const { runAll } = require('/src/test-framework');
      const results = runAll();
      const failed = results.filter(r => r.status === 'fail').length;
      process.exit(failed > 0 ? 1 : 0);
    `,
    );

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "vitest-demo",
        scripts: { test: "node /run-tests.js" },
      }),
    );

    const result = await container.run("npm test");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Results: 3 passed, 0 failed");
  });

  it("test failure is reported with non-zero exit code", async () => {
    container = boot({
      cwd: "/",
      onConsole: () => {},
    });

    container.writeFile(
      "/src/test-framework.js",
      `
      const suites = [];
      let currentSuite = null;

      function describe(name, fn) {
        const suite = { name, tests: [] };
        const prev = currentSuite;
        currentSuite = suite;
        fn();
        currentSuite = prev;
        suites.push(suite);
      }

      function test(name, fn) {
        currentSuite.tests.push({ name, fn });
      }

      function expect(actual) {
        return {
          toBe(expected) {
            if (actual !== expected) {
              throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
            }
          },
        };
      }

      function runAll() {
        let passed = 0, failed = 0;
        for (const suite of suites) {
          for (const t of suite.tests) {
            try { t.fn(); passed++; }
            catch { failed++; }
          }
        }
        console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
        suites.length = 0;
        return { passed, failed };
      }

      module.exports = { describe, test, expect, runAll };
    `,
    );

    container.writeFile(
      "/fail.test.js",
      `
      const { describe, test, expect } = require('/src/test-framework');
      describe('failing', () => {
        test('should fail', () => { expect(1).toBe(2); });
      });
    `,
    );

    container.writeFile(
      "/run-tests.js",
      `
      require('/fail.test');
      const { runAll } = require('/src/test-framework');
      const r = runAll();
      process.exit(r.failed > 0 ? 1 : 0);
    `,
    );

    container.writeFile(
      "/package.json",
      JSON.stringify({
        name: "test",
        scripts: { test: "node /run-tests.js" },
      }),
    );

    const result = await container.run("npm test");
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("1 failed");
  });

  it("multiple test suites with mixed results", async () => {
    container = boot({ onConsole: () => {} });

    container.writeFile(
      "/src/test-framework.js",
      `
      const suites = [];
      let currentSuite = null;

      function describe(name, fn) {
        const suite = { name, tests: [] };
        const prev = currentSuite;
        currentSuite = suite;
        fn();
        currentSuite = prev;
        suites.push(suite);
      }

      function test(name, fn) {
        currentSuite.tests.push({ name, fn });
      }

      function expect(actual) {
        return {
          toBe(expected) {
            if (actual !== expected) throw new Error('mismatch');
          },
        };
      }

      function runAll() {
        let passed = 0, failed = 0;
        for (const suite of suites) {
          for (const t of suite.tests) {
            try { t.fn(); passed++; console.log('PASS: ' + t.name); }
            catch { failed++; console.log('FAIL: ' + t.name); }
          }
        }
        suites.length = 0;
        return { passed, failed };
      }

      module.exports = { describe, test, expect, runAll };
    `,
    );

    container.writeFile(
      "/src/string-utils.js",
      `
      function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
      function reverse(str) { return str.split('').reverse().join(''); }
      module.exports = { capitalize, reverse };
    `,
    );

    container.writeFile(
      "/src/string-utils.test.js",
      `
      const { describe, test, expect } = require('/src/test-framework');
      const { capitalize, reverse } = require('/src/string-utils');

      describe('capitalize', () => {
        test('capitalizes first letter', () => { expect(capitalize('hello')).toBe('Hello'); });
        test('handles empty string', () => { expect(capitalize('')).toBe(''); });
      });

      describe('reverse', () => {
        test('reverses a string', () => { expect(reverse('abc')).toBe('cba'); });
      });
    `,
    );

    container.writeFile(
      "/run.js",
      `
      require('/src/string-utils.test');
      const { runAll } = require('/src/test-framework');
      const r = runAll();
      console.log('Total: ' + (r.passed + r.failed));
    `,
    );

    const result = await container.run("node /run.js");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("PASS: capitalizes first letter");
    expect(result.stdout).toContain("PASS: handles empty string");
    expect(result.stdout).toContain("PASS: reverses a string");
    expect(result.stdout).toContain("Total: 3");
  });
});
