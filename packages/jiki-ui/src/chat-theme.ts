import type { AccentColor } from "./types";

export interface ChatTheme {
  userBubble: string;
  assistantBubble: string;
  sendButton: string;
  sendButtonDisabled: string;
  streamingDot: string;
  inputCaret: string;
  modelBadge: string;
}

const CHAT_THEMES: Record<AccentColor, ChatTheme> = {
  emerald: {
    userBubble: "bg-emerald-500/15 border border-emerald-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-emerald-500 hover:bg-emerald-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-emerald-400",
    inputCaret: "caret-emerald-400",
    modelBadge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  violet: {
    userBubble: "bg-violet-500/15 border border-violet-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-violet-500 hover:bg-violet-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-violet-400",
    inputCaret: "caret-violet-400",
    modelBadge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  orange: {
    userBubble: "bg-orange-500/15 border border-orange-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-orange-500 hover:bg-orange-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-orange-400",
    inputCaret: "caret-orange-400",
    modelBadge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  blue: {
    userBubble: "bg-blue-500/15 border border-blue-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-blue-500 hover:bg-blue-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-blue-400",
    inputCaret: "caret-blue-400",
    modelBadge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  pink: {
    userBubble: "bg-pink-500/15 border border-pink-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-pink-500 hover:bg-pink-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-pink-400",
    inputCaret: "caret-pink-400",
    modelBadge: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  },
  green: {
    userBubble: "bg-green-500/15 border border-green-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-green-500 hover:bg-green-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-green-400",
    inputCaret: "caret-green-400",
    modelBadge: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  amber: {
    userBubble: "bg-amber-500/15 border border-amber-500/20",
    assistantBubble: "bg-zinc-800/50 border border-zinc-700/50",
    sendButton: "bg-amber-500 hover:bg-amber-600 text-white",
    sendButtonDisabled: "bg-zinc-700 text-zinc-500",
    streamingDot: "bg-amber-400",
    inputCaret: "caret-amber-400",
    modelBadge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
};

export function getChatTheme(color: AccentColor): ChatTheme {
  return CHAT_THEMES[color];
}
