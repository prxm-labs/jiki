import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";

import type { TerminalLine } from '@run0/jiki-ui';
export type { TerminalLine };

export interface CryptoResult {
  id: number;
  type: "hash" | "hmac" | "random" | "integrity";
  label: string;
  details: Record<string, string>;
}

const DEMO_FILES: Record<string, string> = {
  "/package.json": JSON.stringify(
    { name: "crypto-demo", version: "1.0.0", scripts: {}, dependencies: {} },
    null,
    2
  ),

  "/hash-demo.js": `const crypto = require('crypto');

// SHA-256 hash
const sha256 = crypto.createHash('sha256').update('Hello, jiki!').digest('hex');
console.log('__RESULT__' + JSON.stringify({
  type: 'hash', label: 'SHA-256 Hash',
  details: { Algorithm: 'SHA-256', Input: 'Hello, jiki!', 'Hex Digest': sha256 }
}));

// MD5 hash
const md5 = crypto.createHash('md5').update('Hello, jiki!').digest('hex');
console.log('__RESULT__' + JSON.stringify({
  type: 'hash', label: 'MD5 Hash',
  details: { Algorithm: 'MD5', Input: 'Hello, jiki!', 'Hex Digest': md5 }
}));
`,

  "/hmac-demo.js": `const crypto = require('crypto');

const secret = 'my-secret-key';
const message = 'Important data to authenticate';

// Create HMAC
const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
console.log('__RESULT__' + JSON.stringify({
  type: 'hmac', label: 'HMAC-SHA256',
  details: { Algorithm: 'HMAC-SHA256', Key: secret, Message: message, Signature: hmac }
}));

// Verify: same input produces same HMAC
const verify = crypto.createHmac('sha256', secret).update(message).digest('hex');
const isValid = hmac === verify;
console.log('__RESULT__' + JSON.stringify({
  type: 'hmac', label: 'HMAC Verification',
  details: { 'Original': hmac.slice(0, 16) + '...', 'Recomputed': verify.slice(0, 16) + '...', Match: String(isValid) }
}));
`,

  "/random-demo.js": `const crypto = require('crypto');

// Random UUID
const uuid = crypto.randomUUID();
console.log('__RESULT__' + JSON.stringify({
  type: 'random', label: 'Random UUID',
  details: { UUID: uuid }
}));

// Random bytes
const bytes = crypto.randomBytes(16);
const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
console.log('__RESULT__' + JSON.stringify({
  type: 'random', label: 'Random Bytes (16)',
  details: { 'Hex': hex, 'Length': bytes.length + ' bytes' }
}));

// Random integer
const randInt = crypto.randomInt(1, 100);
console.log('__RESULT__' + JSON.stringify({
  type: 'random', label: 'Random Integer',
  details: { Range: '1-100', Value: String(randInt) }
}));
`,

  "/file-integrity.js": `const crypto = require('crypto');
const fs = require('fs');

// Write a sample file
fs.writeFileSync('/tmp/data.txt', 'Original content');
const hash1 = crypto.createHash('sha256').update(fs.readFileSync('/tmp/data.txt', 'utf8')).digest('hex');

console.log('__RESULT__' + JSON.stringify({
  type: 'integrity', label: 'Original File Hash',
  details: { File: '/tmp/data.txt', Content: 'Original content', 'SHA-256': hash1 }
}));

// Modify the file
fs.writeFileSync('/tmp/data.txt', 'Modified content');
const hash2 = crypto.createHash('sha256').update(fs.readFileSync('/tmp/data.txt', 'utf8')).digest('hex');

const changed = hash1 !== hash2;
console.log('__RESULT__' + JSON.stringify({
  type: 'integrity', label: 'Modified File Hash',
  details: { File: '/tmp/data.txt', Content: 'Modified content', 'SHA-256': hash2, 'Changed': String(changed) }
}));
`,
};

let lineId = 0;
let resultId = 0;

export function useCryptoContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [results, setResults] = useState<CryptoResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const addResult = useCallback((data: Omit<CryptoResult, "id">) => {
    setResults((prev) => [...prev, { ...data, id: ++resultId }]);
  }, []);

  const bootContainer = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: false,
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        if (text.startsWith("__RESULT__")) {
          try {
            const data = JSON.parse(text.slice("__RESULT__".length));
            addResult(data);
          } catch { /* ignore parse errors */ }
          return;
        }
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(DEMO_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Crypto Toolkit ready. Try: node hash-demo.js");
    setSelectedFile("/hash-demo.js");
    setFileContent(DEMO_FILES["/hash-demo.js"]);
  }, [pushLine, addResult]);

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
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
    [pushLine]
  );

  const runAll = useCallback(async () => {
    setResults([]);
    setIsRunningAll(true);
    const demos = ["hash-demo.js", "hmac-demo.js", "random-demo.js", "file-integrity.js"];
    for (const demo of demos) {
      await runCommand(`node ${demo}`);
    }
    setIsRunningAll(false);
  }, [runCommand]);

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
      pushLine("info", `Saved ${path}`);
    },
    [pushLine]
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
    results,
    selectedFile,
    fileContent,
    isBooted,
    isRunningAll,
    runCommand,
    runAll,
    selectFile,
    saveFile,
    clearTerminal,
  };
}
