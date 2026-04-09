import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


export interface TestResult {
  name: string;
  suite: string;
  status: "pass" | "fail";
  error?: string;
}

// ---------------------------------------------------------------------------
// Virtual project files
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "jest-demo",
      version: "1.0.0",
      scripts: { test: "node run-tests.js" },
      devDependencies: { jest: "^29.7.0" },
    },
    null,
    2,
  ),

  // ── Jest-like framework ──────────────────────────────────────────────

  "/src/jest-framework.js": `// Minimal Jest-compatible test framework
const suites = [];
let currentSuite = null;

function describe(name, fn) {
  const suite = {
    name,
    tests: [],
    beforeEach: [],
    afterEach: [],
    beforeAll: [],
    afterAll: [],
  };
  const prev = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = prev;
  suites.push(suite);
}

function test(name, fn) {
  if (!currentSuite) throw new Error('test() must be inside describe()');
  currentSuite.tests.push({ name, fn });
}
const it = test;

function beforeEach(fn) {
  if (!currentSuite) throw new Error('beforeEach() must be inside describe()');
  currentSuite.beforeEach.push(fn);
}
function afterEach(fn) {
  if (!currentSuite) throw new Error('afterEach() must be inside describe()');
  currentSuite.afterEach.push(fn);
}
function beforeAll(fn) {
  if (!currentSuite) throw new Error('beforeAll() must be inside describe()');
  currentSuite.beforeAll.push(fn);
}
function afterAll(fn) {
  if (!currentSuite) throw new Error('afterAll() must be inside describe()');
  currentSuite.afterAll.push(fn);
}

// ── jest.fn() ──

function createMockFn(impl) {
  const calls = [];
  const results = [];
  let mockImpl = impl || (() => undefined);

  const mockFn = function (...args) {
    calls.push(args);
    try {
      const result = mockImpl.apply(this, args);
      results.push({ type: 'return', value: result });
      return result;
    } catch (e) {
      results.push({ type: 'throw', value: e });
      throw e;
    }
  };

  mockFn.mock = { calls, results };

  mockFn.mockReturnValue = (val) => {
    mockImpl = () => val;
    return mockFn;
  };
  mockFn.mockReturnValueOnce = (val) => {
    const prev = mockImpl;
    const callCount = calls.length;
    mockImpl = function (...args) {
      if (calls.length === callCount + 1) {
        mockImpl = prev;
        return val;
      }
      return prev.apply(this, args);
    };
    return mockFn;
  };
  mockFn.mockImplementation = (fn) => {
    mockImpl = fn;
    return mockFn;
  };
  mockFn.mockClear = () => {
    calls.length = 0;
    results.length = 0;
    return mockFn;
  };
  mockFn.mockReset = () => {
    calls.length = 0;
    results.length = 0;
    mockImpl = () => undefined;
    return mockFn;
  };

  return mockFn;
}

// ── jest.spyOn() ──

const spies = [];

function spyOn(obj, methodName) {
  const original = obj[methodName];
  const spy = createMockFn(original.bind(obj));
  spy.mockRestore = () => { obj[methodName] = original; };
  obj[methodName] = spy;
  spies.push(spy);
  return spy;
}

const jest = {
  fn: createMockFn,
  spyOn,
  clearAllMocks: () => { spies.forEach((s) => s.mockClear()); },
  restoreAllMocks: () => {
    spies.forEach((s) => { if (s.mockRestore) s.mockRestore(); });
    spies.length = 0;
  },
};

// ── expect() matchers ──

function expect(actual) {
  const matchers = {
    toBe(expected) {
      if (actual !== expected)
        throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
    },
    toBeTruthy() {
      if (!actual) throw new Error('Expected truthy but got ' + JSON.stringify(actual));
    },
    toBeFalsy() {
      if (actual) throw new Error('Expected falsy but got ' + JSON.stringify(actual));
    },
    toBeNull() {
      if (actual !== null) throw new Error('Expected null but got ' + JSON.stringify(actual));
    },
    toBeUndefined() {
      if (actual !== undefined) throw new Error('Expected undefined but got ' + JSON.stringify(actual));
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('Expected defined but got undefined');
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error('Expected ' + actual + ' > ' + n);
    },
    toBeLessThan(n) {
      if (!(actual < n)) throw new Error('Expected ' + actual + ' < ' + n);
    },
    toContain(item) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item))
          throw new Error('Expected array to contain ' + JSON.stringify(item));
      } else if (typeof actual === 'string') {
        if (!actual.includes(item))
          throw new Error('Expected string to contain ' + JSON.stringify(item));
      }
    },
    toHaveLength(len) {
      if (actual.length !== len)
        throw new Error('Expected length ' + len + ' but got ' + actual.length);
    },
    toThrow(msg) {
      let threw = false;
      let thrownError;
      try { actual(); } catch (e) { threw = true; thrownError = e; }
      if (!threw) throw new Error('Expected function to throw');
      if (msg && thrownError.message !== msg)
        throw new Error('Expected throw "' + msg + '" but got "' + thrownError.message + '"');
    },
    toHaveBeenCalled() {
      if (!actual.mock || actual.mock.calls.length === 0)
        throw new Error('Expected mock to have been called');
    },
    toHaveBeenCalledTimes(n) {
      const count = actual.mock ? actual.mock.calls.length : 0;
      if (count !== n)
        throw new Error('Expected ' + n + ' calls but got ' + count);
    },
    toHaveBeenCalledWith(...expectedArgs) {
      if (!actual.mock) throw new Error('Not a mock function');
      const found = actual.mock.calls.some(
        (call) => JSON.stringify(call) === JSON.stringify(expectedArgs)
      );
      if (!found)
        throw new Error(
          'Expected mock to be called with ' + JSON.stringify(expectedArgs) +
          ' but calls were ' + JSON.stringify(actual.mock.calls)
        );
    },
    toHaveReturnedWith(val) {
      if (!actual.mock) throw new Error('Not a mock function');
      const found = actual.mock.results.some(
        (r) => r.type === 'return' && JSON.stringify(r.value) === JSON.stringify(val)
      );
      if (!found) throw new Error('Expected mock to return ' + JSON.stringify(val));
    },
  };
  return matchers;
}

// ── Runner ──

async function runAll() {
  let passed = 0;
  let failed = 0;
  const results = [];

  for (const suite of suites) {
    console.log('\\n  ' + suite.name);

    for (const ba of suite.beforeAll) await ba();

    for (const t of suite.tests) {
      try {
        for (const be of suite.beforeEach) await be();
        await t.fn();
        for (const ae of suite.afterEach) await ae();
        passed++;
        console.log('    \\u2713 ' + t.name);
        results.push({ suite: suite.name, name: t.name, status: 'pass' });
      } catch (err) {
        for (const ae of suite.afterEach) { try { await ae(); } catch {} }
        failed++;
        console.log('    \\u2717 ' + t.name);
        console.log('      ' + err.message);
        results.push({ suite: suite.name, name: t.name, status: 'fail', error: err.message });
      }
    }

    for (const aa of suite.afterAll) { try { await aa(); } catch {} }
  }

  console.log('\\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  console.log(failed > 0 ? '  Status: FAIL' : '  Status: PASS');

  suites.length = 0;
  return results;
}

module.exports = { describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest, runAll };
`,

  // ── Source modules ───────────────────────────────────────────────────

  "/src/calculator.js": `class Calculator {
  constructor() {
    this.history = [];
    this.result = 0;
  }

  add(a, b) {
    this.result = a + b;
    this.history.push({ op: 'add', a, b, result: this.result });
    return this.result;
  }

  subtract(a, b) {
    this.result = a - b;
    this.history.push({ op: 'subtract', a, b, result: this.result });
    return this.result;
  }

  multiply(a, b) {
    this.result = a * b;
    this.history.push({ op: 'multiply', a, b, result: this.result });
    return this.result;
  }

  divide(a, b) {
    if (b === 0) throw new Error('Division by zero');
    this.result = a / b;
    this.history.push({ op: 'divide', a, b, result: this.result });
    return this.result;
  }

  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
    this.result = 0;
  }
}

module.exports = { Calculator };
`,

  "/src/user-service.js": `class UserService {
  constructor(apiClient, logger) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.cache = new Map();
  }

  async getUser(id) {
    if (this.cache.has(id)) {
      this.logger.info('Cache hit for user ' + id);
      return this.cache.get(id);
    }

    this.logger.info('Fetching user ' + id);
    const user = await this.apiClient.get('/users/' + id);
    this.cache.set(id, user);
    return user;
  }

  async createUser(data) {
    this.logger.info('Creating user: ' + data.name);
    const user = await this.apiClient.post('/users', data);
    this.cache.set(user.id, user);
    return user;
  }

  async deleteUser(id) {
    this.logger.info('Deleting user ' + id);
    await this.apiClient.delete('/users/' + id);
    this.cache.delete(id);
    return true;
  }

  getCacheSize() {
    return this.cache.size;
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = { UserService };
`,

  "/src/event-bus.js": `class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    const idx = handlers.indexOf(callback);
    if (idx !== -1) handlers.splice(idx, 1);
  }

  emit(event, ...args) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((h) => h(...args));
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  listenerCount(event) {
    return (this.listeners.get(event) || []).length;
  }

  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

module.exports = { EventBus };
`,

  // ── Test files ───────────────────────────────────────────────────────

  "/src/calculator.test.js": `const { describe, test, expect, beforeEach, afterEach, jest } = require('./jest-framework');
const { Calculator } = require('./calculator');

describe('Calculator with beforeEach/afterEach', () => {
  let calc;
  let consoleSpy;

  beforeEach(() => {
    calc = new Calculator();
    consoleSpy = jest.spyOn(console, 'log');
  });

  afterEach(() => {
    calc.clearHistory();
    consoleSpy.mockRestore();
  });

  test('adds two numbers correctly', () => {
    expect(calc.add(2, 3)).toBe(5);
    expect(calc.result).toBe(5);
  });

  test('subtracts two numbers correctly', () => {
    expect(calc.subtract(10, 4)).toBe(6);
  });

  test('multiplies two numbers correctly', () => {
    expect(calc.multiply(3, 7)).toBe(21);
  });

  test('divides two numbers correctly', () => {
    expect(calc.divide(10, 2)).toBe(5);
  });

  test('throws on division by zero', () => {
    expect(() => calc.divide(5, 0)).toThrow('Division by zero');
  });

  test('tracks operation history', () => {
    calc.add(1, 2);
    calc.multiply(3, 4);
    const history = calc.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].op).toBe('add');
    expect(history[1].op).toBe('multiply');
  });

  test('clears history via afterEach', () => {
    calc.add(1, 1);
    expect(calc.getHistory()).toHaveLength(1);
  });
});
`,

  "/src/user-service.test.js": `const { describe, test, expect, beforeEach, afterEach, jest } = require('./jest-framework');
const { UserService } = require('./user-service');

describe('UserService with jest.fn() mocks', () => {
  let service;
  let mockApiClient;
  let mockLogger;

  beforeEach(() => {
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    service = new UserService(mockApiClient, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('fetches a user and caches it', async () => {
    const fakeUser = { id: 1, name: 'Alice', email: 'alice@test.com' };
    mockApiClient.get.mockReturnValue(Promise.resolve(fakeUser));

    const user = await service.getUser(1);

    expect(user).toEqual(fakeUser);
    expect(mockApiClient.get).toHaveBeenCalledWith('/users/1');
    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Fetching user 1');
  });

  test('returns cached user on second call', async () => {
    const fakeUser = { id: 2, name: 'Bob' };
    mockApiClient.get.mockReturnValue(Promise.resolve(fakeUser));

    await service.getUser(2);
    const cached = await service.getUser(2);

    expect(cached).toEqual(fakeUser);
    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Cache hit for user 2');
  });

  test('creates a user via API', async () => {
    const newUser = { id: 3, name: 'Charlie' };
    mockApiClient.post.mockReturnValue(Promise.resolve(newUser));

    const created = await service.createUser({ name: 'Charlie' });

    expect(created).toEqual(newUser);
    expect(mockApiClient.post).toHaveBeenCalledWith('/users', { name: 'Charlie' });
    expect(service.getCacheSize()).toBe(1);
  });

  test('deletes a user and removes from cache', async () => {
    const fakeUser = { id: 4, name: 'Diana' };
    mockApiClient.get.mockReturnValue(Promise.resolve(fakeUser));
    mockApiClient.delete.mockReturnValue(Promise.resolve());

    await service.getUser(4);
    expect(service.getCacheSize()).toBe(1);

    await service.deleteUser(4);
    expect(service.getCacheSize()).toBe(0);
    expect(mockApiClient.delete).toHaveBeenCalledWith('/users/4');
  });

  test('mockReturnValue stubs the return', () => {
    const stub = jest.fn().mockReturnValue(42);
    expect(stub()).toBe(42);
    expect(stub()).toBe(42);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  test('mockImplementation replaces behavior', () => {
    const stub = jest.fn().mockImplementation((x) => x * 2);
    expect(stub(5)).toBe(10);
    expect(stub(3)).toBe(6);
    expect(stub).toHaveBeenCalledWith(5);
    expect(stub).toHaveBeenCalledWith(3);
  });
});
`,

  "/src/event-bus.test.js": `const { describe, test, expect, beforeEach, afterEach, jest } = require('./jest-framework');
const { EventBus } = require('./event-bus');

describe('EventBus with spies and hooks', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.removeAllListeners();
    jest.restoreAllMocks();
  });

  test('calls listener when event is emitted', () => {
    const handler = jest.fn();
    bus.on('click', handler);
    bus.emit('click', { x: 10, y: 20 });

    expect(handler).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  test('supports multiple listeners', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    bus.on('update', handler1);
    bus.on('update', handler2);
    bus.emit('update', 'data');

    expect(handler1).toHaveBeenCalledWith('data');
    expect(handler2).toHaveBeenCalledWith('data');
    expect(bus.listenerCount('update')).toBe(2);
  });

  test('removes a specific listener with off()', () => {
    const handler = jest.fn();
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');

    expect(handler).toHaveBeenCalledTimes(0);
  });

  test('once() fires only once then auto-removes', () => {
    const handler = jest.fn();
    bus.once('init', handler);
    bus.emit('init', 'first');
    bus.emit('init', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  test('unsubscribe via returned function', () => {
    const handler = jest.fn();
    const unsubscribe = bus.on('msg', handler);
    bus.emit('msg', 'a');
    unsubscribe();
    bus.emit('msg', 'b');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('a');
  });

  test('jest.spyOn tracks calls to emit', () => {
    const emitSpy = jest.spyOn(bus, 'emit');
    bus.emit('ping');
    bus.emit('pong', 123);

    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledWith('ping');
    expect(emitSpy).toHaveBeenCalledWith('pong', 123);
  });

  test('removeAllListeners clears everything', () => {
    bus.on('a', jest.fn());
    bus.on('b', jest.fn());
    bus.removeAllListeners();

    expect(bus.listenerCount('a')).toBe(0);
    expect(bus.listenerCount('b')).toBe(0);
  });
});
`,

  // ── Test runner ──────────────────────────────────────────────────────

  "/run-tests.js": `const path = require('path');
const fs = require('fs');

async function main() {
  console.log('\\n  Running Jest test suites...\\n');

  const testFiles = [];
  function findTests(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) findTests(full);
      else if (entry.endsWith('.test.js')) testFiles.push(full);
    }
  }
  findTests('/src');

  for (const file of testFiles) {
    console.log('  Suite: ' + path.basename(file));
    require(file);
  }

  const { runAll } = require('/src/jest-framework');
  const results = await runAll();

  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log('\\n  \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500');
  console.log('  Test Suites: ' + testFiles.length + ' total');
  console.log('  Tests:       ' + passed + ' passed, ' + (failed > 0 ? failed + ' failed, ' : '') + total + ' total');
  console.log('  \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
`,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

export function useJestRunner() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);

  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const refreshFiles = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const buildTree = (dirPath: string): FileEntry[] => {
      try {
        const entries = c.vfs.readdirSync(dirPath);
        return entries
          .filter((n) => !n.startsWith("."))
          .sort((a, b) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fullA).isDirectory();
            const bDir = c.vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fullPath = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = c.vfs.statSync(fullPath).isDirectory();
            return {
              name,
              path: fullPath,
              isDir,
              children: isDir ? buildTree(fullPath) : undefined,
            };
          });
      } catch {
        return [];
      }
    };
    setFiles(buildTree("/"));
  }, []);

  const parseTestOutput = useCallback((output: string): TestResult[] => {
    const results: TestResult[] = [];
    let currentSuite = "";
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      const suiteMatch = trimmed.match(/^(\S.+)$/);
      if (
        suiteMatch &&
        !trimmed.startsWith("\u2713") &&
        !trimmed.startsWith("\u2717") &&
        !trimmed.startsWith("Results:") &&
        !trimmed.startsWith("Status:") &&
        !trimmed.startsWith("Test ") &&
        !trimmed.startsWith("Tests:") &&
        !trimmed.startsWith("\u2500") &&
        !trimmed.startsWith("Running") &&
        !trimmed.startsWith("Suite:")
      ) {
        currentSuite = suiteMatch[1];
      }
      if (trimmed.startsWith("\u2713 ")) {
        results.push({ name: trimmed.slice(2), suite: currentSuite, status: "pass" });
      } else if (trimmed.startsWith("\u2717 ")) {
        results.push({ name: trimmed.slice(2), suite: currentSuite, status: "fail" });
      }
    }
    return results;
  }, []);

  // ── Boot ──

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted. Jest demo project loaded.");
    pushLine("info", 'Click "Run Tests" or type: npm test');
    refreshFiles();
    setSelectedFile("/src/calculator.test.js");
    setFileContent(VIRTUAL_FILES["/src/calculator.test.js"]);
  }, [pushLine, refreshFiles]);

  // ── Actions ──

  const runTests = useCallback(async () => {
    const c = containerRef.current;
    if (!c || isRunning) return;
    setIsRunning(true);
    setTestResults([]);
    pushLine("command", "$ npm test");

    try {
      const result = await c.run("npm test");
      if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
      if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());

      const combined = result.stdout + "\n" + result.stderr;
      const parsed = parseTestOutput(combined);
      setTestResults(parsed);

      if (result.exitCode !== 0) {
        pushLine("info", `Tests finished with exit code ${result.exitCode}`);
      }
    } catch (err) {
      pushLine("stderr", String(err));
    }

    setIsRunning(false);
    refreshFiles();
  }, [pushLine, refreshFiles, isRunning, parseTestOutput]);

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      pushLine("command", `$ ${cmd}`);
      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());

        if (cmd.trim() === "npm test" || cmd.trim().startsWith("node run-tests")) {
          const combined = result.stdout + "\n" + result.stderr;
          setTestResults(parseTestOutput(combined));
        }

        if (result.exitCode !== 0) {
          pushLine("info", `Process exited with code ${result.exitCode}`);
        }
      } catch (err) {
        pushLine("stderr", String(err));
      }
      refreshFiles();
    },
    [pushLine, refreshFiles, parseTestOutput],
  );

  const selectFile = useCallback(
    (path: string) => {
      const c = containerRef.current;
      if (!c) return;
      try {
        const content = c.readFile(path);
        setSelectedFile(path);
        setFileContent(content);
      } catch {
        pushLine("stderr", `Cannot read ${path}`);
      }
    },
    [pushLine],
  );

  const saveFile = useCallback(
    (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
    },
    [refreshFiles, pushLine],
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    isRunning,
    testResults,
    runTests,
    runCommand,
    selectFile,
    saveFile,
    clearTerminal,
  };
}
