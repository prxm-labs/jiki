import { useState, useCallback } from "react";
import { useAIChatContainer } from "./hooks/useAIChatContainer";
import {
  AIChatPanel,
  BrowserWindow,
  FileExplorer,
  CodeEditor,
  PanelToggle,
  MobileTabBar,
  ChatIcon,
  PreviewIcon,
  FilesIcon,
  useMediaQuery,
} from "@run0/jiki-ui";
import type { InspectedElement } from "@run0/jiki-ui";
import { ApiKeyModal } from "./components/ApiKeyModal";

const ACCENT = "green" as const;

const MOBILE_TABS = [
  { id: "chat", label: "Chat", icon: <ChatIcon /> },
  { id: "preview", label: "Preview", icon: <PreviewIcon /> },
  { id: "files", label: "Files", icon: <FilesIcon /> },
];

export function Demo({ showHeader = true }: { showHeader?: boolean }) {
  const {
    messages,
    isBooted,
    isStreaming,
    htmlSrc,
    hasMore,
    needsApiKey,
    files,
    selectedFile,
    fileContent,
    filePaths,
    currentPath,
    canGoBack,
    canGoForward,
    sendMessage,
    loadMoreMessages,
    refresh,
    resetApiKey,
    handleApiKeySubmit,
    clearChat,
    selectFile,
    saveFile,
    navigateTo,
    goBack,
    goForward,
  } = useAIChatContainer();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [filesCollapsed, setFilesCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [inspectedElement, setInspectedElement] =
    useState<InspectedElement | null>(null);

  const handleInspectElement = useCallback((el: InspectedElement) => {
    setInspectedElement(el);
  }, []);

  const clearInspectedElement = useCallback(() => {
    setInspectedElement(null);
  }, []);

  if (needsApiKey) {
    return <ApiKeyModal onSubmit={handleApiKeySubmit} />;
  }

  if (!isBooted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-green-400" />
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
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
          OpenAI Coding
        </span>
        <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
          Astro + React &middot; GPT-5.4 Mini
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={clearChat}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-mono">
          Clear Chat
        </button>
        <span className="text-zinc-700 hidden sm:inline">|</span>
        <button
          onClick={resetApiKey}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-mono hidden sm:inline">
          Reset API Key
        </button>
      </div>
    </header>
  );

  const chatPanel = (
    <AIChatPanel
      messages={messages}
      onSendMessage={sendMessage}
      isStreaming={isStreaming}
      accentColor={ACCENT}
      title="Chat"
      modelLabel="GPT-5.4 Mini"
      onLoadMore={loadMoreMessages}
      hasMoreMessages={hasMore}
      filePaths={filePaths}
      inspectedElement={inspectedElement}
      onClearInspectedElement={clearInspectedElement}
    />
  );

  const previewPanel = (
    <BrowserWindow
      htmlSrc={htmlSrc}
      url={currentPath}
      port={4321}
      title="AstroDemo"
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onBack={goBack}
      onForward={goForward}
      onRefresh={refresh}
      onNavigate={navigateTo}
      onInspectElement={handleInspectElement}
    />
  );

  const filesPanel = (
    <div className="flex flex-col h-full">
      <div className="h-[180px] flex-shrink-0 border-b border-zinc-800 overflow-y-auto">
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
          {activeTab === "chat" && chatPanel}
          {activeTab === "preview" && (
            <div className="h-full p-2">{previewPanel}</div>
          )}
          {activeTab === "files" && filesPanel}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {header}

      <div className="flex-1 flex min-h-0">
        {/* Chat panel */}
        <div
          className={`flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${chatCollapsed ? "w-0" : "w-[420px]"}`}>
          <div className="w-[420px] h-full border-r border-zinc-800">
            {chatPanel}
          </div>
        </div>

        <PanelToggle
          collapsed={chatCollapsed}
          onClick={() => setChatCollapsed(c => !c)}
          label="Chat"
          accentColor={ACCENT}
        />

        {/* Files panel */}
        <div
          className={`flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${filesCollapsed ? "w-0" : "w-[320px]"}`}>
          <div className="w-[320px] h-full border-r border-zinc-800">
            {filesPanel}
          </div>
        </div>

        <PanelToggle
          collapsed={filesCollapsed}
          onClick={() => setFilesCollapsed(c => !c)}
          label="Files"
          accentColor={ACCENT}
        />

        {/* Preview */}
        <div className="flex-1 min-w-0 p-3">{previewPanel}</div>
      </div>
    </div>
  );
}
