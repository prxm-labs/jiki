import { useState } from "react";
import { useAstroContainer } from "./hooks/useAstroContainer";
import {
  BrowserWindow,
  CodeEditor,
  FileExplorer,
  Terminal,
  MobileTabBar,
  CodeIcon,
  PreviewIcon,
  TerminalIcon,
  useMediaQuery,
} from "@run0/jiki-ui";

const ACCENT = "orange" as const;

const MOBILE_TABS = [
  { id: "code", label: "Code", icon: <CodeIcon /> },
  { id: "preview", label: "Preview", icon: <PreviewIcon /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon /> },
];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    htmlSrc,
    currentPath,
    canGoBack,
    canGoForward,
    navigateTo,
    goBack,
    goForward,
    refresh,
    selectFile,
    saveFile,
    runCommand,
    clearTerminal,
  } = useAstroContainer();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activeTab, setActiveTab] = useState("code");

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-400" />
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
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
          Astro
        </span>
      </div>
      <span className="text-[10px] text-zinc-600 font-mono hidden sm:block">
        .astro files &middot; React/Vue islands
      </span>
    </header>
  );

  const previewPanel = (
    <BrowserWindow
      title="My Astro Site"
      port={4321}
      htmlSrc={htmlSrc}
      url={currentPath}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onBack={goBack}
      onForward={goForward}
      onRefresh={refresh}
      onNavigate={navigateTo}
    />
  );

  const terminalPanel = (
    <Terminal
      variant="compact"
      lines={terminal}
      onCommand={runCommand}
      onClear={clearTerminal}
      accentColor={ACCENT}
    />
  );

  const codePanel = (
    <div className="flex flex-col h-full">
      <div
        className="flex-shrink-0 border-b border-zinc-800"
        style={{ maxHeight: "200px" }}>
        <div className="px-3 py-1.5 border-b border-zinc-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Explorer
          </span>
        </div>
        <div className="overflow-y-auto p-0.5" style={{ maxHeight: "170px" }}>
          <FileExplorer
            files={files}
            selectedFile={selectedFile}
            onSelect={selectFile}
            accentColor={ACCENT}
            variant="compact"
          />
        </div>
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
        <div className="flex-1 min-h-0">
          {activeTab === "code" && codePanel}
          {activeTab === "preview" && (
            <div className="h-full p-2">{previewPanel}</div>
          )}
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
        <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-zinc-800">
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className="flex-shrink-0 border-b border-zinc-800"
              style={{ maxHeight: "200px" }}>
              <div className="px-3 py-1.5 border-b border-zinc-800">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Explorer
                </span>
              </div>
              <div
                className="overflow-y-auto p-0.5"
                style={{ maxHeight: "170px" }}>
                <FileExplorer
                  files={files}
                  selectedFile={selectedFile}
                  onSelect={selectFile}
                  accentColor={ACCENT}
                  variant="compact"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 border-b border-zinc-800">
              <CodeEditor
                filename={selectedFile}
                content={fileContent}
                onSave={saveFile}
                accentColor={ACCENT}
              />
            </div>
          </div>
          <div className="h-40 flex-shrink-0">{terminalPanel}</div>
        </div>

        <div className="flex-1 min-w-0 p-3">{previewPanel}</div>
      </div>
    </div>
  );
}
