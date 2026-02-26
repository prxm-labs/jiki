import type { AccentColor } from "./types";

export interface PanelToggleProps {
  collapsed: boolean;
  onClick: () => void;
  label: string;
  side?: "left" | "right";
  accentColor?: AccentColor;
}

const ACCENT_LABELS: Record<AccentColor, string> = {
  emerald: "text-emerald-500/70",
  violet: "text-violet-500/70",
  orange: "text-orange-500/70",
  blue: "text-blue-500/70",
  pink: "text-pink-500/70",
  green: "text-green-500/70",
  amber: "text-amber-500/70",
};

const ACCENT_CHEVRONS: Record<AccentColor, string> = {
  emerald: "text-emerald-400",
  violet: "text-violet-400",
  orange: "text-orange-400",
  blue: "text-blue-400",
  pink: "text-pink-400",
  green: "text-green-400",
  amber: "text-amber-400",
};

const ACCENT_HOVER_BG: Record<AccentColor, string> = {
  emerald: "hover:bg-emerald-500/5",
  violet: "hover:bg-violet-500/5",
  orange: "hover:bg-orange-500/5",
  blue: "hover:bg-blue-500/5",
  pink: "hover:bg-pink-500/5",
  green: "hover:bg-green-500/5",
  amber: "hover:bg-amber-500/5",
};

export function PanelToggle({
  collapsed,
  onClick,
  label,
  side = "left",
  accentColor = "emerald",
}: PanelToggleProps) {
  const chevronRight = (
    <>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M9 6l6 6l-6 6" />
    </>
  );
  const chevronLeft = (
    <>
      <path stroke="none" d="M0 0h24v24H0z" />
      <path d="m15 6-6 6 6 6" />
    </>
  );

  if (collapsed) {
    return (
      <button
        onClick={onClick}
        className="flex-shrink-0 w-7 flex flex-col items-center gap-2 pt-3 pb-3
                   border-r border-zinc-800 bg-zinc-900/40
                   hover:bg-zinc-800/60 transition-colors cursor-pointer"
        title={`Show ${label}`}>
        <svg
          className={`w-3 h-3 ${ACCENT_CHEVRONS[accentColor]}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none">
          {side === "left" ? chevronRight : chevronLeft}
        </svg>
        <span
          className={`text-[10px] font-mono tracking-wider uppercase select-none ${ACCENT_LABELS[accentColor]}`}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-[9px] flex items-center justify-center
                  border-r border-zinc-800 bg-transparent
                  ${ACCENT_HOVER_BG[accentColor]} transition-colors cursor-pointer group`}
      title={`Hide ${label}`}>
      <svg
        className={`w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100
                    transition-opacity ${ACCENT_CHEVRONS[accentColor]}`}
        viewBox="0 0 16 16"
        fill="currentColor">
        {side === "left" ? chevronLeft : chevronRight}
      </svg>
    </button>
  );
}
