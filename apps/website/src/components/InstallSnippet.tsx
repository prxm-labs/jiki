import { useState } from "react";

const commands = [
  { label: "npm", command: "npm install @run0/jiki" },
  { label: "pnpm", command: "pnpm add @run0/jiki" },
  { label: "yarn", command: "yarn add @run0/jiki" },
];

export default function InstallSnippet() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(commands[active].command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80">
      <div className="flex border-b border-zinc-800">
        {commands.map((cmd, i) => (
          <button
            key={cmd.label}
            onClick={() => setActive(i)}
            className={`px-4 py-2 font-mono text-xs tracking-wider transition-colors ${
              i === active
                ? "bg-zinc-800/50 text-accent"
                : "text-zinc-500 hover:text-zinc-300"
            }`}>
            {cmd.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="font-mono text-[13px] leading-[1.7] text-zinc-300">
          <span className="text-zinc-600 select-none">$ </span>
          {commands[active].command}
        </span>
        <button
          onClick={copy}
          className="ml-4 rounded-md border border-zinc-700/50 bg-zinc-800/80 p-1.5 text-zinc-500 transition-all hover:border-zinc-600 hover:text-zinc-300"
          aria-label="Copy command">
          {copied ? (
            <svg
              className="h-3.5 w-3.5 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
