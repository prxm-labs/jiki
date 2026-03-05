import { useState } from "react";
import {
  useEsbuildContainer,
  type BuildConfig,
} from "./hooks/useEsbuildContainer";
import {
  CodeEditor,
  Terminal,
  FileExplorer,
  MobileTabBar,
  CodeIcon,
  TerminalIcon,
  useMediaQuery,
} from "jiki-ui";
import { BuildConfigPanel } from "./components/BuildConfigPanel";
import { BuildOutput } from "./components/BuildOutput";

const DEFAULT_CONFIG: BuildConfig = {
  entryPoint: "src/index.tsx",
  format: "esm",
  platform: "browser",
  minify: false,
  bundle: true,
  externals: "react",
};

const ACCENT = "emerald" as const;

const MOBILE_TABS = [
  { id: "code", label: "Code", icon: <CodeIcon /> },
  {
    id: "config",
    label: "Config",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
    ),
  },
  { id: "output", label: "Output", icon: <TerminalIcon /> },
];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    isBuilding,
    buildResult,
    runCommand,
    build,
    selectFile,
    saveFile,
    clearTerminal,
  } = useEsbuildContainer();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [config, setConfig] = useState<BuildConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState("code");

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">
            Booting container...
          </p>
        </div>
      </div>
    );
  }

  const header = showHeader && (
    <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">
          jiki
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          esbuild
        </span>
      </div>
      <div className="flex items-center gap-3">
        {isBuilding && (
          <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-amber-400" />
        )}
      </div>
    </header>
  );

  /* ── Mobile layout ──────────────────────────────────────────── */
  if (!isDesktop) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {header}
        <MobileTabBar
          tabs={MOBILE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor={ACCENT}
        />
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === "code" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-shrink-0 border-b border-zinc-800 overflow-x-auto">
                <FileExplorer
                  files={files}
                  selectedFile={selectedFile}
                  onSelect={selectFile}
                  accentColor={ACCENT}
                  variant="compact"
                />
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  filename={selectedFile}
                  content={fileContent}
                  onSave={saveFile}
                  accentColor={ACCENT}
                />
              </div>
            </div>
          )}
          {activeTab === "config" && (
            <BuildConfigPanel
              config={config}
              onChange={setConfig}
              onBuild={() => build(config)}
              isBuilding={isBuilding}
            />
          )}
          {activeTab === "output" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 border-b border-zinc-800">
                <BuildOutput result={buildResult} />
              </div>
              <div className="h-48 flex-shrink-0">
                <Terminal
                  lines={terminal}
                  onCommand={runCommand}
                  onClear={clearTerminal}
                  accentColor={ACCENT}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {header}

      {/* Top half: editor area */}
      <div className="flex-1 flex min-h-0">
        <div className="w-52 flex-shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Source
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <FileExplorer
              files={files}
              selectedFile={selectedFile}
              onSelect={selectFile}
              accentColor={ACCENT}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 border-r border-zinc-800">
          <CodeEditor
            filename={selectedFile}
            content={fileContent}
            onSave={saveFile}
            accentColor={ACCENT}
          />
        </div>

        <div className="w-56 flex-shrink-0">
          <BuildConfigPanel
            config={config}
            onChange={setConfig}
            onBuild={() => build(config)}
            isBuilding={isBuilding}
          />
        </div>
      </div>

      {/* Bottom half: build output + terminal */}
      <div className="h-72 flex-shrink-0 border-t border-zinc-800 flex">
        <div className="flex-1 min-w-0 border-r border-zinc-800">
          <BuildOutput result={buildResult} />
        </div>
        <div className="w-96 flex-shrink-0">
          <Terminal
            lines={terminal}
            onCommand={runCommand}
            onClear={clearTerminal}
            accentColor={ACCENT}
          />
        </div>
      </div>
    </div>
  );
}
