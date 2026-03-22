import type { Container } from "@run0/jiki";

export interface Task {
  description: string;
  check: (c: Container) => Promise<boolean>;
}

export interface Lesson {
  id: number;
  title: string;
  shortTitle: string;
  instructions: string;
  starterFiles: Record<string, string>;
  tasks: Task[];
}

export const LESSONS: Lesson[] = [
  // Lesson 1: Filesystem Basics
  {
    id: 1,
    title: "Filesystem Basics",
    shortTitle: "FS",
    instructions: [
      "Welcome to jiki! Let's start by learning the virtual filesystem.",
      "",
      "**Your tasks:**",
      "1. Create a `/projects` directory using `mkdir -p /projects`",
      "2. Create a file `/projects/hello.txt` containing exactly: `Hello, jiki!`",
      "   Hint: `echo \"Hello, jiki!\" > /projects/hello.txt`",
      "3. Verify your file with `cat /projects/hello.txt`",
      "",
      "When you're done, click **Validate** to check your work.",
    ].join("\n"),
    starterFiles: {
      "/README.md": "# Lesson 1: Filesystem Basics\nUse the terminal to create files and directories.\n",
    },
    tasks: [
      {
        description: "/projects directory exists",
        check: async (c) => c.exists("/projects"),
      },
      {
        description: '/projects/hello.txt contains "Hello, jiki!"',
        check: async (c) => {
          try {
            const content = c.readFile("/projects/hello.txt").trim();
            return content === "Hello, jiki!";
          } catch { return false; }
        },
      },
    ],
  },

  // Lesson 2: Modules & Require
  {
    id: 2,
    title: "Modules & Require",
    shortTitle: "Mod",
    instructions: [
      "Node.js uses CommonJS modules. Let's create and use one!",
      "",
      "**Your tasks:**",
      "1. Edit `src/greet.js` to export a `greet(name)` function that returns `\"Hello, <name>!\"`",
      "2. Edit `src/main.js` to require `./greet` and log `greet('World')`",
      "3. Run `node src/main.js` — it should print `Hello, World!`",
      "",
      "Click **Validate** when done.",
    ].join("\n"),
    starterFiles: {
      "/src/greet.js": "// Export a greet(name) function\n// It should return \"Hello, <name>!\"\n\n",
      "/src/main.js": "// Require ./greet and call greet('World')\n// Log the result with console.log\n\n",
    },
    tasks: [
      {
        description: "src/greet.js exports a greet function",
        check: async (c) => {
          try {
            const result = c.execute(
              "const g = require('/src/greet'); module.exports = (typeof g.greet === 'function' || typeof g === 'function');"
            );
            return result.exports === true;
          } catch { return false; }
        },
      },
      {
        description: 'node src/main.js prints "Hello, World!"',
        check: async (c) => {
          try {
            const result = await c.run("node src/main.js");
            return result.stdout.trim().includes("Hello, World!");
          } catch { return false; }
        },
      },
    ],
  },

  // Lesson 3: NPM Packages
  {
    id: 3,
    title: "NPM Packages",
    shortTitle: "Npm",
    instructions: [
      "jiki can install real npm packages in the browser!",
      "",
      "**Your tasks:**",
      "1. Run `npm install lodash` in the terminal",
      "2. Edit `app.js` to require lodash and use `_.capitalize('hello world')`",
      "3. Log the result — it should print `Hello world`",
      "",
      "Click **Validate** when done.",
    ].join("\n"),
    starterFiles: {
      "/package.json": JSON.stringify({ name: "lesson-3", version: "1.0.0", dependencies: {} }, null, 2),
      "/app.js": "// Run: npm install lodash\n// Then require lodash and use _.capitalize('hello world')\n\n",
    },
    tasks: [
      {
        description: "lodash is installed",
        check: async (c) => c.exists("/node_modules/lodash"),
      },
      {
        description: 'app.js uses lodash and prints "Hello world"',
        check: async (c) => {
          try {
            const result = await c.run("node app.js");
            return result.stdout.trim().includes("Hello world");
          } catch { return false; }
        },
      },
    ],
  },

  // Lesson 4: Shell Scripting
  {
    id: 4,
    title: "Shell Scripting",
    shortTitle: "Sh",
    instructions: [
      "jiki's shell supports pipes, chains, and redirects.",
      "",
      "**Your tasks:**",
      "1. Use a pipe to find ERROR lines: `cat data/logs.txt | grep ERROR`",
      "2. Chain commands: `mkdir -p results && echo \"done\"`",
      "3. Redirect the error lines to a file: `cat data/logs.txt | grep ERROR > results/errors.txt`",
      "",
      "Click **Validate** when done.",
    ].join("\n"),
    starterFiles: {
      "/data/logs.txt": [
        "[INFO] Server started",
        "[ERROR] Connection refused",
        "[INFO] Request handled",
        "[ERROR] Timeout exceeded",
        "[INFO] Shutdown complete",
      ].join("\n") + "\n",
    },
    tasks: [
      {
        description: "results directory exists",
        check: async (c) => c.exists("/results"),
      },
      {
        description: "results/errors.txt contains only ERROR lines",
        check: async (c) => {
          try {
            const content = c.readFile("/results/errors.txt").trim();
            const lines = content.split("\n").filter(Boolean);
            return lines.length === 2 && lines.every((l) => l.includes("ERROR"));
          } catch { return false; }
        },
      },
    ],
  },

  // Lesson 5: Streams & Transforms
  {
    id: 5,
    title: "Streams & Transforms",
    shortTitle: "Str",
    instructions: [
      "Node.js streams let you process data piece by piece.",
      "",
      "**Your tasks:**",
      "1. Edit `transform.js` to:",
      "   - Read `input.txt` using `fs.createReadStream`",
      "   - Pipe through a Transform that uppercases the text",
      "   - Write to `output.txt` using `fs.createWriteStream`",
      "2. Run `node transform.js`",
      "3. Verify `output.txt` contains the uppercased text",
      "",
      "**Hint:** Use `new Transform({ transform(chunk, enc, cb) { ... } })`",
      "",
      "Click **Validate** when done.",
    ].join("\n"),
    starterFiles: {
      "/input.txt": "hello from jiki streams\nthis text should be uppercased\n",
      "/transform.js": `const fs = require('fs');
const { Transform } = require('stream');

// Create a transform that uppercases text
const upper = new Transform({
  transform(chunk, encoding, callback) {
    // TODO: push the uppercased chunk
    callback();
  }
});

// TODO: pipe input.txt -> upper -> output.txt
`,
    },
    tasks: [
      {
        description: "transform.js runs without errors",
        check: async (c) => {
          try {
            const result = await c.run("node transform.js");
            return result.exitCode === 0;
          } catch { return false; }
        },
      },
      {
        description: "output.txt contains uppercased text",
        check: async (c) => {
          try {
            const content = c.readFile("/output.txt").trim();
            return content.includes("HELLO FROM JIKI STREAMS");
          } catch { return false; }
        },
      },
    ],
  },

  // Lesson 6: Crypto
  {
    id: 6,
    title: "Crypto",
    shortTitle: "Cry",
    instructions: [
      "jiki provides crypto APIs: hashing, HMAC, and random generation.",
      "",
      "**Your tasks:**",
      "Edit `crypto-tasks.js` to:",
      "1. Hash the contents of `secret.txt` with SHA-256 and log the hex digest",
      "2. Generate and log a random UUID using `crypto.randomUUID()`",
      "3. Create an HMAC-SHA256 signature of `\"authenticate me\"` with key `\"secret-key\"` and log the hex digest",
      "",
      "Then run `node crypto-tasks.js`.",
      "",
      "Click **Validate** when done.",
    ].join("\n"),
    starterFiles: {
      "/secret.txt": "Top secret data!\n",
      "/crypto-tasks.js": `const crypto = require('crypto');
const fs = require('fs');

// Task 1: Hash secret.txt with SHA-256
// const hash = ...
// console.log('SHA-256:', hash);

// Task 2: Generate a UUID
// const uuid = ...
// console.log('UUID:', uuid);

// Task 3: HMAC-SHA256 of "authenticate me" with key "secret-key"
// const hmac = ...
// console.log('HMAC:', hmac);
`,
    },
    tasks: [
      {
        description: "Output contains a valid SHA-256 hash (64 hex chars)",
        check: async (c) => {
          try {
            const result = await c.run("node crypto-tasks.js");
            return /[a-f0-9]{64}/i.test(result.stdout);
          } catch { return false; }
        },
      },
      {
        description: "Output contains a valid UUID",
        check: async (c) => {
          try {
            const result = await c.run("node crypto-tasks.js");
            return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(result.stdout);
          } catch { return false; }
        },
      },
      {
        description: "Output contains an HMAC signature",
        check: async (c) => {
          try {
            const result = await c.run("node crypto-tasks.js");
            // HMAC output should have "HMAC:" followed by hex
            return /HMAC:\s*[a-f0-9]{64}/i.test(result.stdout);
          } catch { return false; }
        },
      },
    ],
  },

  // Lesson 7: Bundling with esbuild
  {
    id: 7,
    title: "Bundling with esbuild",
    shortTitle: "Bun",
    instructions: [
      "esbuild can bundle and transpile TypeScript in the browser!",
      "",
      "**Your tasks:**",
      "1. Review the existing `src/index.ts` and `src/math.ts` files",
      "2. Run: `esbuild src/index.ts --bundle --format=esm --outfile=dist/bundle.js`",
      "3. Run: `node dist/bundle.js` to verify the bundle works",
      "",
      "The bundle should combine both files into one and produce the correct output.",
      "",
      "Click **Validate** when done.",
    ].join("\n"),
    starterFiles: {
      "/src/index.ts": `import { add, multiply } from './math';

console.log('2 + 3 =', add(2, 3));
console.log('4 * 5 =', multiply(4, 5));
console.log('Sum:', add(add(1, 2), add(3, 4)));
`,
      "/src/math.ts": `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`,
    },
    tasks: [
      {
        description: "dist/bundle.js exists",
        check: async (c) => c.exists("/dist/bundle.js"),
      },
      {
        description: "Bundle runs correctly",
        check: async (c) => {
          try {
            const result = await c.run("node dist/bundle.js");
            return result.stdout.includes("2 + 3 = 5") && result.stdout.includes("4 * 5 = 20");
          } catch { return false; }
        },
      },
    ],
  },
];
