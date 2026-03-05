import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { AccentColor } from "./types";
import { getChatTheme } from "./chat-theme";
import type { InspectedElement } from "./BrowserWindow";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface AIChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isStreaming?: boolean;
  accentColor?: AccentColor;
  title?: string;
  modelLabel?: string;
  onLoadMore?: () => void;
  hasMoreMessages?: boolean;
  /** Flat list of file paths for @ mention autocomplete */
  filePaths?: string[];
  /** Inspected element context to attach to next message */
  inspectedElement?: InspectedElement | null;
  /** Clear the inspected element context */
  onClearInspectedElement?: () => void;
}

// ---------------------------------------------------------------------------
// Collapsible code block
// ---------------------------------------------------------------------------

function CodeBlock({ lang, content }: { lang?: string; content: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const lineCount = content.split("\n").length;

  return (
    <div className="my-2 rounded-lg bg-zinc-900 border border-zinc-700/50 overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-2">
          {lang && (
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              {lang}
            </span>
          )}
          <span className="text-[10px] text-zinc-600 font-mono">
            {lineCount} lines
          </span>
        </div>
        <svg
          className={`w-3 h-3 text-zinc-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
          viewBox="0 0 16 16"
          fill="currentColor">
          <path d="M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
        </svg>
      </div>
      {!collapsed && (
        <pre className="p-3 overflow-x-auto">
          <code className="text-[12px] font-mono text-zinc-300 leading-relaxed whitespace-pre">
            {content}
          </code>
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content renderer (text + code blocks)
// ---------------------------------------------------------------------------

function renderContent(text: string) {
  const parts: Array<{
    type: "text" | "code";
    content: string;
    lang?: string;
  }> = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({
      type: "code",
      content: match[2],
      lang: match[1] || undefined,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", content: text });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "code") {
          return <CodeBlock key={i} lang={part.lang} content={part.content} />;
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part.content}
          </span>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline file mention rendering (@/path/to/file)
// ---------------------------------------------------------------------------

function renderUserContent(text: string) {
  const parts = text.split(/(@\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@/") ? (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px]">
            <svg
              className="w-2.5 h-2.5 flex-shrink-0"
              viewBox="0 0 16 16"
              fill="currentColor">
              <path d="M3.75 1.5A2.25 2.25 0 0 0 1.5 3.75v8.5A2.25 2.25 0 0 0 3.75 14.5h8.5a2.25 2.25 0 0 0 2.25-2.25V6.621a2.25 2.25 0 0 0-.659-1.591L10.47 1.659A2.25 2.25 0 0 0 8.879 1.5H3.75z" />
            </svg>
            {part.slice(1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Collapsible message wrapper
// ---------------------------------------------------------------------------

function MessageBubble({
  msg,
  theme,
}: {
  msg: ChatMessage;
  theme: ReturnType<typeof getChatTheme>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasCode = msg.role === "assistant" && /```/.test(msg.content);
  const isLong = msg.content.length > 500;
  const canCollapse = (hasCode || isLong) && !msg.isStreaming;

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${theme.userBubble} text-zinc-200`}>
          {renderUserContent(msg.content)}
        </div>
      </div>
    );
  }

  // Assistant message — no bubble wrapper, just inline content
  return (
    <div className="text-[13px] leading-relaxed text-zinc-300">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1.5 text-left">
          <svg
            className="w-2.5 h-2.5 text-zinc-600 flex-shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor">
            <path d="M6.646 3.646a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L9.293 7 6.646 4.354a.5.5 0 0 1 0-.708z" />
          </svg>
          <span className="text-[11px] text-zinc-600">
            {msg.content
              .split("\n")[0]
              .replace(/```\w*/, "")
              .trim()
              .slice(0, 60) || "Response"}
            ...
          </span>
        </button>
      ) : (
        <div>
          {renderContent(msg.content)}
          {msg.isStreaming && (
            <span className="inline-flex items-center gap-1 ml-1">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${theme.streamingDot} animate-pulse`}
              />
            </span>
          )}
          {canCollapse && (
            <button
              onClick={() => setCollapsed(true)}
              className="mt-1 flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 16 16"
                fill="currentColor">
                <path d="M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
              </svg>
              <span className="text-[10px]">Collapse</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AIChatPanel({
  messages,
  onSendMessage,
  isStreaming = false,
  accentColor = "blue",
  title = "Chat",
  modelLabel,
  onLoadMore,
  hasMoreMessages = false,
  filePaths = [],
  inspectedElement,
  onClearInspectedElement,
}: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);

  // @ mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);

  const theme = getChatTheme(accentColor);

  // Filtered file paths for autocomplete
  const mentionFiltered = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return filePaths.filter(p => p.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, filePaths]);

  // Reset selection when filtered results change
  useEffect(() => {
    setMentionIdx(0);
  }, [mentionFiltered.length]);

  // Auto-scroll to bottom when new messages arrive (if user hasn't scrolled up)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Track whether user is at bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 40;
      isAtBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // IntersectionObserver for lazy loading older messages
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore || !hasMoreMessages) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { root: scrollRef.current, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMoreMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  // Track @ mentions as user types
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInput(val);

      const cursorPos = e.target.selectionStart;
      const textBefore = val.slice(0, cursorPos);

      const atMatch = textBefore.match(/(?:^|\s)@([^\s]*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setMentionStart(cursorPos - atMatch[1].length - 1);
      } else {
        setMentionQuery(null);
      }
    },
    [],
  );

  const handleMentionSelect = useCallback(
    (path: string) => {
      const before = input.slice(0, mentionStart);
      const after = input.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
      const newInput = `${before}@${path}${after ? after : " "}`;
      setInput(newInput);
      setMentionQuery(null);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          const pos = before.length + 1 + path.length + 1;
          ta.selectionStart = pos;
          ta.selectionEnd = pos;
        }
      });
    },
    [input, mentionStart, mentionQuery],
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // If there's an inspected element, prepend context
    let messageContent = trimmed;
    if (inspectedElement) {
      const ctx = `[Inspected element: <${inspectedElement.tagName} class="${inspectedElement.className}"> "${inspectedElement.textContent.slice(0, 100)}"]\n\n`;
      messageContent = ctx + trimmed;
      onClearInspectedElement?.();
    }

    onSendMessage(messageContent);
    setInput("");
    setMentionQuery(null);
    isAtBottomRef.current = true;
  }, [
    input,
    isStreaming,
    onSendMessage,
    inspectedElement,
    onClearInspectedElement,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle autocomplete keyboard navigation
      if (mentionQuery !== null && mentionFiltered.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIdx(i => (i + 1) % mentionFiltered.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIdx(
            i => (i - 1 + mentionFiltered.length) % mentionFiltered.length,
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          handleMentionSelect(mentionFiltered[mentionIdx]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionQuery(null);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      handleSend,
      mentionQuery,
      mentionFiltered,
      mentionIdx,
      handleMentionSelect,
    ],
  );

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {title}
          </span>
        </div>
        {modelLabel && (
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${theme.modelBadge}`}>
            {modelLabel}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {hasMoreMessages && (
          <div ref={sentinelRef} className="flex justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-zinc-400" />
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} theme={theme} />
        ))}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-zinc-800 p-3">
        {/* Inspected element context badge */}
        {inspectedElement && (
          <div className="mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <svg
              className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"
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
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-mono text-blue-300">
                &lt;{inspectedElement.tagName}&gt;
              </span>
              {inspectedElement.textContent && (
                <span className="text-[11px] text-zinc-500 ml-1.5 truncate">
                  "{inspectedElement.textContent.slice(0, 40)}
                  {inspectedElement.textContent.length > 40 ? "..." : ""}"
                </span>
              )}
            </div>
            <button
              onClick={onClearInspectedElement}
              className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
        )}

        <div className="relative flex items-end gap-2">
          {/* @ mention dropdown */}
          {mentionQuery !== null && mentionFiltered.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-10">
              {mentionFiltered.map((path, i) => (
                <button
                  key={path}
                  onMouseDown={e => {
                    e.preventDefault();
                    handleMentionSelect(path);
                  }}
                  onMouseEnter={() => setMentionIdx(i)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] font-mono flex items-center gap-2 transition-colors ${
                    i === mentionIdx
                      ? "bg-blue-500/15 text-blue-300"
                      : "text-zinc-400 hover:bg-zinc-800"
                  }`}>
                  <svg
                    className="w-3 h-3 flex-shrink-0 text-zinc-500"
                    viewBox="0 0 16 16"
                    fill="currentColor">
                    <path d="M3.75 1.5A2.25 2.25 0 0 0 1.5 3.75v8.5A2.25 2.25 0 0 0 3.75 14.5h8.5a2.25 2.25 0 0 0 2.25-2.25V6.621a2.25 2.25 0 0 0-.659-1.591L10.47 1.659A2.25 2.25 0 0 0 8.879 1.5H3.75z" />
                  </svg>
                  {path}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? "Generating..."
                : "Describe a component... (@ to reference files)"
            }
            rows={1}
            className={`
              flex-1 resize-none overflow-hidden bg-zinc-900 border border-zinc-700/50 rounded-lg px-3 py-2
              text-[13px] text-zinc-200 font-mono outline-none
              placeholder:text-zinc-600 disabled:opacity-50
              focus:border-zinc-600 transition-colors
              min-h-[60px]
              ${theme.inputCaret}
            `}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className={`
              flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center
              transition-colors disabled:cursor-not-allowed
              ${isStreaming || !input.trim() ? theme.sendButtonDisabled : theme.sendButton}
            `}>
            {isStreaming ? (
              <div className="h-4 w-4 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.724 1.053a.5.5 0 0 0-.714.545l1.403 4.85a.5.5 0 0 0 .397.354l5.69.953c.268.045.268.545 0 .59l-5.69.953a.5.5 0 0 0-.397.354l-1.403 4.85a.5.5 0 0 0 .714.545l13-6.5a.5.5 0 0 0 0-.894l-13-6.5z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5 px-1">
          Enter to send · Shift+Enter for newline · @ to reference files
        </p>
      </div>
    </div>
  );
}
