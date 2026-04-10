import { useState } from "react";
import { FileExplorer } from "@run0/jiki-ui";
import type { FileEntry } from "@run0/jiki-ui";
import { DemoTabs } from "./DemoTabs";

const FILES: FileEntry[] = [
  {
    name: "src",
    path: "src",
    isDir: true,
    children: [
      { name: "App.tsx", path: "src/App.tsx", isDir: false },
      { name: "index.ts", path: "src/index.ts", isDir: false },
      {
        name: "utils",
        path: "src/utils",
        isDir: true,
        children: [
          { name: "math.ts", path: "src/utils/math.ts", isDir: false },
        ],
      },
    ],
  },
  { name: "package.json", path: "package.json", isDir: false },
  { name: "tsconfig.json", path: "tsconfig.json", isDir: false },
  { name: "README.md", path: "README.md", isDir: false },
];

const CODE = `import { useState } from "react";
import { FileExplorer } from "@run0/jiki-ui";
import type { FileEntry } from "@run0/jiki-ui";

const FILES: FileEntry[] = [
  {
    name: "src",
    path: "src",
    isDir: true,
    children: [
      { name: "App.tsx", path: "src/App.tsx", isDir: false },
      { name: "index.ts", path: "src/index.ts", isDir: false },
      {
        name: "utils",
        path: "src/utils",
        isDir: true,
        children: [
          { name: "math.ts", path: "src/utils/math.ts", isDir: false },
        ],
      },
    ],
  },
  { name: "package.json", path: "package.json", isDir: false },
  { name: "tsconfig.json", path: "tsconfig.json", isDir: false },
  { name: "README.md", path: "README.md", isDir: false },
];

export default function FileExplorerDemo() {
  const [selected, setSelected] = useState<string | null>("src/App.tsx");

  return (
    <div style={{ height: 260, width: 240 }}>
      <FileExplorer
        files={FILES}
        selectedFile={selected}
        onSelect={setSelected}
        accentColor="emerald"
      />
    </div>
  );
}`;

export default function FileExplorerDemo() {
  const [selected, setSelected] = useState<string | null>("src/App.tsx");

  return (
    <DemoTabs code={CODE}>
      <div style={{ height: 260, width: 240 }}>
        <FileExplorer
          files={FILES}
          selectedFile={selected}
          onSelect={setSelected}
          accentColor="emerald"
        />
      </div>
    </DemoTabs>
  );
}
