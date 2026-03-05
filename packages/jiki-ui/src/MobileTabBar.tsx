import { useRef, useEffect, useState } from "react";
import type { AccentColor } from "./types";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface MobileTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  accentColor?: AccentColor;
}

const ACTIVE_BG: Record<AccentColor, string> = {
  emerald: "bg-emerald-500/15",
  violet: "bg-violet-500/15",
  orange: "bg-orange-500/15",
  blue: "bg-blue-500/15",
  pink: "bg-pink-500/15",
  green: "bg-green-500/15",
  amber: "bg-amber-500/15",
};

const ACTIVE_TEXT: Record<AccentColor, string> = {
  emerald: "text-emerald-300",
  violet: "text-violet-300",
  orange: "text-orange-300",
  blue: "text-blue-300",
  pink: "text-pink-300",
  green: "text-green-300",
  amber: "text-amber-300",
};

export function MobileTabBar({
  tabs,
  activeTab,
  onTabChange,
  accentColor = "emerald",
}: MobileTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeIndex = tabs.findIndex(t => t.id === activeTab);
    if (activeIndex < 0) return;
    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>(
      "[data-tab-id]",
    );
    const btn = buttons[activeIndex];
    if (!btn) return;
    setIndicator({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    });
  }, [activeTab, tabs]);

  return (
    <div className="flex-shrink-0 px-3 py-1.5 border-b border-zinc-800 bg-zinc-950">
      <div
        ref={containerRef}
        className="relative flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
        {/* Sliding indicator */}
        <div
          className={`absolute top-0.5 bottom-0.5 rounded-md ${ACTIVE_BG[accentColor]} transition-all duration-200 ease-out`}
          style={{ left: indicator.left, width: indicator.width }}
        />
        {tabs.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5
                          rounded-md py-1.5 px-3 font-mono text-[11px] tracking-wide
                          transition-colors duration-150
                          ${isActive ? ACTIVE_TEXT[accentColor] : "text-zinc-500 hover:text-zinc-400"}`}>
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Preset icon SVGs ────────────────────────────────────────── */

export function ChatIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export function PreviewIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export function CodeIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

export function TerminalIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function FilesIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
