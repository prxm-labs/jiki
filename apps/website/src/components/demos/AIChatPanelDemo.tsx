import { useState } from "react";
import { AIChatPanel } from "@run0/jiki-ui";
import type { ChatMessage } from "@run0/jiki-ui";

export default function AIChatPanelDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! Ask me anything. Try typing `@` to mention a file.",
      timestamp: Date.now(),
    },
  ]);
  const [streaming, setStreaming] = useState(false);

  const handleSend = async (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content, timestamp: Date.now() },
    ]);
    setStreaming(true);
    await new Promise((r) => setTimeout(r, 600));
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `You said: **${content}**\n\n\`\`\`ts\nconsole.log("echo");\n\`\`\``,
        timestamp: Date.now(),
      },
    ]);
    setStreaming(false);
  };

  return (
    <div className="not-prose" style={{ height: 380 }}>
      <AIChatPanel
        messages={messages}
        onSendMessage={handleSend}
        isStreaming={streaming}
        modelLabel="Demo"
        filePaths={["src/index.ts", "src/App.tsx", "package.json"]}
      />
    </div>
  );
}
