import { useState } from "react";
import { useSandboxDemo } from "./hooks/useSandboxDemo";
import {
  CodeEditor,
  Terminal,
  FileExplorer,
  MobileTabBar,
  CodeIcon,
  TerminalIcon,
  useMediaQuery,
} from "jiki-ui";

const ACCENT = "amber" as const;

const MOBILE_TABS = [
  { id: "code", label: "Code", icon: <CodeIcon /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon /> },
];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    selectFile,
    saveFile,
    runCommand,
    clearTerminal,
  } = useSandboxDemo();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activeTab, setActiveTab] = useState("code");

  if (!isBooted)
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
          <p className="mt-3 text-[11px] text-zinc-500 font-mono">
            Booting sandbox...
          </p>
        </div>
      </div>
    );

  const header = showHeader && (
    <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-zinc-300 tracking-tight">
          jiki
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Sandbox
        </span>
      </div>
    </header>
  );

  const codePanel = (
    <div className="flex-1 flex min-h-0">
      <div className="w-48 flex-shrink-0 border-r border-zinc-800 overflow-y-auto md:block hidden">
        <FileExplorer
          files={files}
          selectedFile={selectedFile}
          onSelect={selectFile}
          accentColor={ACCENT}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile file selector */}
        <div className="flex-shrink-0 border-b border-zinc-800 overflow-x-auto md:hidden">
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
    </div>
  );

  const terminalPanel = (
    <Terminal
      lines={terminal}
      onCommand={runCommand}
      onClear={clearTerminal}
      accentColor={ACCENT}
    />
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
          {activeTab === "code" && codePanel}
          {activeTab === "terminal" && terminalPanel}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {header}
      <div className="flex-1 flex min-h-0">
        <div className="w-48 flex-shrink-0 border-r border-zinc-800 overflow-y-auto">
          <FileExplorer
            files={files}
            selectedFile={selectedFile}
            onSelect={selectFile}
            accentColor={ACCENT}
          />
        </div>
        <div className="flex-1 min-w-0">
          <CodeEditor
            filename={selectedFile}
            content={fileContent}
            onSave={saveFile}
            accentColor={ACCENT}
          />
        </div>
      </div>
      <div className="h-56 flex-shrink-0 border-t border-zinc-800">
        {terminalPanel}
      </div>
    </div>
  );
}
