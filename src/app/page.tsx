"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { SettingsDialog } from "@/components/settings-dialog";
import { GitHubPushDialog } from "@/components/github-push-dialog";
import { DeployDialog } from "@/components/deploy-dialog";
import { UpgradeModal } from "@/components/upgrade-modal";
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
import type { Session, Message, CodeVersion, GitHubStatus, AppSettings, UserInfo } from "@/lib/types";
import { DEFAULT_SETTINGS, APP_THEMES } from "@/lib/types";
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
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | undefined>();
  const [fullscreen, setFullscreen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeNeedsAuth, setUpgradeNeedsAuth] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const prevVersionCount = useRef(0);

  activeSessionIdRef.current = activeSessionId;

  // Apply app theme via CSS variables
  useEffect(() => {
    const theme = APP_THEMES.find((t) => t.id === settings.appTheme) ?? APP_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--foreground", theme.foreground);
    root.style.setProperty("--card", theme.card);
    root.style.setProperty("--card-foreground", theme.cardForeground);
    root.style.setProperty("--border", theme.border);
    root.style.setProperty("--muted", theme.muted);
    root.style.setProperty("--muted-foreground", theme.mutedForeground);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-foreground", theme.accentForeground);
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--primary-foreground", theme.primaryForeground);
    root.style.setProperty("--ring", theme.ring);
    root.style.setProperty("--destructive", theme.destructive);
    root.style.setProperty("--destructive-foreground", theme.destructiveForeground);
    root.style.setProperty("--emerald", theme.emerald);
    root.style.setProperty("--scroll-thumb", theme.scrollThumb);
    root.style.setProperty("--scroll-thumb-hover", theme.scrollThumbHover);
    root.style.setProperty("--token-keyword", theme.tokenKeyword);
    root.style.setProperty("--token-string", theme.tokenString);
    root.style.setProperty("--token-comment", theme.tokenComment);
    root.style.setProperty("--token-tag", theme.tokenTag);
    root.style.setProperty("--token-function", theme.tokenFunction);
    root.style.setProperty("--token-number", theme.tokenNumber);
  }, [settings.appTheme]);

  const refreshUserInfo = useCallback(() => {
    fetch("/api/user").then((r) => r.json()).then(setUserInfo).catch(console.error);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchGitHubStatus().then(setGithubStatus).catch(console.error);
    refreshUserInfo();
    // Check ?upgraded=true query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      refreshUserInfo();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshUserInfo]);

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
        refreshUserInfo();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshUserInfo]);

  const refreshSessions = useCallback(() => {
    fetchSessions().then(setSessions).catch(console.error);
  }, []);

  const handleNewChat = useCallback(() => {
    const id = crypto.randomUUID();
    createSession({ id, title: "New project", model: settings.model }).then(() => {
      refreshSessions();
      setActiveSessionId(id);
      setIsGenerating(false);
    });
  }, [settings.model, refreshSessions]);

  // Keyboard shortcuts: Cmd+N (new project), Cmd+, (settings), Escape (exit fullscreen), f (toggle fullscreen)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && tag !== "input" && tag !== "textarea" && tag !== "select" && activeSessionId) {
        setFullscreen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewChat, fullscreen, activeSessionId]);

  const handleNewSessionForLanding = useCallback((): string => {
    const id = crypto.randomUUID();
    createSession({ id, title: "New project", model: settings.model }).then(() => refreshSessions());
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

  const handleUpgradeNeeded = useCallback((needsAuth: boolean) => {
    setUpgradeNeedsAuth(needsAuth);
    setUpgradeModalOpen(true);
  }, []);

  const handleConnectGitHub = useCallback(async () => {
    try {
      const { url } = await startGitHubAuth();
      window.open(url, "github-auth", "width=600,height=700,popup=yes");
    } catch (err) {
      console.error("Failed to start GitHub auth:", err);
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

  const handleCodeEdit = useCallback((versionId: string, code: string) => {
    const sid = activeSessionIdRef.current;
    if (sid) {
      apiUpdateVersion(sid, versionId, code).then(() => {
        fetchVersions(sid).then(setVersions).catch(console.error);
      });
    }
  }, []);

  // Download as ZIP — full Vite + React + Tailwind project
  const handleDownloadZip = useCallback(async () => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const slug = activeVersion.title.replace(/\s+/g, "-").toLowerCase();

    zip.file("src/Component.tsx", activeVersion.code);
    zip.file("src/main.tsx", `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport Component from "./Component";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <Component />\n  </React.StrictMode>\n);\n`);
    zip.file("src/index.css", `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);
    zip.file("index.html", `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${activeVersion.title}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`);
    zip.file("package.json", JSON.stringify({
      name: slug,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        autoprefixer: "^10.4.16",
        postcss: "^8.4.32",
        tailwindcss: "^3.4.0",
        typescript: "^5.3.0",
        vite: "^5.0.0",
      },
    }, null, 2) + "\n");
    zip.file("tsconfig.json", JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
      },
      include: ["src"],
    }, null, 2) + "\n");
    zip.file("vite.config.ts", `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`);
    zip.file("tailwind.config.js", `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n`);
    zip.file("postcss.config.js", `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`);
    zip.file("README.md", `# ${activeVersion.title}\n\nGenerated with [AdGenAI](https://www.adgenai.ca)\n\n## Quick Start\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Stack\n- React 18 + TypeScript\n- Tailwind CSS\n- Vite\n`);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.zip`;
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
      {!fullscreen && (
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
          userInfo={userInfo}
          onUpgrade={() => handleUpgradeNeeded(!userInfo?.connected)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar — hidden in fullscreen */}
        {!fullscreen && (
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
                  <span className="text-foreground font-medium text-sm">{activeSession?.title ?? "AdGenAI"}</span>
                  {activeSession && (
                    <button onClick={startEditTitle} className="p-1 text-muted-foreground hover:text-foreground opacity-0 hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {fullscreen && showPreview ? (
            <PreviewPanel
              versions={versions}
              activeVersionIndex={activeVersionIndex}
              onVersionChange={setActiveVersionIndex}
              isGenerating={isGenerating}
              onPushToGitHub={() => setGithubDialogOpen(true)}
              onDeploy={() => setDeployDialogOpen(true)}
              onDownloadZip={handleDownloadZip}
              onDownloadHtml={handleDownloadHtml}
              onCodeEdit={handleCodeEdit}
              onRestoreVersion={handleRestoreVersion}
              previewTheme={settings.previewTheme}
              onPreviewThemeChange={(id) => setSettings({ ...settings, previewTheme: id })}
              fullscreen
              onToggleFullscreen={() => setFullscreen(false)}
              userInfo={userInfo}
              onUpgrade={() => handleUpgradeNeeded(!userInfo?.connected)}
            />
          ) : showPreview ? (
            <div className="flex h-full">
              {!fullscreen && (
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
                    previewTheme={settings.previewTheme}
                    onUpgradeNeeded={handleUpgradeNeeded}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <PreviewPanel
                  versions={versions}
                  activeVersionIndex={activeVersionIndex}
                  onVersionChange={setActiveVersionIndex}
                  isGenerating={isGenerating}
                  onPushToGitHub={() => setGithubDialogOpen(true)}
                  onDeploy={() => setDeployDialogOpen(true)}
                  onDownloadZip={handleDownloadZip}
                  onDownloadHtml={handleDownloadHtml}
                  onCodeEdit={handleCodeEdit}
                  onRestoreVersion={handleRestoreVersion}
                  previewTheme={settings.previewTheme}
                  onPreviewThemeChange={(id) => setSettings({ ...settings, previewTheme: id })}
                  fullscreen={false}
                  onToggleFullscreen={() => setFullscreen(true)}
                  userInfo={userInfo}
                  onUpgrade={() => handleUpgradeNeeded(!userInfo?.connected)}
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
                  previewTheme={settings.previewTheme}
                  onUpgradeNeeded={handleUpgradeNeeded}
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
        userInfo={userInfo}
        onUpgrade={() => { setSettingsOpen(false); handleUpgradeNeeded(!userInfo?.connected); }}
      />

      <GitHubPushDialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "AdGenAI Project"}
        githubStatus={githubStatus}
        onConnectGitHub={handleConnectGitHub}
        onDisconnect={() => fetchGitHubStatus().then(setGithubStatus)}
      />

      <DeployDialog
        open={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "AdGenAI Project"}
        githubStatus={githubStatus}
        onConnectGitHub={handleConnectGitHub}
      />

      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => { setUpgradeModalOpen(false); setUpgradeNeedsAuth(false); }}
        needsAuth={upgradeNeedsAuth}
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
  <title>AdGenAI Component</title>
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
