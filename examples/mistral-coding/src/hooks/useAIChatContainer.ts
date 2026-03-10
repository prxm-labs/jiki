import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  boot,
  type Container,
  preprocessImports,
  initTranspiler,
  transpile,
  errorOverlayScript,
} from "jiki";
import type { ChatMessage, FileEntry } from "jiki-ui";
import {
  saveMessage,
  loadRecentMessages,
  loadMessagesBefore,
  clearAllMessages,
  getLastAssistantCode,
} from "../lib/chat-persistence";
import { streamChatCompletion } from "../lib/mistral-stream";
import { extractAppCode } from "../lib/code-extractor";
import { getApiKey, clearApiKey } from "../components/ApiKeyModal";

// ---------------------------------------------------------------------------
// Virtual project files
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Generated App</title>
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
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Nav */}
      <nav className="border-b border-black/10">
        <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight">mistral.</span>
          <span className="text-xs text-black/30">AI Code Generator</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs font-medium uppercase tracking-widest text-black/40 mb-4">Codestral</p>
        <h1 className="text-5xl font-black leading-[1.1] tracking-tight mb-4">
          Prompt to code.<br/>Instantly.
        </h1>
        <p className="text-base text-black/50 leading-relaxed max-w-md mb-10">
          Describe a React component in the chat. Codestral generates the code and renders it live in the preview.
        </p>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-black text-white text-sm font-bold">Try it &rarr;</div>
          <div className="px-4 py-2 border-2 border-black text-sm font-bold">View source</div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-black/10">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-2xl font-black">4K</div>
              <div className="text-xs text-black/30 mt-1">Max tokens</div>
            </div>
            <div>
              <div className="text-2xl font-black">&lt;2s</div>
              <div className="text-xs text-black/30 mt-1">First token</div>
            </div>
            <div>
              <div className="text-2xl font-black">JSX</div>
              <div className="text-xs text-black/30 mt-1">Auto-extract</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-bold mb-1">Streaming</h3>
              <p className="text-xs text-black/40 leading-relaxed">Token-by-token code generation with live preview updates.</p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Inspect</h3>
              <p className="text-xs text-black/40 leading-relaxed">Click any element in the preview to reference it in chat.</p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Persist</h3>
              <p className="text-xs text-black/40 leading-relaxed">Chat history and generated code saved across sessions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/10 mt-8">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs font-bold tracking-tight">mistral.</span>
          <span className="text-xs text-black/30">Codestral &middot; jiki</span>
        </div>
      </footer>
    </div>
  );
}`,
};

const JSX_OPTIONS = {
  jsx: "transform" as const,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
};

// ---------------------------------------------------------------------------
// HTML assembly (same pattern as error-overlay)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let msgId = 0;
function nextId(): string {
  return `msg_${Date.now()}_${++msgId}`;
}

export function useAIChatContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const [isBooted, setIsBooted] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(true);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");

  // --- File tree ---
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

  // --- Rebuild preview ---
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

  // --- Check API key after mount (avoids SSR hydration mismatch) ---
  useEffect(() => {
    if (getApiKey()) {
      setNeedsApiKey(false);
    }
  }, []);

  // --- Boot sequence ---
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      try {
        await initTranspiler();
      } catch (err) {
        console.error("Failed to initialize transpiler:", err);
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
          console.log("[container]", text);
        },
      });
      containerRef.current = c;

      // Write initial virtual files
      for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
        c.writeFile(path, content);
      }

      // Restore last generated code from chat history
      try {
        const lastCode = await getLastAssistantCode();
        if (lastCode) {
          c.writeFile("/src/App.jsx", lastCode);
        }
      } catch {
        // Ignore persistence errors
      }

      // Load recent chat messages
      try {
        const recent = await loadRecentMessages(50);
        if (recent.length > 0) {
          setMessages(
            recent.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            }))
          );
          setHasMore(recent.length >= 50);
        }
      } catch {
        // Ignore persistence errors
      }

      setIsBooted(true);
      refreshFiles();
      setSelectedFile("/src/App.jsx");
      setFileContent(c.readFile("/src/App.jsx"));

      const html = await assembleHtml(c);
      setHtmlSrc(html);
    })();
  }, [refreshFiles]);

  // --- Send message ---
  const sendMessage = useCallback(
    async (content: string) => {
      const apiKey = getApiKey();
      if (!apiKey || isStreaming) return;

      const c = containerRef.current;
      if (!c) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      // Add empty assistant message for streaming
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      // Persist user message
      saveMessage({
        id: userMsg.id,
        role: userMsg.role,
        content: userMsg.content,
        timestamp: userMsg.timestamp,
      }).catch(() => {});

      // Build messages for API
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const abort = new AbortController();
      abortRef.current = abort;

      let fullText = "";

      await streamChatCompletion(
        apiKey,
        apiMessages,
        {
          onToken: (text) => {
            fullText += text;
            const currentText = fullText;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.id === assistantMsg.id) {
                updated[updated.length - 1] = {
                  ...last,
                  content: currentText,
                };
              }
              return updated;
            });
          },
          onComplete: async (finalText) => {
            // Finalize assistant message
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.id === assistantMsg.id) {
                updated[updated.length - 1] = {
                  ...last,
                  content: finalText,
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsStreaming(false);
            abortRef.current = null;

            // Persist assistant message
            saveMessage({
              id: assistantMsg.id,
              role: "assistant",
              content: finalText,
              timestamp: Date.now(),
            }).catch(() => {});

            // Extract code and update preview
            const code = extractAppCode(finalText);
            if (code && c) {
              c.writeFile("/src/App.jsx", code);
              refreshFiles();
              setSelectedFile("/src/App.jsx");
              setFileContent(code);
              try {
                const html = await assembleHtml(c);
                setHtmlSrc(html);
              } catch (err) {
                console.error("[rebuildPreview]", err);
              }
            }
          },
          onError: (error) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.id === assistantMsg.id) {
                updated[updated.length - 1] = {
                  ...last,
                  content: `Error: ${error.message}`,
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsStreaming(false);
            abortRef.current = null;
          },
        },
        abort.signal,
        c.readFile("/src/App.jsx"),
      );
    },
    [isStreaming, messages],
  );

  // --- Load more messages ---
  const loadMoreMessages = useCallback(async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    try {
      const older = await loadMessagesBefore(oldest.timestamp, 50);
      if (older.length > 0) {
        setMessages((prev) => [
          ...older.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
          })),
          ...prev,
        ]);
      }
      setHasMore(older.length >= 50);
    } catch {
      setHasMore(false);
    }
  }, [messages]);

  // --- Refresh preview ---
  const refresh = useCallback(async () => {
    await rebuildPreview();
  }, [rebuildPreview]);

  // --- Reset API key ---
  const resetApiKey = useCallback(() => {
    clearApiKey();
    setNeedsApiKey(true);
  }, []);

  // --- Set API key ---
  const handleApiKeySubmit = useCallback((key: string) => {
    void key;
    setNeedsApiKey(false);
  }, []);

  // --- Select file ---
  const selectFile = useCallback(
    (path: string) => {
      const c = containerRef.current;
      if (!c) return;
      try {
        const content = c.readFile(path);
        setSelectedFile(path);
        setFileContent(content);
      } catch {
        // Cannot read (likely a directory)
      }
    },
    [],
  );

  // --- Save file ---
  const saveFile = useCallback(
    async (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      await rebuildPreview();
    },
    [refreshFiles, rebuildPreview],
  );

  // --- Flat file paths for @ mention ---
  const filePaths = useMemo(() => {
    const paths: string[] = [];
    const collect = (entries: FileEntry[]) => {
      for (const entry of entries) {
        if (entry.isDir) {
          if (entry.children) collect(entry.children);
        } else {
          paths.push(entry.path);
        }
      }
    };
    collect(files);
    return paths;
  }, [files]);

  // --- Clear chat ---
  const clearChat = useCallback(async () => {
    setMessages([]);
    await clearAllMessages().catch(() => {});

    // Reset to default app
    const c = containerRef.current;
    if (c) {
      c.writeFile("/src/App.jsx", VIRTUAL_FILES["/src/App.jsx"]);
      const html = await assembleHtml(c);
      setHtmlSrc(html);
    }
  }, []);

  return {
    messages,
    isBooted,
    isStreaming,
    htmlSrc,
    hasMore,
    needsApiKey,
    files,
    selectedFile,
    fileContent,
    sendMessage,
    loadMoreMessages,
    refresh,
    resetApiKey,
    handleApiKeySubmit,
    clearChat,
    selectFile,
    saveFile,
    filePaths,
  };
}
