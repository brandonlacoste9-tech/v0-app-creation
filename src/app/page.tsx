"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { SettingsDialog } from "@/components/settings-dialog";
import { GitHubPushDialog } from "@/components/github-push-dialog";
import {
  fetchSessions,
  createSession,
  updateSession,
  deleteSession,
  saveVersion,
  updateVersion as apiUpdateVersion,
  fetchMessages,
  fetchVersions,
  fetchGitHubStatus,
  startGitHubAuth,
} from "@/lib/api-client";
import type { Session, Message, CodeVersion, GitHubStatus, AppSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { Zap, Pencil, Check, X } from "lucide-react";

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function extractTitle(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim();
  return cleaned.length > 0 && cleaned.length < 80 ? cleaned : "Generated Component";
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [versions, setVersions] = useState<CodeVersion[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | undefined>();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const prevVersionCount = useRef(0);

  activeSessionIdRef.current = activeSessionId;

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      const listener = (e: MediaQueryListEvent) => root.classList.toggle("dark", e.matches);
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    } else {
      root.classList.toggle("dark", settings.theme === "dark");
    }
  }, [settings.theme]);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchGitHubStatus().then(setGithubStatus).catch(console.error);
  }, []);

  // Load messages and versions when session changes
  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId).then(setMessages).catch(console.error);
      fetchVersions(activeSessionId).then(setVersions).catch(console.error);
    } else {
      setMessages([]);
      setVersions([]);
    }
  }, [activeSessionId]);

  // Keep version index at latest
  useEffect(() => {
    if (versions.length !== prevVersionCount.current) {
      prevVersionCount.current = versions.length;
      if (versions.length > 0) setActiveVersionIndex(versions.length - 1);
      else setActiveVersionIndex(0);
    }
  }, [versions.length]);

  // Listen for GitHub OAuth postMessage
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data === "github-connected") {
        fetchGitHubStatus().then(setGithubStatus).catch(console.error);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const refreshSessions = useCallback(() => {
    fetchSessions().then(setSessions).catch(console.error);
  }, []);

  const handleNewChat = useCallback(() => {
    const id = crypto.randomUUID();
    createSession({ id, title: "New chat", model: settings.model }).then(() => {
      refreshSessions();
      setActiveSessionId(id);
      setIsGenerating(false);
    });
  }, [settings.model, refreshSessions]);

  const handleNewSessionForLanding = useCallback((): string => {
    const id = crypto.randomUUID();
    createSession({ id, title: "New chat", model: settings.model }).then(() => refreshSessions());
    setActiveSessionId(id);
    return id;
  }, [settings.model, refreshSessions]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setIsGenerating(false);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id).then(() => {
      refreshSessions();
      if (activeSessionIdRef.current === id) setActiveSessionId(null);
    });
  }, [refreshSessions]);

  const handleToggleStar = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      updateSession(id, { starred: !session.starred } as Partial<Session>).then(() => refreshSessions());
    }
  }, [sessions, refreshSessions]);

  const handleRename = useCallback((title: string) => {
    if (activeSessionIdRef.current) {
      updateSession(activeSessionIdRef.current, { title } as Partial<Session>).then(() => refreshSessions());
    }
  }, [refreshSessions]);

  const handleStreamStart = useCallback(() => setIsGenerating(true), []);

  const handleStreamComplete = useCallback((fullText: string) => {
    setIsGenerating(false);
    const sid = activeSessionIdRef.current;
    if (sid) {
      fetchMessages(sid).then(setMessages).catch(console.error);
      const code = extractCodeBlock(fullText);
      if (code) {
        const title = extractTitle(fullText);
        const versionId = crypto.randomUUID();
        saveVersion(sid, { id: versionId, code, title }).then(() => {
          fetchVersions(sid).then(setVersions).catch(console.error);
        });
      }
    }
  }, []);

  const handleTitleUpdate = useCallback((title: string) => {
    refreshSessions();
  }, [refreshSessions]);

  const handleConnectGitHub = useCallback(async () => {
    try {
      const { url } = await startGitHubAuth();
      window.open(url, "github-auth", "width=600,height=700,popup=yes");
    } catch (err) {
      console.error("Failed to start GitHub auth:", err);
    }
  }, []);

  const handleCodeEdit = useCallback((versionId: string, code: string) => {
    const sid = activeSessionIdRef.current;
    if (sid) {
      apiUpdateVersion(sid, versionId, code).then(() => {
        fetchVersions(sid).then(setVersions).catch(console.error);
      });
    }
  }, []);

  // Restore an older version as a new version
  const handleRestoreVersion = useCallback((index: number) => {
    const sid = activeSessionIdRef.current;
    const version = versions[index];
    if (!sid || !version) return;
    const versionId = crypto.randomUUID();
    saveVersion(sid, { id: versionId, code: version.code, title: `${version.title} (restored)` }).then(() => {
      fetchVersions(sid).then(setVersions).catch(console.error);
    });
  }, [versions]);

  // Download as ZIP
  const handleDownloadZip = useCallback(async () => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("src/Component.tsx", activeVersion.code);
    zip.file("index.html", buildExportHtml(activeVersion.code));
    zip.file("README.md", `# ${activeVersion.title}\n\nGenerated with [adgenai](https://adgenai.vercel.app)\n\n## Usage\n\nOpen \`index.html\` in your browser to view the component.\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeVersion.title.replace(/\s+/g, "-").toLowerCase()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [versions, activeVersionIndex]);

  // Download as standalone HTML
  const handleDownloadHtml = useCallback(() => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;
    const html = buildExportHtml(activeVersion.code);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeVersion.title.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [versions, activeVersionIndex]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const showPreview = activeSession !== null;

  const startEditTitle = () => {
    setEditTitleValue(activeSession?.title ?? "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 50);
  };

  const commitTitle = () => {
    if (editTitleValue.trim()) handleRename(editTitleValue.trim());
    setEditingTitle(false);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        collapsed={settings.sidebarCollapsed}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onToggleStar={handleToggleStar}
        onToggleCollapse={() => setSettings({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-foreground" />
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  ref={titleInputRef}
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="bg-muted border border-ring rounded px-2 py-0.5 text-sm text-foreground outline-none w-48"
                  autoFocus
                />
                <button onClick={commitTitle} className="p-1 text-muted-foreground hover:text-foreground"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingTitle(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-foreground font-medium text-sm">{activeSession?.title ?? "adgenai"}</span>
                {activeSession && (
                  <button onClick={startEditTitle} className="p-1 text-muted-foreground hover:text-foreground opacity-0 hover:opacity-100 transition-opacity">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {showPreview ? (
            <div className="flex h-full">
              <div className="w-[38%] min-w-[300px] max-w-[600px] border-r border-border">
                <ChatPanel
                  key={activeSessionId}
                  sessionId={activeSessionId}
                  messages={messages}
                  onStreamComplete={handleStreamComplete}
                  onStreamStart={handleStreamStart}
                  provider={settings.provider}
                  model={settings.model}
                  apiKey={settings.apiKey}
                  ollamaUrl={settings.ollamaUrl}
                  temperature={settings.temperature}
                  onTitleUpdate={handleTitleUpdate}
                  latestCode={versions.length > 0 ? versions[versions.length - 1].code : undefined}
                  customSystemPrompt={settings.customSystemPrompt}
                  maxTokens={settings.maxTokens}
                  outputFormat={settings.outputFormat}
                  brandKit={settings.brandKit}
                />
              </div>
              <div className="flex-1 min-w-0">
                <PreviewPanel
                  versions={versions}
                  activeVersionIndex={activeVersionIndex}
                  onVersionChange={setActiveVersionIndex}
                  isGenerating={isGenerating}
                  onPushToGitHub={() => setGithubDialogOpen(true)}
                  onDownloadZip={handleDownloadZip}
                  onDownloadHtml={handleDownloadHtml}
                  onCodeEdit={handleCodeEdit}
                  onRestoreVersion={handleRestoreVersion}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
                <ChatPanel
                  key="landing"
                  sessionId={null}
                  messages={[]}
                  onStreamComplete={handleStreamComplete}
                  onStreamStart={handleStreamStart}
                  provider={settings.provider}
                  model={settings.model}
                  apiKey={settings.apiKey}
                  ollamaUrl={settings.ollamaUrl}
                  temperature={settings.temperature}
                  onTitleUpdate={handleTitleUpdate}
                  onNewSession={handleNewSessionForLanding}
                  isLanding
                  customSystemPrompt={settings.customSystemPrompt}
                  maxTokens={settings.maxTokens}
                  outputFormat={settings.outputFormat}
                  brandKit={settings.brandKit}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <GitHubPushDialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "adgenai-project"}
        githubStatus={githubStatus}
        onConnectGitHub={handleConnectGitHub}
        onDisconnect={() => fetchGitHubStatus().then(setGithubStatus)}
      />
    </div>
  );
}

function buildExportHtml(code: string): string {
  const cleaned = code
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>adgenai Component</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body{background:#0a0a0a;color:#f2f2f2;font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:16px;min-height:100vh}*{box-sizing:border-box}</style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script type="text/babel">
    const{useState,useEffect,useRef,useCallback,useMemo,useReducer}=React;
    ${cleaned}
    const R=typeof Component!=='undefined'?Component:(typeof App!=='undefined'?App:()=>React.createElement('div',null,'Component'));
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(R));
  <\/script>
</body>
</html>`;
}
