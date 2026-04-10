import { useState, useRef } from "react";
import { Terminal } from "@run0/jiki-ui";
import type { TerminalLine } from "@run0/jiki-ui";

export default function TerminalDemo() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: "info", text: "Welcome! Try typing a command." },
  ]);
  const nextId = useRef(1);

  return (
    <div className="not-prose" style={{ height: 300 }}>
      <Terminal
        lines={lines}
        onCommand={async (cmd) => {
          const id = nextId.current++;
          setLines((prev) => [
            ...prev,
            { id, type: "command", text: cmd },
            { id: id + 1, type: "stdout", text: `echo: ${cmd}` },
          ]);
          nextId.current++;
        }}
        onClear={() => setLines([])}
        accentColor="emerald"
      />
    </div>
  );
}
