import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "@run0/jiki";
import type { TerminalLine } from '@run0/jiki-ui';
import type { ApiResponse } from "../components/ApiExplorer";

const SERVER_CODE = `const express = require("express");
const app = express();
app.use(express.json());

const users = [
	{
		id: 1,
		name: "Alice Johnson",
		email: "alice@example.com",
		role: "admin"
	},
	{
		id: 2,
		name: "Bob Smith",
		email: "bob@example.com",
		role: "user"
	},
	{
		id: 3,
		name: "Charlie Brown",
		email: "charlie@example.com",
		role: "user"
	}
];

app.get("/", (req, res) => {
	res.json({
		name: "Express API",
		version: "1.0.0",
		endpoints: [
			"/api/users",
			"/api/time",
			"/api/random"
		]
	});
});

app.get("/api/users", (req, res) => {
	console.log("GET /api/users");
	res.json(users);
});

app.get("/api/users/:id", (req, res) => {
	console.log("GET /api/users/" + req.params.id);
	const user = users.find((u) => u.id === Number(req.params.id));
	if (user) res.json(user);
	else res.status(404).json({ error: "User not found" });
});

app.get("/api/time", (req, res) => {
	console.log("GET /api/time");
	res.json({
		timestamp: Date.now(),
		iso: new Date().toISOString(),
		readable: new Date().toLocaleString()
	});
});

app.get("/api/random", (req, res) => {
	console.log("GET /api/random");
	res.json({
		number: Math.random(),
		dice: Math.floor(Math.random() * 6) + 1,
		uuid: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = Math.random() * 16 | 0;
			return (c === "x" ? r : r & 3 | 8).toString(16);
		})
	});
});
const server = app.listen(3e3, () => {
	console.log("Express server running on port 3000");
});
globalThis.__server = server;
module.exports = app;
`;

let lineCounter = 0;

export function useServerDemo() {
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [serverStatus, setServerStatus] = useState<
    "idle" | "installing" | "running" | "error"
  >("idle");
  const [isBooted, setIsBooted] = useState(false);
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const apiResolverRef = useRef<
    ((data: { status: number; body: string }) => void) | null
  >(null);

  const addLine = useCallback((type: TerminalLine["type"], text: string) => {
    setTerminal((prev) => [...prev, { id: ++lineCounter, type, text }]);
  }, []);

  const clearTerminal = useCallback(() => setTerminal([]), []);

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      addLine("command", `$ ${cmd}`);
      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) addLine("stdout", result.stdout.trim());
        if (result.stderr.trim()) addLine("stderr", result.stderr.trim());
      } catch (e) {
        addLine("stderr", String(e));
      }
    },
    [addLine]
  );

  const testRoute = useCallback(
    async (method: string, path: string): Promise<ApiResponse | null> => {
      const c = containerRef.current;
      if (!c) return null;

      const start = performance.now();
      return new Promise<ApiResponse | null>((resolve) => {
        let resolved = false;

        apiResolverRef.current = (data) => {
          if (resolved) return;
          resolved = true;
          apiResolverRef.current = null;
          resolve({
            status: data.status,
            body: data.body,
            time: Math.round(performance.now() - start),
          });
        };

        const testCode = `
var http = require('http');
var server = globalThis.__server;
if (!server) {
  console.log('__API_RESPONSE__' + JSON.stringify({ status: 500, body: '{"error":"Server not started"}' }));
} else {
  var req = new http.IncomingMessage({ method: '${method}', url: '${path}', headers: { accept: 'application/json' } });
  var res = new http.ServerResponse();
  var done = false;
  res.on('finish', function() {
    if (!done) { done = true; console.log('__API_RESPONSE__' + JSON.stringify({ status: res.statusCode, body: res.getBodyString() })); }
  });
  server.handleRequest(req, res);
  if (!done && res.finished) {
    done = true;
    console.log('__API_RESPONSE__' + JSON.stringify({ status: res.statusCode, body: res.getBodyString() }));
  }
}`;

        try {
          c.execute(testCode, "/__test_route.js");
        } catch (e) {
          if (!resolved) {
            resolved = true;
            apiResolverRef.current = null;
            resolve({
              status: 500,
              body: JSON.stringify({ error: String(e) }),
              time: Math.round(performance.now() - start),
            });
          }
        }

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            apiResolverRef.current = null;
            resolve({
              status: 0,
              body: JSON.stringify({ error: "Timeout" }),
              time: Math.round(performance.now() - start),
            });
          }
        }, 3000);
      });
    },
    []
  );

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const init = async () => {
      addLine("info", "Booting jiki...");

      const c = boot({
        autoInstall: true,
        onConsole: (_method: string, args: unknown[]) => {
          const msg = args.map(String).join(" ");
          if (msg.startsWith("__API_RESPONSE__")) {
            try {
              const data = JSON.parse(msg.slice("__API_RESPONSE__".length));
              apiResolverRef.current?.(data);
            } catch {
              /* ignore parse errors */
            }
            return;
          }
          addLine("stdout", msg);
        },
      });
      containerRef.current = c;

      setServerStatus("installing");
      addLine("command", "$ npm install express");

      try {
        const result = await c.install("express", {
          concurrency: 12,
          onProgress: (msg: string) => addLine("stdout", msg),
        });
        addLine("stdout", `added ${result.added.length} packages`);
      } catch (e) {
        addLine("stderr", `Install failed: ${e}`);
        setServerStatus("error");
        return;
      }

      c.writeFile(
        "/package.json",
        JSON.stringify({ name: "app", version: "1.0.0" })
      );
      c.writeFile("/server.js", SERVER_CODE);
      addLine("info", "Server files written");

      addLine("command", "$ node server.js");
      try {
        c.runFile("/server.js");
        setServerStatus("running");
      } catch (e) {
        addLine("stderr", `Server error: ${e}`);
        setServerStatus("error");
      }

      setIsBooted(true);
    };

    init();
  }, [addLine]);

  return {
    terminal,
    serverStatus,
    serverCode: SERVER_CODE,
    isBooted,
    testRoute,
    runCommand,
    clearTerminal,
  };
}
