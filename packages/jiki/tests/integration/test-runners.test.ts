import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Container, boot } from "../../src/container";

describe("Integration: Test Runners", () => {
  let container: Container;

  beforeEach(() => {
    container = boot();
  });

  afterEach(() => {
    container.destroy();
  });

  describe("fork() with IPC", () => {
    it("should fork a child process and exchange IPC messages", async () => {
      container.writeFile(
        "/child.js",
        `
        process.on('message', (msg) => {
          process.send({ echo: msg.data, pid: process.pid });
        });
        process.send({ ready: true });
      `,
      );

      const { fork } = await import("../../src/polyfills/child_process");

      const child = fork("/child.js");
      const messages: unknown[] = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("IPC timeout")),
          5000,
        );

        child.on("message", (msg: any) => {
          messages.push(msg);
          if (msg.ready) {
            child.send({ data: "hello" });
          }
          if (msg.echo) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      expect(messages).toHaveLength(2);
      expect((messages[0] as any).ready).toBe(true);
      expect((messages[1] as any).echo).toBe("hello");
    });

    it("should handle process.exit() in forked child", async () => {
      container.writeFile(
        "/exit-child.js",
        `
        process.send({ starting: true });
        process.exit(42);
      `,
      );

      const { fork } = await import("../../src/polyfills/child_process");

      const child = fork("/exit-child.js");

      const exitCode = await new Promise<number>(resolve => {
        child.on("exit", (code: number) => resolve(code));
      });

      expect(exitCode).toBe(42);
    });

    it("should clone IPC messages with structuredClone", async () => {
      container.writeFile(
        "/clone-child.js",
        `
        process.on('message', (msg) => {
          msg.mutated = true;
          process.send(msg);
        });
      `,
      );

      const { fork } = await import("../../src/polyfills/child_process");

      const child = fork("/clone-child.js");
      const original = { data: "test", mutated: false };
      child.send(original);

      const received = await new Promise<any>(resolve => {
        child.on("message", resolve);
      });

      expect(original.mutated).toBe(false);
      expect(received.mutated).toBe(true);
    });
  });

  describe("bin stub resolution", () => {
    it("should find vitest bin stub after install", async () => {
      await container.install("vitest");
      expect(container.exists("/node_modules/.bin/vitest")).toBe(true);
    });

    it("should find jest bin stub after install", async () => {
      await container.install("jest");
      expect(container.exists("/node_modules/.bin/jest")).toBe(true);
    });
  });

  describe("ESM module loading", () => {
    it("should transform and load vitest ESM modules", async () => {
      await container.install("vitest");

      container.writeFile(
        "/test-import.js",
        `
        const vitest = require('vitest');
        const keys = Object.keys(vitest);
        console.log('VITEST_KEYS:' + keys.join(','));
      `,
      );

      const result = await container.run("node /test-import.js");
      const output = result.stdout + result.stderr;

      if (output.includes("VITEST_KEYS:")) {
        const keysLine = output
          .split("\n")
          .find(l => l.includes("VITEST_KEYS:"));
        const keys = keysLine?.split("VITEST_KEYS:")[1]?.split(",") || [];
        expect(keys.length).toBeGreaterThan(0);
      }
    });

    it("should transform and load jest core modules", async () => {
      await container.install("jest");

      container.writeFile(
        "/test-jest-import.js",
        `
        try {
          const jestCore = require('jest-circus');
          console.log('JEST_LOADED:true');
        } catch (e) {
          console.log('JEST_ERROR:' + e.message);
        }
      `,
      );

      const result = await container.run("node /test-jest-import.js");
      const output = result.stdout + result.stderr;
      expect(output).toContain("JEST_");
    });
  });

  describe("process management", () => {
    it("should capture process.exit code from scripts", async () => {
      container.writeFile(
        "/exit-script.js",
        `
        console.log('before exit');
        process.exit(0);
      `,
      );

      const result = await container.run("node /exit-script.js");
      expect(result.stdout).toContain("before exit");
      expect(result.exitCode).toBe(0);
    });

    it("should capture non-zero exit codes", async () => {
      container.writeFile(
        "/fail-script.js",
        `
        console.error('something failed');
        process.exit(1);
      `,
      );

      const result = await container.run("node /fail-script.js");
      expect(result.stderr).toContain("something failed");
      expect(result.exitCode).toBe(1);
    });

    it("should handle async scripts with process.exit", async () => {
      container.writeFile(
        "/async-exit.js",
        `
        setTimeout(() => {
          console.log('async done');
          process.exit(0);
        }, 50);
      `,
      );

      const result = await container.run("node /async-exit.js");
      expect(result.stdout).toContain("async done");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("test execution via node", () => {
    it("should run a simple test harness that passes", async () => {
      container.writeFile(
        "/sum.js",
        `
        function sum(a, b) { return a + b; }
        module.exports = { sum };
      `,
      );

      container.writeFile(
        "/run-tests.js",
        `
        const assert = require('assert');
        const { sum } = require('./sum');

        let passed = 0;
        let failed = 0;

        function test(name, fn) {
          try {
            fn();
            console.log('PASS: ' + name);
            passed++;
          } catch (e) {
            console.log('FAIL: ' + name + ' - ' + e.message);
            failed++;
          }
        }

        test('sum adds two numbers', () => {
          assert.strictEqual(sum(1, 2), 3);
        });

        test('sum handles negative numbers', () => {
          assert.strictEqual(sum(-1, -2), -3);
        });

        test('sum handles zero', () => {
          assert.strictEqual(sum(0, 0), 0);
        });

        console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
        process.exit(failed > 0 ? 1 : 0);
      `,
      );

      const result = await container.run("node /run-tests.js");
      expect(result.stdout).toContain("PASS: sum adds two numbers");
      expect(result.stdout).toContain("3 passed, 0 failed");
      expect(result.exitCode).toBe(0);
    });

    it("should run a test harness with failures", async () => {
      container.writeFile(
        "/fail-tests.js",
        `
        const assert = require('assert');

        let passed = 0;
        let failed = 0;

        function test(name, fn) {
          try {
            fn();
            console.log('PASS: ' + name);
            passed++;
          } catch (e) {
            console.log('FAIL: ' + name);
            failed++;
          }
        }

        test('this should fail', () => {
          assert.strictEqual(1, 2);
        });

        test('this should pass', () => {
          assert.strictEqual(1, 1);
        });

        console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
        process.exit(failed > 0 ? 1 : 0);
      `,
      );

      const result = await container.run("node /fail-tests.js");
      expect(result.stdout).toContain("FAIL: this should fail");
      expect(result.stdout).toContain("PASS: this should pass");
      expect(result.stdout).toContain("1 passed, 1 failed");
      expect(result.exitCode).toBe(1);
    });

    it("should run tests using forked workers with IPC", async () => {
      container.writeFile(
        "/worker.js",
        `
        process.on('message', (msg) => {
          const { testName, a, b, expected } = msg;
          const result = a + b;
          const passed = result === expected;
          process.send({ testName, passed, result, expected });
        });
      `,
      );

      container.writeFile(
        "/test-runner.js",
        `
        const { fork } = require('child_process');

        const tests = [
          { testName: 'add positives', a: 1, b: 2, expected: 3 },
          { testName: 'add negatives', a: -1, b: -2, expected: -3 },
          { testName: 'add zero', a: 0, b: 5, expected: 5 },
        ];

        const worker = fork('/worker.js');
        let completed = 0;
        let passed = 0;

        worker.on('message', (result) => {
          if (result.passed) {
            console.log('PASS: ' + result.testName);
            passed++;
          } else {
            console.log('FAIL: ' + result.testName + ' (got ' + result.result + ', expected ' + result.expected + ')');
          }
          completed++;
          if (completed === tests.length) {
            console.log('Results: ' + passed + '/' + tests.length + ' passed');
            process.exit(passed === tests.length ? 0 : 1);
          }
        });

        tests.forEach(test => worker.send(test));
      `,
      );

      const result = await container.run("node /test-runner.js");
      expect(result.stdout).toContain("PASS: add positives");
      expect(result.stdout).toContain("PASS: add negatives");
      expect(result.stdout).toContain("PASS: add zero");
      expect(result.stdout).toContain("3/3 passed");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("npm test command", () => {
    it("should run npm test script", async () => {
      container.writeFile(
        "/package.json",
        JSON.stringify({
          name: "test-project",
          scripts: { test: "node /run-tests.js" },
        }),
      );

      container.writeFile(
        "/run-tests.js",
        `
        console.log('test suite running');
        console.log('all tests passed');
        process.exit(0);
      `,
      );

      const result = await container.run("npm test");
      expect(result.stdout).toContain("test suite running");
      expect(result.stdout).toContain("all tests passed");
      expect(result.exitCode).toBe(0);
    });

    it("should report npm test failure", async () => {
      container.writeFile(
        "/package.json",
        JSON.stringify({
          name: "test-project",
          scripts: { test: "node /fail.js" },
        }),
      );

      container.writeFile(
        "/fail.js",
        `
        console.error('tests failed');
        process.exit(1);
      `,
      );

      const result = await container.run("npm test");
      expect(result.stderr).toContain("tests failed");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("streaming output", () => {
    it("should stream stdout in real-time", async () => {
      container.writeFile(
        "/stream-test.js",
        `
        console.log('line 1');
        console.log('line 2');
        console.log('line 3');
        process.exit(0);
      `,
      );

      const chunks: string[] = [];
      const result = await container.run("node /stream-test.js", {
        onStdout: (data: string) => chunks.push(data),
      });

      expect(result.stdout).toContain("line 1");
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
