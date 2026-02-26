import { useState } from "react";
import type { AccentColor, FileEntry } from "./types";
import { getFileExplorerTheme } from "./theme";

export interface FileExplorerProps {
  files: FileEntry[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  accentColor?: AccentColor;
  variant?: "default" | "compact";
}

const FILE_COLOR_MAP: Record<string, string> = {
  js: "text-yellow-400",
  mjs: "text-yellow-400",
  cjs: "text-yellow-400",
  jsx: "text-cyan-400",
  ts: "text-blue-400",
  tsx: "text-cyan-400",
  json: "text-amber-300",
  html: "text-orange-400",
  css: "text-pink-400",
  md: "text-blue-400",
  vue: "text-emerald-400",
  svelte: "text-orange-400",
  astro: "text-orange-400",
  yaml: "text-blue-400",
  yml: "text-blue-400",
  toml: "text-blue-400",
  sh: "text-green-400",
  svg: "text-emerald-400",
};

function FileIcon({
  isDir,
  name,
  compact,
}: {
  isDir: boolean;
  name: string;
  compact: boolean;
}) {
  const iconSize = compact ? "text-[11px] w-3.5" : "text-xs w-4";
  if (isDir) {
    return (
      <span
        className={`text-amber-400 ${iconSize} inline-block text-center mr-1.5`}>
        &#x1F4C1;
      </span>
    );
  }
  const ext = name.split(".").pop()?.toLowerCase();
  const color = FILE_COLOR_MAP[ext || ""] || "text-zinc-400";
  return (
    <span className={`${color} ${iconSize} inline-block text-center mr-1.5`}>
      &#x1F4C4;
    </span>
  );
}

function TreeNode({
  entry,
  depth,
  selectedFile,
  onSelect,
  theme,
  compact,
}: {
  entry: FileEntry;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  theme: { selected: string };
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const isSelected = entry.path === selectedFile;
  const py = compact ? "py-[3px]" : "py-0.5";
  const px = compact ? "px-1.5" : "px-2";
  const fontSize = compact ? "text-[12px]" : "text-[13px]";
  const arrowSize = compact ? "text-[9px] w-2.5" : "text-[10px] w-3";
  const indent = compact ? depth * 10 + 6 : depth * 12 + 8;

  return (
    <div>
      <button
        onClick={() =>
          entry.isDir ? setExpanded(!expanded) : onSelect(entry.path)
        }
        className={`
          w-full text-left flex items-center ${py} ${px} rounded ${fontSize} font-mono
          transition-colors duration-75
          ${isSelected ? theme.selected : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}
        `}
        style={{ paddingLeft: `${indent}px` }}>
        {entry.isDir && (
          <span className={`${arrowSize} mr-1 text-zinc-500 inline-block`}>
            {expanded ? "\u25BE" : "\u25B8"}
          </span>
        )}
        {!entry.isDir && <span className={`${arrowSize} inline-block`} />}
        <FileIcon isDir={entry.isDir} name={entry.name} compact={compact} />
        <span className="truncate">{entry.name}</span>
      </button>
      {entry.isDir &&
        expanded &&
        entry.children?.map(child => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            onSelect={onSelect}
            theme={theme}
            compact={compact}
          />
        ))}
    </div>
  );
}

export function FileExplorer({
  files,
  selectedFile,
  onSelect,
  accentColor = "emerald",
  variant = "default",
}: FileExplorerProps) {
  const theme = getFileExplorerTheme(accentColor);
  const compact = variant === "compact";

  if (files.length === 0) {
    return (
      <div
        className={`p-2 ${compact ? "text-[11px]" : "text-xs"} text-zinc-600 italic`}>
        No files
      </div>
    );
  }

  return (
    <div className={compact ? "py-0.5" : "py-1"}>
      {files.map(entry => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          selectedFile={selectedFile}
          onSelect={onSelect}
          theme={theme}
          compact={compact}
        />
      ))}
    </div>
  );
}
