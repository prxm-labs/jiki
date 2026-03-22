import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  type Container,
  preprocessImports,
  initTranspiler,
  transpile,
  errorOverlayScript,
} from "@run0/jiki";

import type { TerminalLine } from '@run0/jiki-ui';
export type { TerminalLine };

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error Overlay App</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  </style>
  <!-- COMPONENTS_PLACEHOLDER -->
</head>
<body>
  <div id="root"></div>
  <!-- BOOTSTRAP_PLACEHOLDER -->
</body>
</html>`,

  "/src/App.jsx": `function App() {
  const [count, setCount] = React.useState(0);

  function handleThrowError() {
    setTimeout(function() {
      throw new Error("Button click error: something went wrong in the event handler!");
    }, 0);
  }

  function handleTypeError() {
    setTimeout(function() {
      throw new TypeError("Cannot read properties of undefined (reading 'foo')");
    }, 0);
  }

  function handlePromiseRejection() {
    Promise.reject(new RangeError("Promise rejected: value out of acceptable range"));
  }

  function handleReferenceError() {
    setTimeout(function() {
      undeclaredVariable.doSomething();
    }, 0);
  }

  function handleSyntaxLikeError() {
    setTimeout(function() {
      throw new SyntaxError("Unexpected token '<' in JSON at position 0");
    }, 0);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Error Overlay Demo</h1>
          <p className="text-gray-500 text-sm">Click the buttons below to trigger different types of errors</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-700 font-medium">Counter</span>
            <span className="text-2xl font-bold text-violet-600">{count}</span>
          </div>
          <button
            onClick={() => setCount(c => c + 1)}
            className="w-full py-2.5 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors"
          >
            Increment
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleThrowError}
            className="w-full py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Throw Error
          </button>
          <button
            onClick={handleTypeError}
            className="w-full py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors text-sm"
          >
            Type Error
          </button>
          <button
            onClick={handlePromiseRejection}
            className="w-full py-2.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors text-sm"
          >
            Unhandled Promise Rejection
          </button>
          <button
            onClick={handleReferenceError}
            className="w-full py-2.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors text-sm"
          >
            Reference Error
          </button>
          <button
            onClick={handleSyntaxLikeError}
            className="w-full py-2.5 bg-pink-600 text-white font-semibold rounded-lg hover:bg-pink-700 transition-colors text-sm"
          >
            Syntax Error
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Errors appear in the overlay at the bottom-right corner
        </p>
      </div>
    </div>
  );
}`,
};

const JSX_OPTIONS = {
  jsx: "transform" as const,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
};

async function assembleHtml(container: Container): Promise<string> {
  let html: string;
  try {
    html = container.readFile("/index.html");
  } catch {
    return "<html><body><p>Error: /index.html not found</p></body></html>";
  }

  const componentPaths = ["/src/App.jsx"];
  const scripts: string[] = [];

  for (const p of componentPaths) {
    try {
      const code = container.readFile(p);
      const processed = preprocessImports(code);
      const transpiled = await transpile(processed, p, JSX_OPTIONS);
      scripts.push(`<script>\n${transpiled}\n<\/script>`);
    } catch (err) {
      scripts.push(
        `<script>console.error(${JSON.stringify(`[build] ${String(err)}`)});<\/script>`
      );
    }
  }

  const overlay = errorOverlayScript();

  const bootstrap = `<script>
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
<\/script>`;

  html = html.replace(
    "<!-- COMPONENTS_PLACEHOLDER -->",
    overlay + "\n" + scripts.join("\n")
  );
  html = html.replace("<!-- BOOTSTRAP_PLACEHOLDER -->", bootstrap);
  return html;
}

let lineId = 0;

export function useErrorOverlayContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);

  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [isBooted, setIsBooted] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const rebuildPreview = useCallback(async () => {
    const c = containerRef.current;
    if (!c) return;
    try {
      const html = await assembleHtml(c);
      setHtmlSrc(html);
    } catch (err) {
      console.error("[rebuildPreview]", err);
      setHtmlSrc(
        `<html><body><pre style="color:red;padding:1em">${String(err)}</pre></body></html>`
      );
    }
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      pushLine("info", "Booting container...");
      try {
        await initTranspiler();
      } catch (err) {
        pushLine("stderr", `Failed to initialize transpiler: ${err}`);
        return;
      }

      const c = boot({
        cwd: "/",
        onConsole: (_method: string, args: unknown[]) => {
          const text = args
            .map((a: unknown) =>
              typeof a === "string" ? a : JSON.stringify(a)
            )
            .join(" ");
          pushLine("stdout", text);
        },
      });
      containerRef.current = c;

      for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
        c.writeFile(path, content);
      }

      setIsBooted(true);
      pushLine("info", "Container booted. Error overlay demo loaded.");
      pushLine("info", "Click error buttons in the preview to trigger errors.");

      setSelectedFile("/src/App.jsx");
      setFileContent(VIRTUAL_FILES["/src/App.jsx"]);

      const html = await assembleHtml(c);
      setHtmlSrc(html);
    })();
  }, [pushLine]);

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
    async (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      pushLine("info", `Saved ${path}`);
      await rebuildPreview();
    },
    [pushLine, rebuildPreview]
  );

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      pushLine("command", `$ ${cmd}`);
      try {
        const result: { stdout: string; stderr: string; exitCode: number } =
          await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
        if (result.exitCode !== 0)
          pushLine("info", `Exit code ${result.exitCode}`);
      } catch (err) {
        pushLine("stderr", String(err));
      }
    },
    [pushLine]
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  const refresh = useCallback(async () => {
    await rebuildPreview();
  }, [rebuildPreview]);

  return {
    terminal,
    isBooted,
    htmlSrc,
    selectedFile,
    fileContent,
    selectFile,
    saveFile,
    runCommand,
    clearTerminal,
    refresh,
  };
}
