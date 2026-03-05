const SHIKI_LANG_MAP: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  html: "html",
  css: "css",
  md: "markdown",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sh: "shellscript",
};

export function getShikiLang(filename: string | null): string {
  if (!filename) return "plaintext";
  const ext = filename.split(".").pop()?.toLowerCase();
  return SHIKI_LANG_MAP[ext || ""] || "plaintext";
}
