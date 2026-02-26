import { useEffect, useRef } from "react";
import type { Highlighter } from "shiki";
import { getShikiLang } from "./shiki-languages";

// Module-level singleton — shared across all CodeEditor instances
let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

async function getOrCreateHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return highlighterInstance;
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = import("shiki")
    .then(({ createHighlighter }) =>
      createHighlighter({ themes: ["github-dark"], langs: [] }),
    )
    .then(h => {
      highlighterInstance = h;
      return h;
    });

  return highlighterPromise;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildFallbackHtml(code: string): string {
  return `<pre style="margin:0;background:transparent"><code style="color:#e4e4e7">${escapeHtml(code)}</code></pre>`;
}

async function doHighlight(
  code: string,
  filename: string | null,
  el: HTMLDivElement | null,
): Promise<void> {
  if (!el || !highlighterInstance) return;

  const lang = getShikiLang(filename);

  if (
    lang !== "plaintext" &&
    !highlighterInstance.getLoadedLanguages().includes(lang)
  ) {
    try {
      await highlighterInstance.loadLanguage(
        lang as Parameters<typeof highlighterInstance.loadLanguage>[0],
      );
    } catch {
      el.innerHTML = buildFallbackHtml(code);
      return;
    }
  }

  try {
    el.innerHTML = highlighterInstance.codeToHtml(code, {
      lang,
      theme: "github-dark",
    });
  } catch {
    el.innerHTML = buildFallbackHtml(code);
  }
}

/**
 * Manages Shiki syntax highlighting via direct DOM updates — no React state,
 * no re-renders. Updates the target element's innerHTML directly.
 */
export function useShikiHighlighter(
  code: string,
  filename: string | null,
  targetRef: React.RefObject<HTMLDivElement | null>,
): void {
  const readyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Initialize highlighter singleton on first mount
  useEffect(() => {
    let cancelled = false;
    getOrCreateHighlighter().then(() => {
      if (cancelled) return;
      readyRef.current = true;
      doHighlight(code, filename, targetRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced highlight on code/filename change — direct DOM mutation
  useEffect(() => {
    if (!readyRef.current) {
      // Show fallback while Shiki loads
      if (targetRef.current) {
        targetRef.current.innerHTML = buildFallbackHtml(code);
      }
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doHighlight(code, filename, targetRef.current);
    }, 30);

    return () => clearTimeout(debounceRef.current);
  }, [code, filename]);
}
