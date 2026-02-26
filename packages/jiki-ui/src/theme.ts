import type { AccentColor, TerminalLine } from "./types";

export interface EditorTheme {
  saveButtonActive: string;
  caret: string;
  selection: string;
}

export interface TerminalTheme {
  commandStyle: string;
  promptColor: string;
  spinnerBorder: string;
  inputCaret: string;
}

const EDITOR_THEMES: Record<AccentColor, EditorTheme> = {
  emerald: {
    saveButtonActive:
      "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30",
    caret: "caret-emerald-400",
    selection: "selection:bg-emerald-500/20",
  },
  violet: {
    saveButtonActive:
      "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30",
    caret: "caret-violet-400",
    selection: "selection:bg-violet-500/20",
  },
  orange: {
    saveButtonActive:
      "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30",
    caret: "caret-orange-400",
    selection: "selection:bg-orange-500/20",
  },
  blue: {
    saveButtonActive:
      "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30",
    caret: "caret-blue-400",
    selection: "selection:bg-blue-500/20",
  },
  pink: {
    saveButtonActive:
      "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/30",
    caret: "caret-pink-400",
    selection: "selection:bg-pink-500/20",
  },
  green: {
    saveButtonActive:
      "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30",
    caret: "caret-green-400",
    selection: "selection:bg-green-500/20",
  },
  amber: {
    saveButtonActive:
      "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30",
    caret: "caret-amber-400",
    selection: "selection:bg-amber-500/20",
  },
};

const TERMINAL_THEMES: Record<AccentColor, TerminalTheme> = {
  emerald: {
    commandStyle: "text-emerald-400 font-semibold",
    promptColor: "text-emerald-500",
    spinnerBorder: "border-t-emerald-400",
    inputCaret: "caret-emerald-400",
  },
  violet: {
    commandStyle: "text-violet-400 font-semibold",
    promptColor: "text-violet-500",
    spinnerBorder: "border-t-violet-400",
    inputCaret: "caret-violet-400",
  },
  orange: {
    commandStyle: "text-orange-400 font-semibold",
    promptColor: "text-orange-500",
    spinnerBorder: "border-t-orange-400",
    inputCaret: "caret-orange-400",
  },
  blue: {
    commandStyle: "text-blue-400 font-semibold",
    promptColor: "text-blue-500",
    spinnerBorder: "border-t-blue-400",
    inputCaret: "caret-blue-400",
  },
  pink: {
    commandStyle: "text-pink-400 font-semibold",
    promptColor: "text-pink-500",
    spinnerBorder: "border-t-pink-400",
    inputCaret: "caret-pink-400",
  },
  green: {
    commandStyle: "text-green-400 font-semibold",
    promptColor: "text-green-500",
    spinnerBorder: "border-t-green-400",
    inputCaret: "caret-green-400",
  },
  amber: {
    commandStyle: "text-amber-400 font-semibold",
    promptColor: "text-amber-500",
    spinnerBorder: "border-t-amber-400",
    inputCaret: "caret-amber-400",
  },
};

export interface FileExplorerTheme {
  selected: string;
}

const FILE_EXPLORER_THEMES: Record<AccentColor, FileExplorerTheme> = {
  emerald: { selected: "bg-emerald-500/15 text-emerald-300" },
  violet: { selected: "bg-violet-500/15 text-violet-300" },
  orange: { selected: "bg-orange-500/15 text-orange-300" },
  blue: { selected: "bg-blue-500/15 text-blue-300" },
  pink: { selected: "bg-pink-500/15 text-pink-300" },
  green: { selected: "bg-green-500/15 text-green-300" },
  amber: { selected: "bg-amber-500/15 text-amber-300" },
};

export function getFileExplorerTheme(color: AccentColor): FileExplorerTheme {
  return FILE_EXPLORER_THEMES[color];
}

export function getEditorTheme(color: AccentColor): EditorTheme {
  return EDITOR_THEMES[color];
}

export function getTerminalTheme(color: AccentColor): TerminalTheme {
  return TERMINAL_THEMES[color];
}

export function getLineStyles(
  color: AccentColor,
  overrides?: Partial<Record<TerminalLine["type"], string>>,
): Record<TerminalLine["type"], string> {
  return {
    command: TERMINAL_THEMES[color].commandStyle,
    stdout: "text-zinc-300",
    stderr: "text-red-400",
    info: "text-blue-400 italic",
    success: "text-emerald-400",
    ...overrides,
  };
}
