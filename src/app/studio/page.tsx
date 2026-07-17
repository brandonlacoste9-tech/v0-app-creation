"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { SettingsDialog } from "@/components/settings-dialog";
import { GitHubPushDialog } from "@/components/github-push-dialog";
import { DeployDialog } from "@/components/deploy-dialog";
import { UpgradeModal } from "@/components/upgrade-modal";
import { SetupBanner } from "@/components/setup-banner";
import { CommandPalette, type CommandAction } from "@/components/command-palette";
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
  disconnectGitHub,
  ApiError,
} from "@/lib/api-client";
import type { Session, Message, CodeVersion, GitHubStatus, AppSettings, UserInfo } from "@/lib/types";
import { DEFAULT_SETTINGS, APP_THEMES } from "@/lib/types";
import { buildShareUrl } from "@/lib/share";
import { takeRemixPayload } from "@/lib/remix";
import { FREE_PROJECT_LIMIT } from "@/lib/limits";
import { extractStreamingCode, type StreamCodeState } from "@/lib/stream-code";
import {
  extractProjectFromResponse,
  serializeProject,
  mergeForPreview,
} from "@/lib/project-files";
import LZString from "lz-string";
import { toast } from "sonner";
import { StudioStatusBar } from "@/components/studio-status-bar";
import { listProjectFiles } from "@/lib/project-files";
import { checkpointLabel } from "@/lib/checkpoint";
import { Zap, Pencil, Check, X, Menu, Settings, MessageSquare, Eye, Code2, LogIn, GitBranch, Sparkles, Command } from "lucide-react";
import Image from "next/image";

/** Persist single or multi-file project from assistant message. */
function extractCodeBlock(text: string): string | null {
  const { project, isMulti } = extractProjectFromResponse(text);
  const entry = project.files[project.entry];
  if (!entry?.trim()) return null;
  if (isMulti || Object.keys(project.files).length > 1) {
    return serializeProject(project.files, project.entry);
  }
  return entry.trim();
}

const EMPTY_STREAM: StreamCodeState = {
  code: "",
  isComplete: false,
  hasFence: false,
  lineCount: 0,
  charCount: 0,
};

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
  const [githubAutoPush, setGithubAutoPush] = useState(false);
  const pendingGithubPush = useRef(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | undefined>();
  const [fullscreen, setFullscreen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview" | "code">("chat");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [limitToast, setLimitToast] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamCode, setStreamCode] = useState<StreamCodeState>(EMPTY_STREAM);
  const [commandOpen, setCommandOpen] = useState(false);
  const [remixToast, setRemixToast] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const prevVersionCount = useRef(0);
  const remixHandled = useRef(false);
  /** Last user prompt — used for checkpoint labels on the version timeline */
  const lastUserPromptRef = useRef<string>("");

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

  // Load sessions on mount + handle remix / upgrade query params
  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchGitHubStatus().then(setGithubStatus).catch(console.error);
    refreshUserInfo();
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      refreshUserInfo();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshUserInfo]);

  // Close mobile sidebar on session change, reset tab to chat
  useEffect(() => {
    setSidebarOpen(false);
    setMobileTab("chat");
  }, [activeSessionId]);

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

  // Listen for GitHub OAuth postMessage — then one-click continue push
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data === "github-connected") {
        fetchGitHubStatus()
          .then((s) => {
            setGithubStatus(s);
            if (pendingGithubPush.current) {
              pendingGithubPush.current = false;
              setGithubAutoPush(true);
              setGithubDialogOpen(true);
            }
          })
          .catch(console.error);
        refreshUserInfo();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshUserInfo]);

  const refreshSessions = useCallback(() => {
    fetchSessions().then(setSessions).catch(console.error);
  }, []);

  const showLimitError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && (err.upgrade || err.needsAuth)) {
        setLimitToast(
          err.message ||
            `Free plan includes ${FREE_PROJECT_LIMIT} projects. Upgrade for unlimited.`
        );
        setUpgradeModalOpen(true);
        setTimeout(() => setLimitToast(null), 5000);
        return;
      }
      const message = err instanceof Error ? err.message : "Could not create project";
      setLimitToast(message);
      setTimeout(() => setLimitToast(null), 4000);
    },
    []
  );

  // Remix from shared preview: create project + inject code as v1
  useEffect(() => {
    if (remixHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("remix") !== "1") return;
    remixHandled.current = true;
    window.history.replaceState({}, "", window.location.pathname);

    const payload = takeRemixPayload();
    if (!payload?.code) {
      setRemixToast("Nothing to remix — open a share link first.");
      setTimeout(() => setRemixToast(null), 4000);
      return;
    }

    const id = crypto.randomUUID();
    const title = payload.title?.slice(0, 80) || "Remixed project";
    (async () => {
      try {
        await createSession({ id, title, model: settings.model });
        const versionId = crypto.randomUUID();
        await saveVersion(id, {
          id: versionId,
          code: payload.code,
          title: title,
        });
        setActiveSessionId(id);
        setSettings((s) =>
          payload.theme ? { ...s, previewTheme: payload.theme! } : s
        );
        refreshSessions();
        refreshUserInfo();
        fetchMessages(id).then(setMessages).catch(console.error);
        fetchVersions(id).then(setVersions).catch(console.error);
        setRemixToast(`Remixed “${title}” — iterate in chat or ship to GitHub.`);
        setTimeout(() => setRemixToast(null), 5000);
      } catch (err) {
        showLimitError(err);
      }
    })();
  }, [settings.model, refreshSessions, refreshUserInfo, showLimitError]);

  const handleNewChat = useCallback(() => {
    const id = crypto.randomUUID();
    createSession({ id, title: "New project", model: settings.model })
      .then(() => {
        refreshSessions();
        refreshUserInfo();
        setActiveSessionId(id);
        setIsGenerating(false);
      })
      .catch(showLimitError);
  }, [settings.model, refreshSessions, refreshUserInfo, showLimitError]);

  // Keyboard: ⌘K palette, ⌘N new, ⌘, settings, F fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
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
      if (
        e.key === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !inField &&
        activeSessionId
      ) {
        setFullscreen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewChat, fullscreen, activeSessionId]);

  const handleNewSessionForLanding = useCallback(async (): Promise<string> => {
    const id = crypto.randomUUID();
    setActiveSessionId(id);
    try {
      await createSession({ id, title: "New project", model: settings.model });
      refreshSessions();
      refreshUserInfo();
      return id;
    } catch (err) {
      showLimitError(err);
      setActiveSessionId((cur) => (cur === id ? null : cur));
      throw err;
    }
  }, [settings.model, refreshSessions, refreshUserInfo, showLimitError]);

  /** Landing → session: create project, then auto-send via initialPrompt on the stable ChatPanel. */
  const handleBootstrapProject = useCallback(
    async (prompt: string) => {
      const id = crypto.randomUUID();
      setPendingPrompt(prompt);
      setActiveSessionId(id);
      setIsGenerating(true);
      setStreamText("");
      setStreamCode(EMPTY_STREAM);
      setMobileTab("preview");
      try {
        await createSession({ id, title: "New project", model: settings.model });
        refreshSessions();
        refreshUserInfo();
      } catch (err) {
        showLimitError(err);
        setActiveSessionId((cur) => (cur === id ? null : cur));
        setPendingPrompt(null);
        setIsGenerating(false);
        throw err;
      }
    },
    [settings.model, refreshSessions, refreshUserInfo, showLimitError]
  );

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

  const handleStreamStart = useCallback(() => {
    setIsGenerating(true);
    setStreamText("");
    setStreamCode(EMPTY_STREAM);
    // Jump to preview so the user watches the project build
    setMobileTab("preview");
  }, []);

  const handleUserPrompt = useCallback((prompt: string) => {
    lastUserPromptRef.current = prompt;
  }, []);

  const handleStreamDelta = useCallback((fullText: string) => {
    setStreamText(fullText);
    setStreamCode(extractStreamingCode(fullText));
  }, []);

  const handleClearPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  const handleStreamComplete = useCallback((fullText: string) => {
    setIsGenerating(false);
    setStreamText(fullText);
    const finalCode = extractStreamingCode(fullText);
    setStreamCode(finalCode);
    refreshUserInfo();
    const sid = activeSessionIdRef.current;
    if (sid) {
      fetchMessages(sid).then(setMessages).catch(console.error);
      const code = extractCodeBlock(fullText);
      if (code) {
        const extracted = extractTitle(fullText);
        const nextNum = versions.length + 1;
        const title = checkpointLabel(
          lastUserPromptRef.current,
          extracted,
          nextNum
        );
        const versionId = crypto.randomUUID();
        toast.success("Build complete", {
          description: `Checkpoint: ${title.slice(0, 48)}`,
          duration: 6000,
          action: {
            label: "Ship",
            onClick: () => setDeployDialogOpen(true),
          },
          cancel: {
            label: "Preview",
            onClick: () => {
              setMobileTab("preview");
              setFullscreen(false);
            },
          },
        });
        saveVersion(sid, {
          id: versionId,
          code,
          title,
          prompt: lastUserPromptRef.current || undefined,
        }).then(() => {
          fetchVersions(sid).then((v) => {
            // Attach client-side prompt for timeline tooltips when API omits it
            setVersions(
              v.map((ver) =>
                ver.id === versionId
                  ? { ...ver, prompt: lastUserPromptRef.current || ver.prompt }
                  : ver
              )
            );
            setStreamText("");
            setStreamCode(EMPTY_STREAM);
          }).catch(console.error);
          refreshSessions();
        });
      } else {
        toast.message("Generation finished", {
          description: "No code block detected — try a more specific UI prompt",
          duration: 4000,
        });
        setStreamText("");
        setStreamCode(EMPTY_STREAM);
      }
    } else {
      setStreamText("");
      setStreamCode(EMPTY_STREAM);
    }
  }, [refreshUserInfo, refreshSessions, versions.length]);

  const handleTitleUpdate = useCallback((title: string) => {
    // Session title is handled by the API, we just refresh to show it.
    if (title) refreshSessions();
  }, [refreshSessions]);

  const handleUpgradeNeeded = useCallback(() => {
    setUpgradeModalOpen(true);
  }, []);

  const handleConnectGitHub = useCallback(async () => {
    try {
      const { url } = await startGitHubAuth();
      window.open(url, "github-auth", "width=600,height=700,popup=yes");
    } catch (err) {
      console.error("Failed to start GitHub auth:", err);
      const message =
        err instanceof Error
          ? err.message
          : "GitHub OAuth not configured. Set GITHUB_CLIENT_ID / SECRET, or use a token.";
      setLimitToast(message);
      setTimeout(() => setLimitToast(null), 6000);
      // Open push dialog so founder can use PAT fallback
      setGithubAutoPush(false);
      setGithubDialogOpen(true);
    }
  }, []);

  /**
   * One-click ship path for end users:
   * - Not connected + OAuth ready → open GitHub authorize popup, then auto-push
   * - Already connected → open dialog and auto-push
   * - No OAuth → open dialog (PAT / setup message)
   */
  const handlePushToGitHub = useCallback(async () => {
    const code = versions[activeVersionIndex]?.code;
    if (!code?.trim()) {
      setLimitToast("Generate a UI first, then push to GitHub.");
      setTimeout(() => setLimitToast(null), 3500);
      return;
    }

    // Already connected → one-click push
    if (githubStatus?.connected) {
      setGithubAutoPush(true);
      setGithubDialogOpen(true);
      return;
    }

    // Prefer OAuth for end users
    const oauthReady =
      githubStatus?.oauthConfigured !== false; // undefined = try; false = skip
    if (oauthReady) {
      try {
        pendingGithubPush.current = true;
        const { url } = await startGitHubAuth();
        window.open(url, "github-auth", "width=600,height=700,popup=yes");
        setLimitToast("Authorize GitHub in the popup — we'll push automatically.");
        setTimeout(() => setLimitToast(null), 5000);
        return;
      } catch {
        pendingGithubPush.current = false;
        // Fall through to dialog (PAT / setup)
      }
    }

    setGithubAutoPush(false);
    setGithubDialogOpen(true);
  }, [versions, activeVersionIndex, githubStatus?.connected, githubStatus?.oauthConfigured]);

  const handleSignOut = useCallback(async () => {
    try {
      await disconnectGitHub();
      setGithubStatus(undefined);
      setUserInfo(null);
      refreshSessions();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  }, [refreshSessions]);

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

  const handleSelectTemplate = useCallback((prompt: string) => {
    if (!activeSessionId) {
      handleNewChat();
    }
    setPendingPrompt(prompt);
  }, [activeSessionId, handleNewChat]);

  // Download as ZIP — full Vite + React + Tailwind project (multi-file aware)
  const handleDownloadZip = useCallback(async () => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const slug = activeVersion.title.replace(/\s+/g, "-").toLowerCase();
    const { buildViteProjectFiles } = await import("@/lib/github-project");
    const files = buildViteProjectFiles({
      code: activeVersion.code,
      title: activeVersion.title,
      repoSlug: slug,
    });
    for (const f of files) {
      zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "adgenai-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [versions, activeVersionIndex]);

  const handleShareLink = useCallback(async () => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;
    try {
      const sessionTitle =
        sessions.find((s) => s.id === activeSessionId)?.title || "Shared preview";
      const url = buildShareUrl({
        code: activeVersion.code,
        title: activeVersion.title || sessionTitle,
        theme: settings.previewTheme,
      });
      await navigator.clipboard.writeText(url);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy share link:", err);
      setLimitToast("Could not copy share link");
      setTimeout(() => setLimitToast(null), 3000);
    }
  }, [versions, activeVersionIndex, settings.previewTheme, sessions, activeSessionId]);

  const [publishBusy, setPublishBusy] = useState(false);
  const handlePublish = useCallback(async () => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion?.code || publishBusy) return;
    setPublishBusy(true);
    try {
      const sessionTitle =
        sessions.find((s) => s.id === activeSessionId)?.title || activeVersion.title;
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionTitle,
          description: `Published from AdGenAI · ${activeVersion.title}`,
          code: activeVersion.code,
          theme: settings.previewTheme,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setRemixToast(`Published to showcase — open /gallery/${data.id}`);
      setTimeout(() => setRemixToast(null), 6000);
      if (data.id) {
        window.open(`/gallery/${data.id}`, "_blank");
      }
    } catch (err) {
      setLimitToast(err instanceof Error ? err.message : "Publish failed");
      setTimeout(() => setLimitToast(null), 4000);
    } finally {
      setPublishBusy(false);
    }
  }, [
    versions,
    activeVersionIndex,
    sessions,
    activeSessionId,
    settings.previewTheme,
    publishBusy,
  ]);

  const handleCommand = useCallback(
    (action: CommandAction) => {
      switch (action) {
        case "new-project":
          handleNewChat();
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "push-github":
          void handlePushToGitHub();
          break;
        case "deploy":
          setDeployDialogOpen(true);
          break;
        case "download-zip":
          void handleDownloadZip();
          break;
        case "share":
          void handleShareLink();
          break;
        case "publish":
          void handlePublish();
          break;
        case "gallery":
          window.open("/gallery", "_blank");
          break;
        case "fullscreen":
          setFullscreen((v) => !v);
          break;
        case "focus-chat":
          setMobileTab("chat");
          setFullscreen(false);
          break;
      }
    },
    [handleNewChat, handleDownloadZip, handleShareLink, handlePublish, handlePushToGitHub]
  );

  const handleShareToCodeSandbox = useCallback(() => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;

    const files = {
      "package.json": {
        content: JSON.stringify({
          dependencies: {
            "react": "^19.0.0",
            "react-dom": "^19.0.0",
            "lucide-react": "latest",
            "framer-motion": "latest",
            "clsx": "latest",
            "tailwind-merge": "latest"
          }
        }, null, 2)
      },
      "App.tsx": {
        content: activeVersion.code
      },
      "index.tsx": {
        content: `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
        `
      },
      "styles.css": {
        content: "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
      }
    };

    const parameters = LZString.compressToBase64(JSON.stringify({ files }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://codesandbox.io/api/v1/sandboxes/define";
    form.target = "_blank";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "parameters";
    input.value = parameters;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }, [versions, activeVersionIndex]);

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
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <SetupBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      {!fullscreen && (
        <div className="hidden md:block">
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
            onUpgrade={handleUpgradeNeeded}
            onSignIn={handleConnectGitHub}
            onSignOut={handleSignOut}
            onSelectTemplate={handleSelectTemplate}
          />
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border animate-slideIn">
            <Sidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              collapsed={false}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onToggleStar={handleToggleStar}
              onToggleCollapse={() => {}}
              onOpenSettings={() => { setSidebarOpen(false); setSettingsOpen(true); }}
              userInfo={userInfo}
              onUpgrade={handleUpgradeNeeded}
              onSignIn={() => { setSidebarOpen(false); handleConnectGitHub(); }}
              onSignOut={() => { setSidebarOpen(false); handleSignOut(); }}
              onClose={() => setSidebarOpen(false)}
              onSelectTemplate={(p) => { setSidebarOpen(false); handleSelectTemplate(p); }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile topbar */}
        {!fullscreen && (
          <div className="md:hidden flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur-md">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="mx-2 min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeSession?.title || "AdGenAI"}
              </p>
              {isGenerating && (
                <p className="text-[10px] font-medium text-orange-400">Building…</p>
              )}
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Desktop topbar — hidden on mobile and in fullscreen */}
        {!fullscreen && (
          <header className="hidden md:flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                onClick={() => { window.location.href = "/"; }}
                title="Home"
              >
                <Zap className="w-3.5 h-3.5 text-foreground" />
                <span className="font-bold text-xs uppercase tracking-tighter">adgenai</span>
                <span className="px-1 py-0.25 rounded bg-foreground/5 text-[8px] text-muted-foreground border border-border/50 font-mono">STUDIO</span>
              </div>
              <div className="w-px h-3 bg-border mx-1" />
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
                    <button onClick={startEditTitle} className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {githubStatus?.connected && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[8px] font-bold uppercase tracking-widest ml-1 border border-blue-500/20">
                      <GitBranch className="w-2.5 h-2.5" />
                      Linked
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-orange-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Command palette (⌘K)"
              >
                <Command className="h-3.5 w-3.5" />
                <span>Commands</span>
                <kbd className="rounded border border-border bg-background px-1 font-mono text-[9px]">⌘K</kbd>
              </button>
              {!userInfo?.connected ? (
                <button
                  onClick={handleConnectGitHub}
                  className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {userInfo.plan === "free" && (
                    <button
                      onClick={() => setUpgradeModalOpen(true)}
                      className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50"
                    >
                      <Sparkles className="w-3 h-3" />
                      Upgrade
                    </button>
                  )}
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => setSettingsOpen(true)}>
                    {userInfo.avatarUrl ? (
                      <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border">
                        <Image src={userInfo.avatarUrl} alt={userInfo.username || ""} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {userInfo.username?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground font-medium">{userInfo.username}</span>
                  </div>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main content */}
        <div className={`flex-1 overflow-hidden ${showPreview ? "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-7" : "md:pb-7"}`}>
          {fullscreen && showPreview ? (
            <PreviewPanel
              versions={versions}
              activeVersionIndex={activeVersionIndex}
              onVersionChange={setActiveVersionIndex}
              isGenerating={isGenerating}
              streamText={streamText}
              streamCode={streamCode}
              onPushToGitHub={handlePushToGitHub}
              onDeploy={() => setDeployDialogOpen(true)}
              onDownloadZip={handleDownloadZip}
              onDownloadHtml={handleDownloadHtml}
              onCodeEdit={handleCodeEdit}
              onRestoreVersion={handleRestoreVersion}
              onShareToCodeSandbox={handleShareToCodeSandbox}
              onShareLink={handleShareLink}
              shareLinkCopied={shareLinkCopied}
              onPublish={handlePublish}
              publishBusy={publishBusy}
              previewTheme={settings.previewTheme}
              onPreviewThemeChange={(id) => setSettings({ ...settings, previewTheme: id })}
              fullscreen
              onToggleFullscreen={() => setFullscreen(false)}
              userInfo={userInfo}
              onUpgrade={handleUpgradeNeeded}
            />
          ) : showPreview ? (
            <>
              {/* Desktop: side-by-side */}
              <div className="hidden md:flex h-full">
                {!fullscreen && (
                  <div className="w-[38%] min-w-[300px] max-w-[600px] border-r border-border">
                    <ChatPanel
                      key={activeSessionId}
                      sessionId={activeSessionId}
                      messages={messages}
                      onStreamComplete={handleStreamComplete}
                      onStreamStart={handleStreamStart}
                      onStreamDelta={handleStreamDelta}
                      provider={settings.provider}
                      model={settings.model}
                      apiKey={settings.apiKey}
                      ollamaUrl={settings.ollamaUrl}
                      temperature={settings.temperature}
                      onTitleUpdate={handleTitleUpdate}
                      latestCode={
                      versions.length > 0 ? versions[versions.length - 1].code : undefined
                    }
                      customSystemPrompt={settings.customSystemPrompt}
                      maxTokens={settings.maxTokens}
                      outputFormat={settings.outputFormat}
                      brandKit={settings.brandKit}
                      previewTheme={settings.previewTheme}
                      designStyle={settings.designStyle}
                      onDesignStyleChange={(id) =>
                        setSettings((s) => ({ ...s, designStyle: id }))
                      }
                      onUpgradeNeeded={handleUpgradeNeeded}
                      initialPrompt={pendingPrompt}
                      onClearPrompt={handleClearPrompt}
                      userInfo={userInfo}
                      onModelChange={(m) => setSettings((s) => ({ ...s, model: m }))}
                      onUserPrompt={handleUserPrompt}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <PreviewPanel
                    versions={versions}
                    activeVersionIndex={activeVersionIndex}
                    onVersionChange={setActiveVersionIndex}
                    isGenerating={isGenerating}
                    streamText={streamText}
                    streamCode={streamCode}
                    onPushToGitHub={handlePushToGitHub}
                    onDeploy={() => setDeployDialogOpen(true)}
                    onDownloadZip={handleDownloadZip}
                    onDownloadHtml={handleDownloadHtml}
                    onCodeEdit={handleCodeEdit}
                    onRestoreVersion={handleRestoreVersion}
                    onShareToCodeSandbox={handleShareToCodeSandbox}
                    onShareLink={handleShareLink}
                    shareLinkCopied={shareLinkCopied}
                    onPublish={handlePublish}
                    publishBusy={publishBusy}
                    previewTheme={settings.previewTheme}
                    onPreviewThemeChange={(id) => setSettings({ ...settings, previewTheme: id })}
                    fullscreen={false}
                    onToggleFullscreen={() => setFullscreen(true)}
                    userInfo={userInfo}
                    onUpgrade={handleUpgradeNeeded}
                  />
                </div>
              </div>

              {/* Mobile: single panel based on mobileTab */}
              <div className="md:hidden h-full">
                {mobileTab === "chat" ? (
                  <ChatPanel
                    key={activeSessionId}
                    sessionId={activeSessionId}
                    messages={messages}
                    onStreamComplete={handleStreamComplete}
                    onStreamStart={handleStreamStart}
                    onStreamDelta={handleStreamDelta}
                    provider={settings.provider}
                    model={settings.model}
                    apiKey={settings.apiKey}
                    ollamaUrl={settings.ollamaUrl}
                    temperature={settings.temperature}
                    onTitleUpdate={handleTitleUpdate}
                    latestCode={
                      versions.length > 0 ? versions[versions.length - 1].code : undefined
                    }
                    customSystemPrompt={settings.customSystemPrompt}
                    maxTokens={settings.maxTokens}
                    outputFormat={settings.outputFormat}
                    brandKit={settings.brandKit}
                    previewTheme={settings.previewTheme}
                    designStyle={settings.designStyle}
                    onDesignStyleChange={(id) =>
                      setSettings((s) => ({ ...s, designStyle: id }))
                    }
                    onUpgradeNeeded={handleUpgradeNeeded}
                    initialPrompt={pendingPrompt}
                    onClearPrompt={handleClearPrompt}
                    userInfo={userInfo}
                    onModelChange={(m) => setSettings((s) => ({ ...s, model: m }))}
                    onUserPrompt={handleUserPrompt}
                  />
                ) : (
                  <PreviewPanel
                    versions={versions}
                    activeVersionIndex={activeVersionIndex}
                    onVersionChange={setActiveVersionIndex}
                    isGenerating={isGenerating}
                    streamText={streamText}
                    streamCode={streamCode}
                    onPushToGitHub={handlePushToGitHub}
                    onDeploy={() => setDeployDialogOpen(true)}
                    onDownloadZip={handleDownloadZip}
                    onDownloadHtml={handleDownloadHtml}
                    onCodeEdit={handleCodeEdit}
                    onRestoreVersion={handleRestoreVersion}
                    onShareToCodeSandbox={handleShareToCodeSandbox}
                    onShareLink={handleShareLink}
                    shareLinkCopied={shareLinkCopied}
                    onPublish={handlePublish}
                    publishBusy={publishBusy}
                    previewTheme={settings.previewTheme}
                    onPreviewThemeChange={(id) => setSettings({ ...settings, previewTheme: id })}
                    fullscreen={false}
                    onToggleFullscreen={() => setFullscreen(true)}
                    userInfo={userInfo}
                    onUpgrade={handleUpgradeNeeded}
                    initialTab={mobileTab === "code" ? "code" : "preview"}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
                <ChatPanel
                  key="landing"
                  sessionId={null}
                  messages={[]}
                  onStreamComplete={handleStreamComplete}
                  onStreamStart={handleStreamStart}
                  onStreamDelta={handleStreamDelta}
                  provider={settings.provider}
                  model={settings.model}
                  apiKey={settings.apiKey}
                  ollamaUrl={settings.ollamaUrl}
                  temperature={settings.temperature}
                  onTitleUpdate={handleTitleUpdate}
                  onNewSession={handleNewSessionForLanding}
                  onBootstrapProject={handleBootstrapProject}
                  isLanding
                  customSystemPrompt={settings.customSystemPrompt}
                  maxTokens={settings.maxTokens}
                  outputFormat={settings.outputFormat}
                  brandKit={settings.brandKit}
                  previewTheme={settings.previewTheme}
                  designStyle={settings.designStyle}
                  onDesignStyleChange={(id) =>
                    setSettings((s) => ({ ...s, designStyle: id }))
                  }
                  onUpgradeNeeded={handleUpgradeNeeded}
                  initialPrompt={pendingPrompt}
                  onClearPrompt={handleClearPrompt}
                  userInfo={userInfo}
                  onModelChange={(m) => setSettings((s) => ({ ...s, model: m }))}
                  onUserPrompt={handleUserPrompt}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop workbench status bar */}
      {!fullscreen && (
        <div className="fixed bottom-0 left-0 right-0 z-20 hidden md:block">
          <StudioStatusBar
            model={settings.model}
            provider={settings.provider}
            userInfo={userInfo}
            githubStatus={githubStatus}
            isGenerating={isGenerating}
            hasProject={versions.length > 0}
            fileCount={
              versions.length > 0
                ? listProjectFiles(versions[versions.length - 1]?.code || "").length
                : 0
            }
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenUpgrade={() => setUpgradeModalOpen(true)}
            onConnectGitHub={handleConnectGitHub}
          />
        </div>
      )}

      {/* Mobile bottom tab bar — only when session is active */}
      {showPreview && !fullscreen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
          <div className="flex h-14 items-stretch px-1">
            {([
              { key: "chat" as const, icon: MessageSquare, label: "Chat" },
              { key: "preview" as const, icon: Eye, label: "Preview" },
              { key: "code" as const, icon: Code2, label: "Code" },
            ]).map(({ key, icon: Icon, label }) => {
              const active = mobileTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setMobileTab(key)}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-xl transition-all ${
                      active
                        ? "bg-orange-500/15 text-orange-400 shadow-[0_0_20px_-8px_rgba(249,115,22,0.5)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                  {active && (
                    <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-orange-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SettingsDialog
        key={`settings-${settingsOpen}`}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        userInfo={userInfo}
        onUpgrade={handleUpgradeNeeded}
      />

      <GitHubPushDialog
        open={githubDialogOpen}
        onClose={() => {
          setGithubDialogOpen(false);
          setGithubAutoPush(false);
        }}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "AdGenAI Project"}
        githubStatus={githubStatus}
        onConnectGitHub={() => {
          pendingGithubPush.current = true;
          void handleConnectGitHub();
        }}
        onDisconnect={() => fetchGitHubStatus().then(setGithubStatus)}
        onConnected={() => {
          fetchGitHubStatus()
            .then((s) => {
              setGithubStatus(s);
              // After PAT connect, one-click push
              setGithubAutoPush(true);
            })
            .catch(console.error);
          refreshUserInfo();
        }}
        autoPush={githubAutoPush}
      />

      <DeployDialog
        open={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "AdGenAI Project"}
        githubStatus={githubStatus}
        onConnectGitHub={handleConnectGitHub}
      />

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onAction={handleCommand}
        hasCode={Boolean(versions[activeVersionIndex]?.code)}
        githubConnected={Boolean(githubStatus?.connected)}
      />

      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => { setUpgradeModalOpen(false); }}
        needsAuth={!userInfo?.connected}
        userInfo={userInfo}
      />

      {limitToast && (
        <div className="fixed bottom-16 md:bottom-6 left-1/2 z-[60] -translate-x-1/2 max-w-md px-4">
          <div className="rounded-lg border border-amber-500/30 bg-card px-4 py-3 text-sm text-foreground shadow-lg">
            <p className="font-medium text-amber-400">Project limit</p>
            <p className="mt-0.5 text-muted-foreground">{limitToast}</p>
          </div>
        </div>
      )}

      {remixToast && (
        <div className="fixed bottom-16 md:bottom-6 left-1/2 z-[60] -translate-x-1/2 max-w-md px-4">
          <div className="rounded-lg border border-emerald/30 bg-card px-4 py-3 text-sm text-foreground shadow-lg">
            <p className="font-medium text-emerald">Remix ready</p>
            <p className="mt-0.5 text-muted-foreground">{remixToast}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function buildExportHtml(code: string): string {
  const merged = code.trim().startsWith("{") ? mergeForPreview(code) : code;
  const cleaned = merged
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
