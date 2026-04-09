import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

import type { TerminalLine } from '@run0/jiki-ui';
export type { TerminalLine };

const DEFAULT_PACKAGE_JSON = JSON.stringify(
  {
    name: "pnpm-scripts-demo",
    version: "1.0.0",
    scripts: {
      start: "node index.js",
    },
    dependencies: {
      lodash: "*",
      "date-fns": "*",
    },
  },
  null,
  2
);

const DEFAULT_SCRIPT = `const _ = require('lodash');
const { format, addDays, subYears, differenceInDays } = require('date-fns');

// lodash: work with collections
const users = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
  { name: 'Carol', age: 35, active: true },
  { name: 'Dave', age: 28, active: true },
];

const activeNames = _.chain(users)
  .filter('active')
  .sortBy('age')
  .map('name')
  .value();

console.log('Active users (sorted by age):', activeNames.join(', '));
console.log('Average age:', _.meanBy(users, 'age'));
console.log('Grouped by status:', JSON.stringify(_.groupBy(users, 'active')));

// date-fns: date formatting & arithmetic
const now = new Date();
const nextWeek = addDays(now, 7);
const lastYear = subYears(now, 1);

console.log('');
console.log('Today:', format(now, 'PPPP'));
console.log('Next week:', format(nextWeek, 'PPP'));
console.log('One year ago:', format(lastYear, 'PPP'));
console.log('Days until next week:', differenceInDays(nextWeek, now));
`;

let lineId = 0;

export function useContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [packageJson, setPackageJson] = useState(DEFAULT_PACKAGE_JSON);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isBooted, setIsBooted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  const bootContainer = useCallback(async () => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      packageManager: "pnpm",
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    pushLine("info", "Initializing runtime...");
    await c.init();

    c.writeFile("/package.json", DEFAULT_PACKAGE_JSON);
    c.writeFile("/index.js", DEFAULT_SCRIPT);

    pushLine("info", "Installing dependencies (lodash, date-fns)...");
    try {
      await c.installDependencies({
        concurrency: 12,
        onProgress: (msg) => pushLine("info", msg),
      });
      pushLine("success", "Dependencies installed.");
    } catch (err) {
      pushLine("stderr", `Install failed: ${err}`);
    }

    setIsBooted(true);
    pushLine("info", 'Ready. Click "Run Script" or use the terminal.');
  }, [pushLine]);

  const syncFiles = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    c.writeFile("/package.json", packageJson);
    c.writeFile("/index.js", script);
  }, [packageJson, script]);

  const runScript = useCallback(async () => {
    const c = containerRef.current;
    if (!c || isRunning) return;
    setIsRunning(true);
    syncFiles();
    pushLine("command", "$ pnpm run start");
    try {
      const result = await c.run("pnpm run start");
      if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
      if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
      if (result.exitCode !== 0) {
        pushLine("info", `Process exited with code ${result.exitCode}`);
      }
    } catch (err) {
      pushLine("stderr", String(err));
    }
    setIsRunning(false);
  }, [isRunning, syncFiles, pushLine]);

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      syncFiles();
      pushLine("command", `$ ${cmd}`);
      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
        if (result.exitCode !== 0) {
          pushLine("info", `Process exited with code ${result.exitCode}`);
        }
      } catch (err) {
        pushLine("stderr", String(err));
      }
    },
    [syncFiles, pushLine]
  );

  const installPackage = useCallback(
    async (pkg: string) => {
      const c = containerRef.current;
      if (!c || !pkg.trim()) return;
      setIsRunning(true);
      pushLine("command", `$ pnpm add ${pkg}`);
      try {
        const result = await c.install(pkg.trim(), {
          save: true,
          concurrency: 12,
          onProgress: (msg) => pushLine("info", msg),
        });
        if (result.added.length > 0) {
          pushLine("success", `Installed: ${result.added.join(", ")}`);
        } else {
          pushLine("info", "All packages already installed.");
        }
        const updatedPkg = c.readFile("/package.json");
        setPackageJson(updatedPkg);
      } catch (err) {
        pushLine("stderr", String(err));
      }
      setIsRunning(false);
    },
    [pushLine]
  );

  useEffect(() => {
    bootContainer();
  }, [bootContainer]);

  return {
    terminal,
    packageJson,
    script,
    isBooted,
    isRunning,
    setPackageJson,
    setScript,
    runScript,
    runCommand,
    installPackage,
    clearTerminal,
  };
}
