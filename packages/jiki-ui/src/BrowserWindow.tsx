import { useRef, useEffect, useCallback, useState } from "react";

export interface InspectedElement {
  tagName: string;
  className: string;
  textContent: string;
  outerHTML: string;
}

export interface BrowserWindowProps {
  htmlSrc: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  port?: number;
  title?: string;
  previewUrl?: string;
  /** When provided, shows an inspect button. Called with element info on pick. */
  onInspectElement?: (element: InspectedElement) => void;
}

export function BrowserWindow({
  htmlSrc,
  url,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onRefresh,
  onNavigate,
  port = 3000,
  title = "App Preview",
  previewUrl,
  onInspectElement,
}: BrowserWindowProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [docTitle, setDocTitle] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const inspectCleanupRef = useRef<(() => void) | null>(null);

  const displayUrl = previewUrl
    ? `${previewUrl}${url === "/" ? "" : url}`
    : `http://localhost:${port}${url === "/" ? "" : url}`;

  // Track the last written srcdoc to avoid redundant rewrites that cause flash.
  const lastSrcdocRef = useRef("");

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (previewUrl) {
      iframe.src = `${previewUrl}${url === "/" ? "/" : url}`;
    } else if (htmlSrc !== lastSrcdocRef.current) {
      lastSrcdocRef.current = htmlSrc;
      iframe.srcdoc = htmlSrc;
    }
  }, [htmlSrc, previewUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || previewUrl) return;
    try {
      iframe.contentWindow?.postMessage({ type: "navigate", path: url }, "*");
    } catch {
      // cross-origin or iframe not ready
    }
  }, [url, previewUrl]);

  // Listen for <title> changes inside the iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: MutationObserver | undefined;

    const observe = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;

        const readTitle = () => {
          const t = doc.title;
          if (t) setDocTitle(t);
        };

        readTitle();

        const head = doc.head ?? doc.documentElement;
        if (!head) return;

        observer = new MutationObserver(readTitle);
        observer.observe(head, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      } catch {
        // cross-origin
      }
    };

    iframe.addEventListener("load", observe);
    return () => {
      iframe.removeEventListener("load", observe);
      observer?.disconnect();
    };
  }, [htmlSrc, previewUrl]);

  // Clean up inspect mode when htmlSrc changes (page rebuild)
  useEffect(() => {
    if (inspecting) {
      inspectCleanupRef.current?.();
      inspectCleanupRef.current = null;
      // Re-inject after a tick so the iframe has loaded
      const timer = setTimeout(() => {
        if (inspecting) injectInspectMode();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [htmlSrc]);

  // Inject inspect mode handlers into the iframe DOM
  const injectInspectMode = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument;
      if (!doc) return;

      let currentHighlight: HTMLElement | null = null;
      const OUTLINE = "2px solid #3b82f6";
      const OUTLINE_OFFSET = "-2px";

      const onMouseOver = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target === doc.body || target === doc.documentElement) return;
        if (currentHighlight) {
          currentHighlight.style.outline = "";
          currentHighlight.style.outlineOffset = "";
        }
        target.style.outline = OUTLINE;
        target.style.outlineOffset = OUTLINE_OFFSET;
        currentHighlight = target;
      };

      const onMouseOut = (e: Event) => {
        const target = e.target as HTMLElement;
        target.style.outline = "";
        target.style.outlineOffset = "";
        if (currentHighlight === target) currentHighlight = null;
      };

      const onClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        target.style.outline = "";
        target.style.outlineOffset = "";

        const text = (target.textContent || "").trim().slice(0, 200);
        const html = target.outerHTML.slice(0, 500);

        onInspectElement?.({
          tagName: target.tagName.toLowerCase(),
          className: target.className || "",
          textContent: text,
          outerHTML: html,
        });

        cleanup();
        setInspecting(false);
      };

      doc.addEventListener("mouseover", onMouseOver, true);
      doc.addEventListener("mouseout", onMouseOut, true);
      doc.addEventListener("click", onClick, true);

      // Set cursor on body
      doc.body.style.cursor = "crosshair";

      const cleanup = () => {
        doc.removeEventListener("mouseover", onMouseOver, true);
        doc.removeEventListener("mouseout", onMouseOut, true);
        doc.removeEventListener("click", onClick, true);
        doc.body.style.cursor = "";
        if (currentHighlight) {
          currentHighlight.style.outline = "";
          currentHighlight.style.outlineOffset = "";
          currentHighlight = null;
        }
      };

      inspectCleanupRef.current = cleanup;
    } catch {
      // cross-origin
    }
  }, [onInspectElement]);

  const toggleInspect = useCallback(() => {
    if (inspecting) {
      inspectCleanupRef.current?.();
      inspectCleanupRef.current = null;
      setInspecting(false);
    } else {
      setInspecting(true);
      // Wait a tick for the iframe to be ready
      requestAnimationFrame(() => injectInspectMode());
    }
  }, [inspecting, injectInspectMode]);

  const handleAddressKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const val = e.currentTarget.value.trim();
        try {
          const parsed = new URL(
            val.startsWith("http") ? val : `http://localhost:${port}${val}`,
          );
          onNavigate(parsed.pathname || "/");
        } catch {
          onNavigate(val.startsWith("/") ? val : `/${val}`);
        }
      }
    },
    [onNavigate, port],
  );

  const tabLabel = docTitle || title;

  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_40px_-12px_rgba(0,0,0,0.6)]">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 h-10 px-3 bg-zinc-900/80 border-b border-zinc-800/80 select-none">
        {/* Traffic lights */}
        <div className="flex items-center gap-[6px] mr-1">
          <span className="block h-[10px] w-[10px] rounded-full bg-[#ff5f57] ring-1 ring-black/10" />
          <span className="block h-[10px] w-[10px] rounded-full bg-[#febc2e] ring-1 ring-black/10" />
          <span className="block h-[10px] w-[10px] rounded-full bg-[#28c840] ring-1 ring-black/10" />
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:text-zinc-700 disabled:hover:bg-transparent transition-colors"
            title="Back">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="currentColor">
              <path d="M10.354 3.354a.5.5 0 0 0-.708-.708l-5 5a.5.5 0 0 0 0 .708l5 5a.5.5 0 0 0 .708-.708L5.707 8l4.647-4.646z" />
            </svg>
          </button>
          <button
            onClick={onForward}
            disabled={!canGoForward}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:text-zinc-700 disabled:hover:bg-transparent transition-colors"
            title="Forward">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="currentColor">
              <path d="M5.646 3.354a.5.5 0 0 1 .708-.708l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 0 1-.708-.708L10.293 8 5.646 3.354z" />
            </svg>
          </button>
          <button
            onClick={onRefresh}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Refresh">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M2.5 8a5.5 5.5 0 0 1 9.22-4.05M13.5 8a5.5 5.5 0 0 1-9.22 4.05" />
              <path d="M13.5 2.5v3h-3M2.5 13.5v-3h3" />
            </svg>
          </button>
          {/* Inspect element button */}
          {onInspectElement && (
            <button
              onClick={toggleInspect}
              className={`p-1 rounded-md transition-colors ${
                inspecting
                  ? "text-blue-400 bg-blue-500/15"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
              title={inspecting ? "Cancel inspect" : "Inspect element"}>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M3 12l3 0" />
                <path d="M12 3l0 3" />
                <path d="M7.8 7.8l-2.2 -2.2" />
                <path d="M16.2 7.8l2.2 -2.2" />
                <path d="M7.8 16.2l-2.2 2.2" />
                <path d="M12 12l9 3l-4 2l-2 4l-3 -9" />
              </svg>
            </button>
          )}
        </div>

        {/* Address bar */}
        <div
          className={`flex-1 flex items-center gap-2 h-[26px] rounded-md px-2.5 transition-colors ${
            isFocused
              ? "bg-zinc-950 ring-1 ring-zinc-600"
              : "bg-zinc-800/60 hover:bg-zinc-800"
          }`}>
          <svg
            className="w-3 h-3 flex-shrink-0 text-zinc-500"
            viewBox="0 0 16 16"
            fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 1a4.5 4.5 0 0 0-4.5 4.5V7H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.5V5.5A4.5 4.5 0 0 0 8 1zm2.5 6V5.5a2.5 2.5 0 0 0-5 0V7h5z"
            />
          </svg>
          <input
            type="text"
            defaultValue={displayUrl}
            key={displayUrl}
            onKeyDown={handleAddressKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="flex-1 bg-transparent text-[11px] text-zinc-400 outline-none font-mono leading-none placeholder:text-zinc-600"
            spellCheck={false}
          />
          {tabLabel && (
            <span className="hidden sm:block text-[10px] text-zinc-600 truncate max-w-[120px] leading-none">
              {tabLabel}
            </span>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 bg-white relative">
        <iframe
          ref={iframeRef}
          title={docTitle || title}
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          className="absolute inset-0 w-full h-full border-0"
        />
        {/* Inspect mode overlay indicator */}
        {inspecting && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-blue-500/90 text-white text-[10px] font-mono shadow-lg pointer-events-none">
            Click an element to inspect
          </div>
        )}
      </div>
    </div>
  );
}
