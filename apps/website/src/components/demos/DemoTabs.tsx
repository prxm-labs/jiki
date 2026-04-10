import { useState, useCallback, type ReactNode } from "react";

interface DemoTabsProps {
  children: ReactNode;
  code: string;
}

export function DemoTabs({ children, code }: DemoTabsProps) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-1">
        <div className="flex">
          <button
            onClick={() => setTab("preview")}
            className={`px-4 py-2 text-xs font-medium tracking-wide transition-colors ${
              tab === "preview"
                ? "border-b-2 border-emerald-500 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setTab("code")}
            className={`px-4 py-2 text-xs font-medium tracking-wide transition-colors ${
              tab === "code"
                ? "border-b-2 border-emerald-500 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Code
          </button>
        </div>

        {tab === "code" && (
          <button
            onClick={handleCopy}
            className="mr-2 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

      {/* Content */}
      {tab === "preview" ? (
        <div className="p-4">{children}</div>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <pre className="p-4 text-[13px] leading-relaxed">
            <code className="text-zinc-300">{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
