import { useState } from "react";
import {
  MobileTabBar,
  ChatIcon,
  CodeIcon,
  PreviewIcon,
  TerminalIcon,
  FilesIcon,
} from "@run0/jiki-ui";
import { DemoTabs } from "./DemoTabs";

const TABS = [
  { id: "chat", label: "Chat", icon: <ChatIcon /> },
  { id: "code", label: "Code", icon: <CodeIcon /> },
  { id: "preview", label: "Preview", icon: <PreviewIcon /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon /> },
  { id: "files", label: "Files", icon: <FilesIcon /> },
];

const CODE = `import { useState } from "react";
import {
  MobileTabBar,
  ChatIcon,
  CodeIcon,
  PreviewIcon,
  TerminalIcon,
  FilesIcon,
} from "@run0/jiki-ui";

const TABS = [
  { id: "chat", label: "Chat", icon: <ChatIcon /> },
  { id: "code", label: "Code", icon: <CodeIcon /> },
  { id: "preview", label: "Preview", icon: <PreviewIcon /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon /> },
  { id: "files", label: "Files", icon: <FilesIcon /> },
];

export default function MobileTabBarDemo() {
  const [active, setActive] = useState("code");

  return (
    <div style={{ maxWidth: 400 }}>
      <div className="p-6 text-center text-zinc-400">
        Active tab: <strong className="text-zinc-200">{active}</strong>
      </div>
      <MobileTabBar
        tabs={TABS}
        activeTab={active}
        onTabChange={setActive}
        accentColor="violet"
      />
    </div>
  );
}`;

export default function MobileTabBarDemo() {
  const [active, setActive] = useState("code");

  return (
    <DemoTabs code={CODE}>
      <div style={{ maxWidth: 400 }}>
        <div className="p-6 text-center text-zinc-400">
          Active tab: <strong className="text-zinc-200">{active}</strong>
        </div>
        <MobileTabBar
          tabs={TABS}
          activeTab={active}
          onTabChange={setActive}
          accentColor="violet"
        />
      </div>
    </DemoTabs>
  );
}
