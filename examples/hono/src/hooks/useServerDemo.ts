import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";
import type { TerminalLine } from 'jiki-ui';
import type { ApiResponse } from "../components/ApiExplorer";

const SERVER_CODE = `const { Hono } = require('hono');
const app = new Hono();

const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
];

// -- Middleware: Logger --
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log('--> ' + c.req.method + ' ' + c.req.path);
  await next();
  const ms = Date.now() - start;
  c.header('X-Response-Time', ms + 'ms');
  console.log('<-- ' + c.req.method + ' ' + c.req.path + ' ' + c.res.status + ' ' + ms + 'ms');
});

// -- Middleware: CORS --
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
});

// -- Middleware: Request ID --
app.use('*', async (c, next) => {
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(ch) {
    var r = Math.random() * 16 | 0;
    return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  c.set('requestId', id);
  await next();
  c.header('X-Request-Id', id);
});

// -- Routes --
app.get('/', (c) => {
  return c.json({
    name: 'Hono API',
    version: '1.0.0',
    middleware: ['logger', 'cors', 'request-id'],
    endpoints: ['/api/users', '/api/time', '/api/random'],
  });
});

app.get('/api/users', (c) => {
  return c.json(users);
});

app.get('/api/users/:id', (c) => {
  const id = Number(c.req.param('id'));
  const user = users.find(u => u.id === id);
  if (user) return c.json(user);
  return c.json({ error: 'User not found' }, 404);
});

app.get('/api/time', (c) => {
  return c.json({
    timestamp: Date.now(),
    iso: new Date().toISOString(),
    readable: new Date().toLocaleString(),
    requestId: c.get('requestId'),
  });
});

app.get('/api/random', (c) => {
  return c.json({
    number: Math.random(),
    dice: Math.floor(Math.random() * 6) + 1,
    uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(ch) {
      var r = Math.random() * 16 | 0;
      return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
    requestId: c.get('requestId'),
  });
});

globalThis.__app = app;
console.log('Hono server ready (3 middleware active)');
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
var app = globalThis.__app;
if (!app) {
  console.log('__API_RESPONSE__' + JSON.stringify({ status: 500, body: '{"error":"App not started"}' }));
} else {
  var request = new Request('http://localhost${path}', {
    method: '${method}',
    headers: { 'Accept': 'application/json' }
  });
  app.fetch(request).then(function(response) {
    return response.text().then(function(body) {
      console.log('__API_RESPONSE__' + JSON.stringify({ status: response.status, body: body }));
    });
  }).catch(function(err) {
    console.log('__API_RESPONSE__' + JSON.stringify({ status: 500, body: JSON.stringify({ error: String(err) }) }));
  });
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
        }, 5000);
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
      addLine("command", "$ npm install hono");

      try {
        const result = await c.install("hono", {
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
