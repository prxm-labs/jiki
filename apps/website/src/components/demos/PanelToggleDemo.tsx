import { useState } from "react";
import { PanelToggle } from "@run0/jiki-ui";
import { DemoTabs } from "./DemoTabs";

const CODE = `import { useState } from "react";
import { PanelToggle } from "@run0/jiki-ui";

export default function PanelToggleDemo() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: "flex", height: 200, borderRadius: 8, overflow: "hidden" }}
      className="border border-zinc-800"
    >
      {!collapsed && (
        <div className="w-48 bg-zinc-900 p-4 text-sm text-zinc-400">
          <p className="font-medium text-zinc-300 mb-2">Files</p>
          <p>src/index.ts</p>
          <p>src/App.tsx</p>
          <p>package.json</p>
        </div>
      )}
      <PanelToggle
        collapsed={collapsed}
        onClick={() => setCollapsed(!collapsed)}
        label="Files"
        side="left"
        accentColor="emerald"
      />
      <div className="flex-1 bg-zinc-950 p-4 text-sm text-zinc-400">
        <p>Main content area</p>
      </div>
    </div>
  );
}`;

export default function PanelToggleDemo() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <DemoTabs code={CODE}>
      <div
        style={{ display: "flex", height: 200, borderRadius: 8, overflow: "hidden" }}
        className="border border-zinc-800"
      >
        {!collapsed && (
          <div className="w-48 bg-zinc-900 p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-300 mb-2">Files</p>
            <p>src/index.ts</p>
            <p>src/App.tsx</p>
            <p>package.json</p>
          </div>
        )}
        <PanelToggle
          collapsed={collapsed}
          onClick={() => setCollapsed(!collapsed)}
          label="Files"
          side="left"
          accentColor="emerald"
        />
        <div className="flex-1 bg-zinc-950 p-4 text-sm text-zinc-400">
          <p>Main content area</p>
        </div>
      </div>
    </DemoTabs>
  );
}
