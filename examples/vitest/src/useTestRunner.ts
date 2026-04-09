import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

import type { TerminalLine, FileEntry } from '@run0/jiki-ui';
export type { TerminalLine, FileEntry };


export interface TestResult {
  name: string;
  suite: string;
  status: "pass" | "fail";
  error?: string;
}

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "vitest-demo",
      version: "1.0.0",
      scripts: { test: "node run-tests.js" },
      dependencies: {},
    },
    null,
    2
  ),

  "/src/math.js": `function sum(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

module.exports = { sum, multiply, factorial };
`,

  "/src/string-utils.js": `function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function reverse(str) {
  return str.split('').reverse().join('');
}

function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}

module.exports = { capitalize, reverse, isPalindrome };
`,

  "/src/math.test.js": `const { describe, test, expect } = require('./test-framework');
const { sum, multiply, factorial } = require('./math');

describe('sum', () => {
  test('adds two positive numbers', () => {
    expect(sum(1, 2)).toBe(3);
  });

  test('adds negative numbers', () => {
    expect(sum(-1, -2)).toBe(-3);
  });

  test('adds zero', () => {
    expect(sum(5, 0)).toBe(5);
  });
});

describe('multiply', () => {
  test('multiplies two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
  });

  test('multiplies by zero', () => {
    expect(multiply(7, 0)).toBe(0);
  });
});

describe('factorial', () => {
  test('factorial of 0 is 1', () => {
    expect(factorial(0)).toBe(1);
  });

  test('factorial of 5 is 120', () => {
    expect(factorial(5)).toBe(120);
  });
});
`,

  "/src/string-utils.test.js": `const { describe, test, expect } = require('./test-framework');
const { capitalize, reverse, isPalindrome } = require('./string-utils');

describe('capitalize', () => {
  test('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  test('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  test('handles already capitalized', () => {
    expect(capitalize('World')).toBe('World');
  });
});

describe('reverse', () => {
  test('reverses a string', () => {
    expect(reverse('abc')).toBe('cba');
  });

  test('reverses a single character', () => {
    expect(reverse('x')).toBe('x');
  });
});

describe('isPalindrome', () => {
  test('detects palindrome', () => {
    expect(isPalindrome('racecar')).toBe(true);
  });

  test('detects non-palindrome', () => {
    expect(isPalindrome('hello')).toBe(false);
  });

  test('ignores case and spaces', () => {
    expect(isPalindrome('A man a plan a canal Panama')).toBe(true);
  });
});
`,

  "/src/test-framework.js": `const suites = [];
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
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error('Expected truthy but got ' + JSON.stringify(actual));
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error('Expected falsy but got ' + JSON.stringify(actual));
      }
    },
  };
}

function runAll() {
  let passed = 0;
  let failed = 0;
  const results = [];

  for (const suite of suites) {
    console.log('\\n  ' + suite.name);
    for (const t of suite.tests) {
      try {
        t.fn();
        passed++;
        console.log('    \\u2713 ' + t.name);
        results.push({ suite: suite.name, name: t.name, status: 'pass' });
      } catch (err) {
        failed++;
        console.log('    \\u2717 ' + t.name);
        console.log('      ' + err.message);
        results.push({ suite: suite.name, name: t.name, status: 'fail', error: err.message });
      }
    }
  }

  console.log('\\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  if (failed > 0) {
    console.log('  Status: FAIL');
  } else {
    console.log('  Status: PASS');
  }

  suites.length = 0;
  return results;
}

module.exports = { describe, test, expect, runAll };
`,

  "/run-tests.js": `const path = require('path');
const fs = require('fs');

console.log('\\n  Running test suites...\\n');

const testFiles = [];
function findTests(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      findTests(full);
    } else if (entry.endsWith('.test.js')) {
      testFiles.push(full);
    }
  }
}

findTests('/src');

for (const file of testFiles) {
  console.log('  Test file: ' + path.basename(file));
  require(file);
}

const { runAll } = require('/src/test-framework');
const results = runAll();

const total = results.length;
const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;

console.log('\\n  \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500');
console.log('  Test Suites: ' + testFiles.length + ' total');
console.log('  Tests:       ' + passed + ' passed, ' + (failed > 0 ? failed + ' failed, ' : '') + total + ' total');
console.log('  \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\n');

process.exit(failed > 0 ? 1 : 0);
`,
};

let lineId = 0;

export function useTestRunner() {
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
            const fullPath =
              dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
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
        !trimmed.startsWith("Running")
      ) {
        currentSuite = suiteMatch[1];
      }

      if (trimmed.startsWith("\u2713 ")) {
        results.push({
          name: trimmed.slice(2),
          suite: currentSuite,
          status: "pass",
        });
      } else if (trimmed.startsWith("\u2717 ")) {
        results.push({
          name: trimmed.slice(2),
          suite: currentSuite,
          status: "fail",
        });
      }
    }

    return results;
  }, []);

  const bootContainer = useCallback(() => {
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
    pushLine("info", "Container booted. Test files written.");
    pushLine("info", 'Click "Run Tests" or type: npm test');
    refreshFiles();
    setSelectedFile("/src/math.test.js");
    setFileContent(VIRTUAL_FILES["/src/math.test.js"]);
  }, [pushLine, refreshFiles]);

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

        if (
          cmd.trim() === "npm test" ||
          cmd.trim().startsWith("node run-tests")
        ) {
          const combined = result.stdout + "\n" + result.stderr;
          const parsed = parseTestOutput(combined);
          setTestResults(parsed);
        }

        if (result.exitCode !== 0) {
          pushLine("info", `Process exited with code ${result.exitCode}`);
        }
      } catch (err) {
        pushLine("stderr", String(err));
      }
      refreshFiles();
    },
    [pushLine, refreshFiles, parseTestOutput]
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
    [pushLine]
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
    [refreshFiles, pushLine]
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  useEffect(() => {
    bootContainer();
  }, [bootContainer]);

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
    pushLine,
  };
}
