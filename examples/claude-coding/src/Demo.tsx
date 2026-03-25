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

const ACCENT = "blue" as const;

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
    sendMessage,
    loadMoreMessages,
    refresh,
    resetApiKey,
    handleApiKeySubmit,
    clearChat,
    selectFile,
    saveFile,
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
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
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
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Claude Coding
        </span>
        <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
          Claude Opus 4.6
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
      modelLabel="Claude Opus 4.6"
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
      url="/"
      canGoBack={false}
      canGoForward={false}
      onBack={() => {}}
      onForward={() => {}}
      onRefresh={refresh}
      onNavigate={() => {}}
      title="AI Preview"
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
