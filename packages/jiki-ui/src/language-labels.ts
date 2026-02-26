const LANGUAGE_MAP: Record<string, string> = {
  js: "JavaScript",
  jsx: "JSX",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  tsx: "TSX",
  mts: "TypeScript",
  cts: "TypeScript",
  json: "JSON",
  md: "Markdown",
  html: "HTML",
  css: "CSS",
  vue: "Vue SFC",
  svelte: "Svelte",
  astro: "Astro",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  sh: "Shell",
};

export function getLanguageLabel(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return LANGUAGE_MAP[ext || ""] || "Plain Text";
}
