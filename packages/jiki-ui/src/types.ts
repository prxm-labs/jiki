export interface TerminalLine {
  id: number;
  type: "command" | "stdout" | "stderr" | "info" | "success";
  text: string;
}

export type AccentColor =
  | "emerald"
  | "violet"
  | "orange"
  | "blue"
  | "pink"
  | "green"
  | "amber";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}
