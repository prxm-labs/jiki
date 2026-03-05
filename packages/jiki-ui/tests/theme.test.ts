import { describe, it, expect } from "vitest";
import { getEditorTheme, getTerminalTheme, getLineStyles } from "../src/theme";
import type { AccentColor } from "../src/types";

const ALL_COLORS: AccentColor[] = [
  "emerald",
  "violet",
  "orange",
  "blue",
  "pink",
  "green",
  "amber",
];

describe("getEditorTheme", () => {
  it.each(ALL_COLORS)("returns theme for %s", color => {
    const theme = getEditorTheme(color);
    expect(theme.caret).toContain(`caret-${color}-400`);
    expect(theme.selection).toContain(`${color}-500/20`);
    expect(theme.saveButtonActive).toContain(`${color}-400`);
  });
});

describe("getTerminalTheme", () => {
  it.each(ALL_COLORS)("returns theme for %s", color => {
    const theme = getTerminalTheme(color);
    expect(theme.commandStyle).toContain(`text-${color}-400`);
    expect(theme.promptColor).toContain(`text-${color}-500`);
    expect(theme.spinnerBorder).toContain(`border-t-${color}-400`);
    expect(theme.inputCaret).toContain(`caret-${color}-400`);
  });
});

describe("getLineStyles", () => {
  it("returns default line styles for emerald", () => {
    const styles = getLineStyles("emerald");
    expect(styles.command).toBe("text-emerald-400 font-semibold");
    expect(styles.stdout).toBe("text-zinc-300");
    expect(styles.stderr).toBe("text-red-400");
    expect(styles.info).toBe("text-blue-400 italic");
    expect(styles.success).toBe("text-emerald-400");
  });

  it("accepts overrides", () => {
    const styles = getLineStyles("orange", { info: "text-amber-400 italic" });
    expect(styles.command).toBe("text-orange-400 font-semibold");
    expect(styles.info).toBe("text-amber-400 italic");
  });
});
