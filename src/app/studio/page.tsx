"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  startGoogleAuth,
  disconnectGitHub,
  ApiError,
} from "@/lib/api-client";
import { SignInMenu } from "@/components/sign-in-menu";
import { UserMenu } from "@/components/user-menu";
import type { Session, Message, CodeVersion, GitHubStatus, AppSettings, UserInfo } from "@/lib/types";
import { DEFAULT_SETTINGS, APP_THEMES } from "@/lib/types";
import { loadSettings, saveSettings } from "@/lib/settings-storage";
import { buildShareUrl } from "@/lib/share";
import { takeRemixPayload } from "@/lib/remix";
import { FREE_PROJECT_LIMIT } from "@/lib/limits";
import { planDisplayName } from "@/lib/plans";
import { isPaidPlanId } from "@/lib/pricing";
import { extractStreamingCode, type StreamCodeState } from "@/lib/stream-code";
import {
  serializeProject,
  mergeForPreview,
  listProjectFiles,
  classifyStreamFiles,
} from "@/lib/project-files";
import {
  formatIntegrityToast,
  validateGeneration,
} from "@/lib/gen-integrity";
import { analyzeSourceTruncation, looksLikeTruncationCompileError } from "@/lib/code-truncation";
import {
  runStaticPreviewQa,
  mergeLiveIntoReport,
  scoreLabel,
  buildFixFromQaPrompt,
  buildContinueTruncationPrompt,
  shouldSuggestFix,
  type PreviewQaReport,
  type LiveQaPayload,
} from "@/lib/browser";
import LZString from "lz-string";
import { toast } from "sonner";
import { StudioStatusBar } from "@/components/studio-status-bar";
import { checkpointLabel } from "@/lib/checkpoint";
import { compareVersionCodes } from "@/lib/iteration-diff";
import { Pencil, Check, X, Menu, Settings, MessageSquare, Eye, Code2, GitBranch, Sparkles, Command } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { ShipboardLogo } from "@/components/shipboard-logo";
import { TelemetryPanel } from "@/components/telemetry-panel";
import { emitPreviewMetric, subscribePreviewMetrics } from "@/lib/preview-metrics";
import { readRebuildUrlFromSearch } from "@/lib/rebuild-prompt";
import { attachCommerceFilesToCode } from "@/lib/commerce";
import {
  STORE_AUTOGEN_KEY,
  type StoreAutogenPayload,
  type StoreBrief,
} from "@/lib/commerce/store-brief";
import { deriveShortTitle } from "@/lib/gallery-title";
import {
  buildContinueRepairPrompt,
  checkpointProgressTitle,
  completeFilesSignature,
  isContinueRepairPrompt,
  mergeCheckpointRepair,
  readTruncatedPaths,
  serializeCheckpoint,
} from "@/lib/file-checkpoint";

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

/** 403/404 on session artifacts is a race or stale id — not a crash. */
function ignoreMissingSession(err: unknown) {
  if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
    return;
  }
  console.error(err);
}

export default function Home() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [versions, setVersions] = useState<CodeVersion[]>([]);
  /**
   * Truncation verdict for the just-finished generation, set synchronously in
   * handleStreamComplete. Covers the window where the new assistant message
   * is rendered but versions haven't refetched yet — without it the code chip
   * flashes a false "UI ready" on a truncated generation. Cleared as soon as
   * versions update, when latestVersionTruncated becomes authoritative.
   */
  const [pendingTruncated, setPendingTruncated] = useState<boolean | null>(null);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
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
  const [pendingStoreBrief, setPendingStoreBrief] = useState<StoreBrief | null>(
    null
  );
  const [rebuildFromQuery, setRebuildFromQuery] = useState<string | null>(null);
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
  /** Code used as iteration base for the in-flight generation (active version at send). */
  const baseCodeRef = useRef<string | undefined>(undefined);
  /** Version number (1-based) that the current gen is iterating from. */
  const baseVersionNumRef = useRef<number | null>(null);
  /** Last browser QA — for Fix-from-QA chip */
  const [lastQaReport, setLastQaReport] = useState<PreviewQaReport | null>(null);
  const [pendingFixPrompt, setPendingFixPrompt] = useState<string | null>(null);
  /** True after user chose Continue on a truncated gen — emit continue_completed on next success */
  const continueInFlightRef = useRef(false);
  /** Version ids that already got a Continue nudge (generation-time or preview-error) — one nudge per version */
  const continueNudgeShownRef = useRef<Set<string>>(new Set());
  /** Mirrors for the preview-error listener (avoids stale closures) */
  const activeVersionIdRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);
  /** Latest handleContinueGeneration for the stable preview-error listener */
  const handleContinueGenerationRef = useRef<(source?: string) => void>(() => {});
  /** Latest truncation check for the stable preview-error listener */
  const getTruncationStateRef = useRef<() => boolean>(() => false);
  /** Global throttle: at most one preview-error nudge per 30s */
  const lastPreviewNudgeAtRef = useRef(0);
  const versionsRef = useRef(versions);
  /** In-flight per-file checkpoint. One version row, patched as fences close. */
  const liveCheckpointRef = useRef<{
    versionId: string | null;
    sig: string;
    chain: Promise<void>;
    closed: boolean;
    created: boolean;
  }>({ versionId: null, sig: "", chain: Promise.resolve(), closed: false, created: false });
  /** Free Continue repairs used per truncated version id (cap 3). */
  const continueAttemptsRef = useRef<Map<string, number>>(new Map());

  /** Block a 4th+ free Continue repair on the same truncated version. */
  const checkContinueCap = useCallback((versionId: string | null | undefined): boolean => {
    if (!versionId) return false;
    if ((continueAttemptsRef.current.get(versionId) || 0) >= 3) {
      toast.message("Continue limit reached for this version", {
        description:
          "Three free repairs were already used here. Raise Max tokens or regenerate for a fresh full build.",
        duration: 9000,
      });
      return true;
    }
    return false;
  }, []);

  activeSessionIdRef.current = activeSessionId;
  isGeneratingRef.current = isGenerating;
  versionsRef.current = versions;
  activeVersionIdRef.current =
    versions[Math.min(activeVersionIndex, versions.length - 1)]?.id ?? null;

  /** Active version is the iterate / ship base — not always the last save. */
  const activeCode =
    versions.length > 0
      ? versions[Math.min(activeVersionIndex, versions.length - 1)]?.code
      : undefined;
  const baseVersionLabel =
    versions.length > 0
      ? activeVersionIndex === versions.length - 1
        ? `v${activeVersionIndex + 1} (latest)`
        : `v${activeVersionIndex + 1}`
      : undefined;

  /** Latest saved version still truncated? The code chip on the newest
   * assistant message reads "Needs Continue" instead of "UI ready" then.
   * Falls back to a structural scan for legacy versions saved before the
   * per-file truncated list existed. */
  const latestVersionTruncated = useMemo(() => {
    const code = versions.length > 0 ? versions[versions.length - 1]?.code : "";
    if (!code?.trim()) return false;
    if (readTruncatedPaths(code).length > 0) return true;
    try {
      const joined = listProjectFiles(code)
        .map((f) => f.content)
        .join("\n");
      return analyzeSourceTruncation(joined).likelyTruncated;
    } catch {
      return false;
    }
  }, [versions]);

  // Hydrate studio settings (design style, model, theme, …) from localStorage
  useEffect(() => {
    setSettings(loadSettings());
    setSettingsHydrated(true);
  }, []);

  // Persist settings after hydration so we never clobber with defaults
  useEffect(() => {
    if (!settingsHydrated) return;
    saveSettings(settings);
  }, [settings, settingsHydrated]);

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
    const rebuild = readRebuildUrlFromSearch(window.location.search);
    if (rebuild) {
      setRebuildFromQuery(rebuild);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const projectId = params.get("p");
    if (projectId && /^[0-9a-f-]{8,}$/i.test(projectId)) {
      setActiveSessionId(projectId);
      try {
        const raw = sessionStorage.getItem(STORE_AUTOGEN_KEY);
        const payload = raw ? (JSON.parse(raw) as StoreAutogenPayload) : null;
        if (payload?.sessionId === projectId && payload.prompt) {
          setPendingPrompt(payload.prompt);
          setPendingStoreBrief(payload.storeBrief || null);
          if (payload.designStyle) {
            setSettings((s) => ({ ...s, designStyle: payload.designStyle }));
          }
          sessionStorage.removeItem(STORE_AUTOGEN_KEY);
        }
      } catch {
        /* ignore */
      }
    }
    if (params.get("upgraded") === "true") {
      const rawPlan = params.get("plan") || "";
      const label = isPaidPlanId(rawPlan)
        ? planDisplayName(rawPlan)
        : "your plan";
      refreshUserInfo();
      toast.success(`Welcome to ${label}`, {
        description: "Your subscription is active. Higher limits unlock immediately.",
        duration: 6000,
      });
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
    if (!activeSessionId) {
      setMessages([]);
      setVersions([]);
      return;
    }
    const id = activeSessionId;
    let cancelled = false;
    Promise.all([
      fetchMessages(id).catch((err) => {
        ignoreMissingSession(err);
        return [] as Message[];
      }),
      fetchVersions(id).catch((err) => {
        ignoreMissingSession(err);
        return [] as CodeVersion[];
      }),
    ]).then(([msgs, vers]) => {
      if (cancelled) return;
      setMessages(msgs);
      setVersions(vers);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  // Keep version index at latest
  useEffect(() => {
    if (versions.length !== prevVersionCount.current) {
      prevVersionCount.current = versions.length;
      if (versions.length > 0) setActiveVersionIndex(versions.length - 1);
      else setActiveVersionIndex(0);
    }
  }, [versions.length]);

  // Versions caught up (new array identity on every setVersions, even when a
  // save patches the live-checkpoint row in place): the pending truncation
  // verdict is stale and latestVersionTruncated is authoritative again.
  useEffect(() => {
    setPendingTruncated(null);
  }, [versions]);

  // Truncation card buttons inside the preview iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const d = event.data;
      if (!d || d.type !== "shipboard-preview-action") return;
      if (d.action === "continue") {
        const list = versionsRef.current;
        const id = activeVersionIdRef.current;
        const vid = list.find((v) => v.id === id)?.id || list[list.length - 1]?.id;
        if (checkContinueCap(vid)) return;
        continueInFlightRef.current = true;
        emitPreviewMetric("continue_clicked", { source: "iframe_card" });
        setSettings((s) => ({ ...s, chatCollapsed: false }));
        const code = list.find((v) => v.id === id)?.code || list[list.length - 1]?.code || "";
        setPendingFixPrompt(
          readTruncatedPaths(code).length
            ? buildContinueRepairPrompt(code)
            : buildContinueTruncationPrompt()
        );
        setMobileTab("chat");
        toast.message("Continue ready in chat", {
          description: "Send the prefilled prompt to finish incomplete files.",
          duration: 5000,
        });
      } else if (d.action === "settings_tokens") {
        setSettingsOpen(true);
      } else if (d.action === "regenerate") {
        setSettings((s) => ({ ...s, chatCollapsed: false }));
        setMobileTab("chat");
        toast.message("Regenerate from chat", {
          description: "Describe the UI again, or raise Max tokens in Settings first.",
          duration: 6000,
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkContinueCap]);

  // Listen for OAuth postMessage (GitHub / Google)
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
        toast.success("Signed in with GitHub");
      }
      const googleOk =
        event.data === "google-connected" ||
        (event.data &&
          typeof event.data === "object" &&
          (event.data as { type?: string; provider?: string }).type ===
            "shipboard-auth" &&
          (event.data as { provider?: string }).provider === "google");
      if (googleOk) {
        refreshUserInfo();
        toast.success("Signed in with Google");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshUserInfo]);

  // Full-page Google OAuth return (?auth=google) when popup was blocked
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "google") return;
    refreshUserInfo();
    if (params.get("ok") === "1") {
      toast.success("Signed in with Google");
    }
    // Clean query so refresh doesn't re-toast
    params.delete("auth");
    params.delete("ok");
    const next = params.toString();
    const path = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState({}, "", path);
  }, [refreshUserInfo]);

  const refreshSessions = useCallback(() => {
    fetchSessions().then(setSessions).catch(console.error);
  }, []);

  const showLimitError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && (err.upgrade || err.needsAuth)) {
        const msg =
          err.message ||
          `Free plan includes ${FREE_PROJECT_LIMIT} projects. Upgrade to Builder+ for unlimited projects.`;
        setLimitToast(msg);
        toast.error(err.needsAuth ? "Sign in to continue" : "Limit reached", {
          description: msg,
          duration: 6000,
          action: {
            label: "Upgrade",
            onClick: () => setUpgradeModalOpen(true),
          },
        });
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
        fetchMessages(id).then(setMessages).catch(ignoreMissingSession);
        fetchVersions(id).then(setVersions).catch(ignoreMissingSession);
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
    try {
      await createSession({ id, title: "New project", model: settings.model });
      setActiveSessionId(id);
      refreshSessions();
      refreshUserInfo();
      return id;
    } catch (err) {
      showLimitError(err);
      throw err;
    }
  }, [settings.model, refreshSessions, refreshUserInfo, showLimitError]);

  /** Landing → session: create project, then auto-send via initialPrompt on the stable ChatPanel. */
  const handleBootstrapProject = useCallback(
    async (prompt: string) => {
      const id = crypto.randomUUID();
      setPendingPrompt(prompt);
      setIsGenerating(true);
      setStreamText("");
      setStreamCode(EMPTY_STREAM);
      // Stay on chat so the session ChatPanel mounts and actually starts the stream.
      // handleStreamStart flips to preview once tokens arrive.
      setMobileTab("chat");
      setSettings((s) => ({ ...s, chatCollapsed: false }));
      try {
        await createSession({ id, title: "New project", model: settings.model });
        setActiveSessionId(id);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("p", id);
          window.history.replaceState({}, "", url.pathname + url.search);
        } catch {
          /* ignore */
        }
        refreshSessions();
        refreshUserInfo();
      } catch (err) {
        showLimitError(err);
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
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("p", id);
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch {
      /* ignore */
    }
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
    // Capture iteration base at send time (viewed version, not always latest)
    const idx =
      versions.length > 0
        ? Math.min(activeVersionIndex, versions.length - 1)
        : -1;
    baseCodeRef.current = idx >= 0 ? versions[idx]?.code : undefined;
    baseVersionNumRef.current = idx >= 0 ? idx + 1 : null;
    const prompt = lastUserPromptRef.current || "";
    const repairSend = isContinueRepairPrompt(prompt);
    if (!repairSend) {
      continueInFlightRef.current = false;
    } else {
      const baseId = idx >= 0 ? versions[idx]?.id : undefined;
      if (baseId) {
        const n = continueAttemptsRef.current.get(baseId) || 0;
        continueAttemptsRef.current.set(baseId, n + 1);
      }
    }
    liveCheckpointRef.current = {
      versionId: null,
      sig: "",
      chain: Promise.resolve(),
      closed: false,
      created: false,
    };
    setIsGenerating(true);
    setStreamText("");
    setStreamCode(EMPTY_STREAM);
    // Jump to preview so the user watches the project build
    setMobileTab("preview");
  }, [versions, activeVersionIndex]);

  const handleUserPrompt = useCallback((prompt: string) => {
    lastUserPromptRef.current = prompt;
  }, []);

  const handleStreamDelta = useCallback((fullText: string) => {
    setStreamText(fullText);
    setStreamCode(extractStreamingCode(fullText));
    const ck = liveCheckpointRef.current;
    if (ck.closed) return;
    const classified = classifyStreamFiles(fullText);
    const sig = completeFilesSignature(classified);
    if (!sig || sig === ck.sig) return;
    const repairBase =
      continueInFlightRef.current && readTruncatedPaths(baseCodeRef.current || "").length
        ? baseCodeRef.current || ""
        : "";
    const raw = repairBase
      ? mergeCheckpointRepair(repairBase, fullText)?.code || null
      : serializeCheckpoint(classified);
    if (!raw) return;
    ck.sig = sig;
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    if (!ck.versionId) ck.versionId = crypto.randomUUID();
    const id = ck.versionId;
    const code = attachCommerceFilesToCode(raw, {
      title: lastUserPromptRef.current || "Agent-ready store",
    });
    const title =
      checkpointProgressTitle(raw) ||
      checkpointLabel(
        lastUserPromptRef.current,
        undefined,
        versionsRef.current.length + (ck.created ? 0 : 1)
      );
    ck.chain = ck.chain.then(async () => {
      if (ck.closed) return;
      try {
        if (!ck.created) {
          const saved = await saveVersion(sid, {
            id,
            code,
            title,
            prompt: lastUserPromptRef.current || undefined,
          });
          ck.created = true;
          setVersions((prev) =>
            prev.some((v) => v.id === id)
              ? prev.map((v) => (v.id === id ? { ...v, code, title } : v))
              : [...prev, { ...saved, code, title, prompt: lastUserPromptRef.current || saved.prompt }]
          );
          setActiveVersionIndex(versionsRef.current.length);
        } else {
          await apiUpdateVersion(sid, id, code, title);
          setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, code, title } : v)));
        }
      } catch {
        /* best-effort; the end-of-stream save still runs */
      }
    });
  }, []);

  const handleClearPrompt = useCallback(() => {
    setPendingPrompt(null);
    setPendingStoreBrief(null);
  }, []);

  const handleClearPendingFix = useCallback(() => {
    setPendingFixPrompt(null);
  }, []);

  const handleFixFromQa = useCallback(() => {
    if (!lastQaReport) return;
    setSettings((s) => ({ ...s, chatCollapsed: false }));
    setPendingFixPrompt(buildFixFromQaPrompt(lastQaReport));
    setMobileTab("chat");
  }, [lastQaReport]);

  /** Prefill Continue prompt when ship readiness is blocked */
  const handleContinueGeneration = useCallback((source: string = "ship_ready_chip") => {
    const code = versions[activeVersionIndex]?.code || "";
    const joined = listProjectFiles(code)
      .map((f) => f.content)
      .join("\n");
    if (
      code.trim() &&
      !readTruncatedPaths(code).length &&
      !analyzeSourceTruncation(joined).likelyTruncated
    ) {
      toast.message("Nothing to continue", {
        description:
          "This version is complete — Continue would produce no file differences. Fix the preview error or regenerate.",
        duration: 6500,
      });
      return;
    }
    if (checkContinueCap(versions[activeVersionIndex]?.id)) return;
    continueInFlightRef.current = true;
    emitPreviewMetric("continue_clicked", { source });
    setSettings((s) => ({ ...s, chatCollapsed: false }));
    setPendingFixPrompt(
      readTruncatedPaths(code).length
        ? buildContinueRepairPrompt(code)
        : buildContinueTruncationPrompt()
    );
    setMobileTab("chat");
    toast.message("Continue ready in chat", {
      description:
        "Send the prefilled prompt to finish incomplete files — then ship when Ready.",
      duration: 5000,
    });
  }, [versions, activeVersionIndex, checkContinueCap]);

  // Latest-callback mirrors for the stable preview-error listener below.
  handleContinueGenerationRef.current = handleContinueGeneration;
  getTruncationStateRef.current = () => {
    const code = versions[activeVersionIndex]?.code || "";
    if (!code.trim()) return false;
    if (readTruncatedPaths(code).length) return true;
    const joined = listProjectFiles(code)
      .map((f) => f.content)
      .join("\n");
    return analyzeSourceTruncation(joined).likelyTruncated;
  };

  // Preview-time Continue nudge: when the iframe preview compiler reports a
  // compile error, nudge Continue when EITHER the error message itself is a
  // truncation signature OR the stored code analyzes as truncated (unclosed
  // AST node — e.g. a legacy store whose Babel error is a generic
  // "Unexpected token"). Detection is deterministic and read-only: the
  // safety net never heals unclosed openers; the LLM repairs the incomplete
  // AST with full context via the Continue flow.
  useEffect(() => {
    const off = subscribePreviewMetrics((e) => {
      if (e.type !== "preview_compile_error") return;
      if (isGeneratingRef.current) return;
      const now = Date.now();
      if (now - lastPreviewNudgeAtRef.current < 30_000) return;
      const reason = String(e.props.reason || "");
      const codeTruncated = getTruncationStateRef.current();
      if (!looksLikeTruncationCompileError(reason) && !codeTruncated) return;
      const vid = activeVersionIdRef.current;
      if (!vid) return;
      const shown = continueNudgeShownRef.current;
      if (shown.has(vid)) return;
      shown.add(vid);
      lastPreviewNudgeAtRef.current = now;
      toast.error("Preview can't compile — code looks cut off", {
        description:
          "This looks like a truncated generation, not a bug in your code. Continue in chat to finish the incomplete files.",
        duration: 14000,
        action: {
          label: "Continue",
          onClick: () => handleContinueGenerationRef.current("preview_error"),
        },
      });
    });
    return off;
  }, []);

  // Keep the Continue-nudge dedupe set bounded: drop ids for versions that no
  // longer exist (e.g. trimmed history), even when no preview error ever fires.
  useEffect(() => {
    const alive = new Set(versions.map((v) => v.id));
    const shown = continueNudgeShownRef.current;
    for (const id of [...shown]) {
      if (!alive.has(id)) shown.delete(id);
    }
  }, [versions]);

  // Audit tab → Fix from QA (may pass a fresh report)
  useEffect(() => {
    const onFix = (ev: Event) => {
      const detail = (ev as CustomEvent<PreviewQaReport>).detail;
      const report = detail || lastQaReport;
      if (!report) return;
      setLastQaReport(report);
      setSettings((s) => ({ ...s, chatCollapsed: false }));
      setPendingFixPrompt(buildFixFromQaPrompt(report));
      setMobileTab("chat");
    };
    window.addEventListener("adgen-fix-from-qa", onFix);
    return () => window.removeEventListener("adgen-fix-from-qa", onFix);
  }, [lastQaReport]);

  const handleLiveQa = useCallback((live: LiveQaPayload) => {
    const code = versions[activeVersionIndex]?.code;
    if (!code) return;
    setLastQaReport(mergeLiveIntoReport(runStaticPreviewQa(code), live));
  }, [versions, activeVersionIndex]);

  const handleStreamComplete = useCallback((fullText: string) => {
    setIsGenerating(false);
    setStreamText(fullText);
    const finalCode = extractStreamingCode(fullText);
    setStreamCode(finalCode);
    refreshUserInfo();
    const sid = activeSessionIdRef.current;
    if (sid) {
      fetchMessages(sid).then(setMessages).catch(ignoreMissingSession);
      // Integrity + save relative to the version we iterated from (may be older)
      const prevCode =
        baseCodeRef.current ??
        (versions.length > 0 ? versions[versions.length - 1]?.code : undefined);
      const repair = continueInFlightRef.current
        ? mergeCheckpointRepair(baseCodeRef.current || "", fullText)
        : null;
      const integrity = validateGeneration(fullText, repair ? undefined : prevCode);
      // Save from the validated project (auto-repaired files included) —
      // not a fresh raw extract, so structure-guard fixes land in the version.
      // A Continue repair is path-keyed: only incomplete files are replaced.
      const proj = integrity.project;
      const projEntry = proj.files[proj.entry];
      const codeRaw = repair
        ? repair.code
        : projEntry?.trim()
          ? integrity.isMulti ||
            Object.keys(proj.files).length > 1 ||
            (proj.truncated?.length ?? 0) > 0
            ? serializeProject(proj.files, proj.entry, proj.truncated)
            : projEntry.trim()
          : null;
      const code = codeRaw
        ? attachCommerceFilesToCode(codeRaw, {
            title: lastUserPromptRef.current || "Agent-ready store",
          })
        : codeRaw;
      // Zero-diff detection: a Continue that returns byte-identical content
      // (or content that parses to the same project files) against the version
      // it was iterating from. This is the "No file differences between v1 and
      // v2" symptom — the repair did nothing and looping Continue burns gens.
      const zeroDiff =
        Boolean(prevCode?.trim()) &&
        Boolean(code?.trim()) &&
        !compareVersionCodes(prevCode!.trim(), code!.trim()).hasChanges;
      const toastInfo = formatIntegrityToast(integrity);
      const hardFail = !code || (!integrity.ok && !code.trim());
      // Soft path: save if we have code even with quality errors (placeholders rare)
      const canSave =
        Boolean(code?.trim()) &&
        (integrity.ok ||
          !integrity.issues.some(
            (i) =>
              i.severity === "error" &&
              (i.code === "no_code" || i.code.startsWith("placeholder_previous") || i.code === "placeholder_rest")
          ));

      if (canSave && code) {
        const extracted = extractTitle(fullText);
        const progressTitle = checkpointProgressTitle(codeRaw || "");
        const nextNum = versions.length + (liveCheckpointRef.current.created ? 0 : 1);
        const fromNum = baseVersionNumRef.current;
        let title =
          progressTitle ||
          checkpointLabel(lastUserPromptRef.current, extracted, nextNum);
        // Note when this save branched from an older checkpoint
        if (
          fromNum != null &&
          versions.length > 0 &&
          fromNum < versions.length
        ) {
          title = `${title} · from v${fromNum}`;
        }
        const ck = liveCheckpointRef.current;
        ck.closed = true;
        const versionId = ck.versionId || crypto.randomUUID();
        ck.versionId = versionId;
        const warnNote = integrity.issues
          .filter((i) => i.severity === "warning" || i.severity === "error")
          .map((i) => i.message)
          .slice(0, 1)
          .join("; ");
        // Auto browser QA on every saved generation
        let qa: PreviewQaReport | null = null;
        try {
          qa = runStaticPreviewQa(code);
          setLastQaReport(qa);
        } catch {
          qa = null;
        }

        const qaLine = qa
          ? `QA ${qa.score}/100 · ${scoreLabel(qa.score)}`
          : null;
        const topIssue = qa?.findings.find(
          (f) => f.severity === "error" || f.severity === "warning"
        )?.message;
        const canFix = shouldSuggestFix(qa);
        const runFixFromQa = () => {
          if (!qa) return;
          setSettings((s) => ({ ...s, chatCollapsed: false }));
          setPendingFixPrompt(buildFixFromQaPrompt(qa));
          setMobileTab("chat");
        };

        const isTruncated =
          (repair ? repair.incomplete.length > 0 : false) ||
          readTruncatedPaths(code).length > 0 ||
          integrity.issues.some((i) => i.code === "truncated_code") ||
          Boolean(qa?.findings.some((f) => f.id === "truncated"));
        // Synchronous verdict for the chip: versions refetch async, so without
        // this the new code message briefly claims "UI ready" on truncation.
        setPendingTruncated(isTruncated);
        const repairFailed = !!repair && repair.incomplete.length > 0;
        const runContinueGen = (source: string = "toast") => {
          if (checkContinueCap(versionId)) return;
          continueInFlightRef.current = true;
          emitPreviewMetric("continue_clicked", { source });
          setSettings((s) => ({ ...s, chatCollapsed: false }));
          setPendingFixPrompt(
            readTruncatedPaths(code).length
              ? buildContinueRepairPrompt(code)
              : buildContinueTruncationPrompt()
          );
          setMobileTab("chat");
          toast.message("Continue ready in chat", {
            description:
              "Send the prefilled prompt to finish the incomplete file — checkpointed files stay put.",
            duration: 5000,
          });
        };

        if (repair) {
          continueInFlightRef.current = false;
          if (!repairFailed) {
            emitPreviewMetric("continue_completed", {
              healedSuccessfully: true,
              integrityOk: true,
            });
            toast.success("Incomplete file repaired", {
              description: repair.replaced.length
                ? `Updated ${repair.replaced.join(", ")}. Other files were left byte-for-byte.`
                : "Checkpointed files were left untouched.",
              duration: 8000,
            });
          } else {
            emitPreviewMetric("continue_completed", {
              healedSuccessfully: false,
              integrityOk: false,
              truncated: true,
              zeroDiff,
            });
            continueNudgeShownRef.current.add(versionId);
            const noOp = zeroDiff;
            toast.error(
              noOp ? "Continue changed nothing — still truncated" : "Repair didn't finish",
              {
                description: noOp
                  ? "The continuation produced no file changes against the checkpoint. Raise Max tokens, or regenerate instead of looping Continue."
                  : `Still incomplete: ${repair.incomplete.join(", ")}. Continue again, or regenerate.`,
                duration: 14000,
                action: {
                  label: noOp ? "Raise max tokens" : "Continue",
                  onClick: () =>
                    noOp ? setSettingsOpen(true) : runContinueGen("repair_failed"),
                },
                cancel: {
                  label: "Regenerate",
                  onClick: () => {
                    setSettings((s) => ({ ...s, chatCollapsed: false }));
                    setMobileTab("chat");
                  },
                },
              }
            );
          }
        } else if (isTruncated) {
          // Mark nudged so the preview-error listener doesn't double-toast
          // when the iframe reports the same truncation as a compile error.
          continueNudgeShownRef.current.add(versionId);
          // If this was a Continue repair that is STILL truncated, tell the
          // user honestly instead of implying progress. A loop of Continue
          // burns would otherwise re-toast "cut off mid-stream" with no
          // signal that the repair did not land.
          const wasContinue = continueInFlightRef.current;
          if (wasContinue) {
            continueInFlightRef.current = false;
            emitPreviewMetric("continue_completed", {
              healedSuccessfully: false,
              integrityOk: false,
              truncated: true,
              zeroDiff,
            });
          }
          // A zero-diff Continue is the worst case: it burned a generation and
          // changed nothing. Say so and steer away from another Continue loop.
          const noOpRepair = wasContinue && zeroDiff;
          toast.error(
            noOpRepair
              ? "Continue changed nothing — still truncated"
              : wasContinue
                ? "Continue could not repair the truncation"
                : "Generation cut off mid-stream",
            {
              description: noOpRepair
                ? "The continuation produced no file changes against the previous version. Raise Max tokens in Settings, or regenerate from scratch instead of looping Continue."
                : wasContinue
                  ? "The continuation is still truncated. Raise Max tokens in Settings and Continue again, or regenerate from scratch."
                  : "Partial code is kept. Click Continue to close files, or raise Max tokens in Settings.",
              duration: 14000,
              action: {
                label: noOpRepair || wasContinue ? "Raise max tokens" : "Continue",
                onClick: () =>
                  noOpRepair || wasContinue
                    ? setSettingsOpen(true)
                    : runContinueGen("toast"),
              },
              cancel: {
                label: noOpRepair || wasContinue ? "Regenerate" : "Max tokens",
                onClick: () =>
                  noOpRepair || wasContinue
                    ? (() => {
                        setSettings((s) => ({ ...s, chatCollapsed: false }));
                        setMobileTab("chat");
                      })()
                    : setSettingsOpen(true),
              },
            }
          );
        } else if (integrity.ok && !warnNote) {
          if (continueInFlightRef.current) {
            continueInFlightRef.current = false;
            emitPreviewMetric("continue_completed", {
              healedSuccessfully: true,
              integrityOk: true,
            });
          }
          toast.success(toastInfo.title, {
            description: [qaLine, `Checkpoint: ${title.slice(0, 40)}`]
              .filter(Boolean)
              .join(" · "),
            duration: 7000,
            action: canFix
              ? { label: "Fix QA", onClick: runFixFromQa }
              : {
                  label: "Ship",
                  onClick: () => setDeployDialogOpen(true),
                },
            cancel: {
              label: canFix ? "Audit" : "Preview",
              onClick: () => {
                setMobileTab("preview");
                setFullscreen(false);
                if (canFix) {
                  window.dispatchEvent(new CustomEvent("adgen-open-audit"));
                }
              },
            },
          });
        } else {
          if (continueInFlightRef.current) {
            continueInFlightRef.current = false;
            emitPreviewMetric("continue_completed", {
              healedSuccessfully: false,
              integrityOk: integrity.ok,
              truncated: isTruncated,
            });
          }
          toast.message("Build saved", {
            description:
              topIssue ||
              warnNote ||
              qaLine ||
              "Saved with quality notes — check preview",
            duration: 8000,
            action: canFix
              ? { label: "Fix QA", onClick: runFixFromQa }
              : {
                  label: "Audit",
                  onClick: () => {
                    setMobileTab("preview");
                    setFullscreen(false);
                    window.dispatchEvent(new CustomEvent("adgen-open-audit"));
                  },
                },
          });
        }

        // Follow-up QA toast when score is weak
        if (qa && qa.score < 75) {
          const issues = qa.findings
            .filter((f) => f.severity === "error" || f.severity === "warning")
            .slice(0, 2)
            .map((f) => f.message)
            .join(" · ");
          setTimeout(() => {
            toast.message(`Browser QA · ${qa!.score}/100`, {
              description: issues || qa!.summary,
              duration: 9000,
              action: {
                label: "Fix from QA",
                onClick: runFixFromQa,
              },
              cancel: {
                label: "Audit",
                onClick: () => {
                  setMobileTab("preview");
                  window.dispatchEvent(new CustomEvent("adgen-open-audit"));
                },
              },
            });
          }, 400);
        }

        const promptSaved = lastUserPromptRef.current || undefined;
        void (async () => {
          await ck.chain;
          if (ck.created) {
            await apiUpdateVersion(sid, versionId, code, title);
          } else {
            await saveVersion(sid, {
              id: versionId,
              code,
              title,
              prompt: promptSaved,
            });
          }
          const v = await fetchVersions(sid);
          setVersions(
            v.map((ver) =>
              ver.id === versionId
                ? { ...ver, prompt: promptSaved || ver.prompt }
                : ver
            )
          );
          setStreamText("");
          setStreamCode(EMPTY_STREAM);
          refreshSessions();
        })().catch(ignoreMissingSession);
      } else {
        toast.error(hardFail ? "No UI in response" : toastInfo.title, {
          description:
            toastInfo.description ||
            "Model returned no code — try Improve prompt or a template",
          duration: 8000,
        });
        setStreamCode(EMPTY_STREAM);
      }
    } else {
      setStreamText("");
      setStreamCode(EMPTY_STREAM);
    }
  }, [refreshUserInfo, refreshSessions, versions]);

  const handleTitleUpdate = useCallback((title: string) => {
    // Session title is handled by the API, we just refresh to show it.
    if (title) refreshSessions();
  }, [refreshSessions]);

  const handleUpgradeNeeded = useCallback(() => {
    setUpgradeModalOpen(true);
  }, []);

  const handleConnectGitHub = useCallback(async () => {
    try {
      const res = await startGitHubAuth();
      if (!res.url) throw new Error(res.error || "No OAuth URL");
      const popup = window.open(
        res.url,
        "github-auth",
        "width=600,height=720,scrollbars=yes,resizable=yes"
      );
      if (!popup) {
        // Popup blocked — full-page redirect
        window.location.href = res.url;
        return;
      }
    } catch (err) {
      console.error("Failed to start GitHub auth:", err);
      const message =
        err instanceof Error
          ? err.message
          : "GitHub OAuth not configured. Set GITHUB_CLIENT_ID / SECRET on Netlify.";
      toast.error("GitHub sign-in", { description: message, duration: 9000 });
      setLimitToast(message);
      setTimeout(() => setLimitToast(null), 6000);
      setGithubAutoPush(false);
      setGithubDialogOpen(true);
    }
  }, []);

  const handleConnectGoogle = useCallback(async () => {
    try {
      const res = await startGoogleAuth();
      if (!res.url) {
        throw new Error(
          res.error ||
            "Google not configured. Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET on Netlify."
        );
      }
      const popup = window.open(
        res.url,
        "google-auth",
        "width=520,height=720,scrollbars=yes,resizable=yes"
      );
      if (!popup) {
        window.location.href = res.url;
      }
    } catch (err) {
      console.error("Failed to start Google auth:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
      toast.error("Google sign-in", {
        description: message,
        duration: 10000,
      });
      setLimitToast(message);
      setTimeout(() => setLimitToast(null), 8000);
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

    // Ship readiness gate — incomplete streams go to Continue, not GitHub
    try {
      const { validateForShip } = await import("@/lib/gen-integrity");
      const gate = validateForShip(code);
      if (!gate.ok) {
        handleContinueGeneration("push_blocked");
        toast.error(gate.blockers[0] || "Needs Continue before ship", {
          description: "Click Continue to finish incomplete files, then Push.",
          duration: 7000,
        });
        return;
      }
    } catch {
      /* dialog / API re-checks */
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
  }, [
    versions,
    activeVersionIndex,
    githubStatus?.connected,
    githubStatus?.oauthConfigured,
    handleContinueGeneration,
  ]);

  const handleSignOut = useCallback(async () => {
    try {
      await disconnectGitHub();
      setGithubStatus(undefined);
      setUserInfo(null);
      refreshSessions();
      try {
        const u = (await fetch("/api/user").then((r) => r.json())) as UserInfo;
        setUserInfo(u);
      } catch {
        /* keep null — shows sign-in */
      }
      toast.success("Signed out");
    } catch (err) {
      console.error("Sign out failed:", err);
      toast.error("Sign out failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  }, [refreshSessions]);

  // Restore an older version as a new latest checkpoint (linear history)
  const handleRestoreVersion = useCallback(
    (index: number) => {
      const sid = activeSessionIdRef.current;
      const version = versions[index];
      if (!sid || !version) return;
      const versionId = crypto.randomUUID();
      const nextNum = versions.length + 1;
      const title = `Restored v${index + 1} → v${nextNum}`;
      saveVersion(sid, {
        id: versionId,
        code: version.code,
        title,
        prompt: version.prompt,
      }).then(() => {
        fetchVersions(sid).then((v) => {
          setVersions(v);
          // Jump to the new latest (effect also does this; set explicitly for snappiness)
          setActiveVersionIndex(Math.max(0, v.length - 1));
        }).catch(ignoreMissingSession);
        toast.success(`Restored as v${nextNum}`, {
          description: `v${index + 1} is now the latest — chat and ship use this UI.`,
          duration: 5000,
        });
      });
    },
    [versions]
  );

  /**
   * Fork: new project starting at this version as v1 (v0-style branch).
   * Keeps the original chat history intact.
   */
  const handleForkVersion = useCallback(
    async (index: number) => {
      const version = versions[index];
      if (!version?.code?.trim()) {
        toast.error("Nothing to fork", {
          description: "Generate a UI first, then fork a version.",
        });
        return;
      }
      const id = crypto.randomUUID();
      const baseTitle = (version.title || "UI").replace(/\s*·\s*from v\d+/i, "").trim();
      const title = `Fork · v${index + 1} · ${baseTitle}`.slice(0, 80);
      try {
        await createSession({ id, title, model: settings.model });
        await saveVersion(id, {
          id: crypto.randomUUID(),
          code: version.code,
          title: `v1 · forked from v${index + 1}`,
          prompt: version.prompt,
        });
        setIsGenerating(false);
        setStreamText("");
        setStreamCode(EMPTY_STREAM);
        setMessages([]);
        setActiveSessionId(id);
        refreshSessions();
        refreshUserInfo();
        // Session effect will load versions; seed optimistically
        fetchVersions(id).then((v) => {
          setVersions(v);
          setActiveVersionIndex(Math.max(0, v.length - 1));
        }).catch(ignoreMissingSession);
        setMobileTab("preview");
        toast.success("Forked to new project", {
          description: `Started from v${index + 1}. Original project unchanged.`,
          duration: 5000,
        });
      } catch (err) {
        showLimitError(err);
      }
    },
    [versions, settings.model, refreshSessions, refreshUserInfo, showLimitError]
  );

  const handleCodeEdit = useCallback((versionId: string, code: string) => {
    const sid = activeSessionIdRef.current;
    if (sid) {
      apiUpdateVersion(sid, versionId, code).then(() => {
        fetchVersions(sid).then(setVersions).catch(ignoreMissingSession);
      });
    }
  }, []);

  const handleSelectTemplate = useCallback((prompt: string) => {
    if (!activeSessionId) {
      handleNewChat();
    }
    setPendingPrompt(prompt);
  }, [activeSessionId, handleNewChat]);

  // Download as ZIP — full Next.js App Router + TS + Tailwind project (escape hatch)
  const handleDownloadZip = useCallback(async () => {
    const activeVersion = versions[activeVersionIndex];
    if (!activeVersion) return;
    try {
      const { validateForShip } = await import("@/lib/gen-integrity");
      const gate = validateForShip(activeVersion.code);
      if (!gate.ok) {
        toast.error(gate.blockers[0] || "Needs Continue before export");
        return;
      }
    } catch {
      /* still try zip */
    }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const slug = activeVersion.title.replace(/\s+/g, "-").toLowerCase();
    const { buildShipProjectFiles } = await import("@/lib/github-project");
    let files;
    try {
      files = buildShipProjectFiles({
        code: activeVersion.code,
        title: activeVersion.title,
        repoSlug: slug,
        stack: "next",
        byobSchema: settings.byob?.schema ?? null,
        customTools: settings.byob?.customTools ?? null,
      });
    } catch (err) {
      const { EjectCompileError } = await import("@/lib/eject-gate");
      if (err instanceof EjectCompileError) {
        toast.error(err.message);
        return;
      }
      throw err;
    }
    for (const f of files) {
      zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "Shipboard-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ZIP ready — real Next.js sources (no preview stripper)");
  }, [versions, activeVersionIndex, settings.byob?.schema, settings.byob?.customTools]);

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
      setTimeout(() => setShareLinkCopied(false), 2500);
      toast.success("Share link copied", {
        description:
          "Paste anywhere — social apps show a rich Shipboard card. Opens live preview (no account).",
        duration: 5000,
      });
      emitPreviewMetric("share_link_copied", {
        hasSchema: Boolean(settings.byob?.schema?.tables?.length),
      });
    } catch (err) {
      console.error("Failed to copy share link:", err);
      toast.error("Could not copy share link");
    }
  }, [
    versions,
    activeVersionIndex,
    settings.previewTheme,
    settings.byob?.schema?.tables?.length,
    sessions,
    activeSessionId,
  ]);

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
          title: deriveShortTitle(sessionTitle),
          description: `Published from Shipboard · ${activeVersion.title}`,
          code: activeVersion.code,
          theme: settings.previewTheme,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      const path = data.id ? `/gallery/${data.id}` : "/gallery";
      emitPreviewMetric("publish_success", {
        hasSchema: Boolean(settings.byob?.schema?.tables?.length),
      });
      toast.success("Published to showcase", {
        description:
          "Gallery page has a rich OG card for social shares. Remix stays one click away.",
        duration: 7000,
        action: data.id
          ? {
              label: "Open",
              onClick: () => window.open(path, "_blank"),
            }
          : undefined,
      });
      if (data.id) {
        window.open(path, "_blank");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
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
  const showPreview = Boolean(activeSessionId);

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
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
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
            onSignInGoogle={handleConnectGoogle}
            onSignOut={handleSignOut}
            onSelectTemplate={handleSelectTemplate}
            authProviders={userInfo?.authProviders}
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
              onSignInGoogle={() => { setSidebarOpen(false); void handleConnectGoogle(); }}
              onSignOut={() => { setSidebarOpen(false); handleSignOut(); }}
              onClose={() => setSidebarOpen(false)}
              onSelectTemplate={(p) => { setSidebarOpen(false); handleSelectTemplate(p); }}
              authProviders={userInfo?.authProviders}
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
                {activeSession?.title || "Shipboard"}
              </p>
              {isGenerating && (
                <p className="text-[10px] font-medium text-orange-400">
                  {t("status.building")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              {userInfo?.connected ? (
                <UserMenu
                  userInfo={userInfo}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onSignOut={() => void handleSignOut()}
                  onUpgrade={() => setUpgradeModalOpen(true)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={t("nav.settings")}
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Desktop topbar — hidden on mobile and in fullscreen */}
        {!fullscreen && (
          <header className="hidden md:flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80"
                onClick={() => { window.location.href = "/"; }}
                title="Home"
              >
                <ShipboardLogo size="xs" />
                <span className="text-xs font-bold uppercase tracking-tighter">
                  {t("app.name")}
                </span>
                <span className="rounded border border-border/50 bg-foreground/5 px-1 py-0.25 font-mono text-[8px] text-muted-foreground">
                  STUDIO
                </span>
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
                  <span className="text-foreground font-medium text-sm">{activeSession?.title ?? "Shipboard"}</span>
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
              <LanguageToggle />
              {!userInfo?.connected ? (
                <SignInMenu
                  variant="primary"
                  onGitHub={() => void handleConnectGitHub()}
                  onGoogle={() => void handleConnectGoogle()}
                  githubAvailable={userInfo?.authProviders?.github !== false}
                  googleAvailable={userInfo?.authProviders?.google !== false}
                />
              ) : (
                <UserMenu
                  userInfo={userInfo}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onSignOut={() => void handleSignOut()}
                  onUpgrade={() => setUpgradeModalOpen(true)}
                />
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
              onContinueGeneration={() => handleContinueGeneration("preview_toolbar")}
              onDeploy={() => setDeployDialogOpen(true)}
              onDownloadZip={handleDownloadZip}
              onDownloadHtml={handleDownloadHtml}
              onCodeEdit={handleCodeEdit}
              onRestoreVersion={handleRestoreVersion}
              onForkVersion={handleForkVersion}
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
              byobSchema={settings.byob?.schema ?? null}
              onLiveQa={handleLiveQa}
            />
          ) : showPreview ? (
            <>
              {/* Desktop: side-by-side */}
              <div className="hidden md:flex h-full">
                {!fullscreen && !settings.chatCollapsed && (
                  <div className="relative flex h-full min-h-0 w-[min(320px,32%)] min-w-[260px] max-w-[340px] shrink-0 flex-col border-r border-border">
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
                      latestCode={activeCode}
                      baseVersionLabel={baseVersionLabel}
                      customSystemPrompt={settings.customSystemPrompt}
                      maxTokens={settings.maxTokens}
                      outputFormat={settings.outputFormat}
                      brandKit={settings.brandKit}
                      previewTheme={settings.previewTheme}
                      byobSchema={settings.byob?.schema ?? null}
                      designStyle={settings.designStyle}
                      onDesignStyleChange={(id) =>
                        setSettings((s) => ({ ...s, designStyle: id }))
                      }
                      onUpgradeNeeded={handleUpgradeNeeded}
                      initialPrompt={pendingPrompt}
                      storeBrief={pendingStoreBrief}
                      onClearPrompt={handleClearPrompt}
                      userInfo={userInfo}
                      onModelChange={(m) => setSettings((s) => ({ ...s, model: m }))}
                      onUserPrompt={handleUserPrompt}
                      onHideChat={() =>
                        setSettings((s) => ({ ...s, chatCollapsed: true }))
                      }
                      pendingPromptFill={pendingFixPrompt}
                      onClearPendingPrompt={handleClearPendingFix}
                      lastQaScore={lastQaReport?.score ?? null}
                      onFixFromQa={
                        shouldSuggestFix(lastQaReport) ? handleFixFromQa : undefined
                      }
                      codeTruncated={pendingTruncated ?? latestVersionTruncated}
                    />
                  </div>
                )}
                {!fullscreen && settings.chatCollapsed && (
                  <div className="flex w-10 shrink-0 flex-col items-center border-r border-border bg-card/40 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({ ...s, chatCollapsed: false }))
                      }
                      title="Show chat"
                      aria-label="Show chat"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    {isGenerating && (
                      <span className="mt-2 h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                    )}
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
                    onContinueGeneration={() => handleContinueGeneration("preview_toolbar")}
                    onDeploy={() => setDeployDialogOpen(true)}
                    onDownloadZip={handleDownloadZip}
                    onDownloadHtml={handleDownloadHtml}
                    onCodeEdit={handleCodeEdit}
                    onRestoreVersion={handleRestoreVersion}
                    onForkVersion={handleForkVersion}
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
                    byobSchema={settings.byob?.schema ?? null}
                    onLiveQa={handleLiveQa}
                    chatCollapsed={settings.chatCollapsed}
                    onShowChat={() =>
                      setSettings((s) => ({ ...s, chatCollapsed: false }))
                    }
                  />
                </div>
              </div>

              {/* Mobile: single panel based on mobileTab */}
              <div className="h-full min-h-0 md:hidden">
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
                    latestCode={activeCode}
                    baseVersionLabel={baseVersionLabel}
                    customSystemPrompt={settings.customSystemPrompt}
                    maxTokens={settings.maxTokens}
                    outputFormat={settings.outputFormat}
                    brandKit={settings.brandKit}
                    previewTheme={settings.previewTheme}
                    byobSchema={settings.byob?.schema ?? null}
                    designStyle={settings.designStyle}
                    onDesignStyleChange={(id) =>
                      setSettings((s) => ({ ...s, designStyle: id }))
                    }
                    onUpgradeNeeded={handleUpgradeNeeded}
                    initialPrompt={pendingPrompt}
                    storeBrief={pendingStoreBrief}
                    onClearPrompt={handleClearPrompt}
                    userInfo={userInfo}
                    onModelChange={(m) => setSettings((s) => ({ ...s, model: m }))}
                    onUserPrompt={handleUserPrompt}
                    pendingPromptFill={pendingFixPrompt}
                    onClearPendingPrompt={handleClearPendingFix}
                    lastQaScore={lastQaReport?.score ?? null}
                    onFixFromQa={
                      shouldSuggestFix(lastQaReport) ? handleFixFromQa : undefined
                    }
                    codeTruncated={pendingTruncated ?? latestVersionTruncated}
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
                    onContinueGeneration={() => handleContinueGeneration("preview_toolbar")}
                    onDeploy={() => setDeployDialogOpen(true)}
                    onDownloadZip={handleDownloadZip}
                    onDownloadHtml={handleDownloadHtml}
                    onCodeEdit={handleCodeEdit}
                    onRestoreVersion={handleRestoreVersion}
                    onForkVersion={handleForkVersion}
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
                    byobSchema={settings.byob?.schema ?? null}
                    onLiveQa={handleLiveQa}
                    initialTab={mobileTab === "code" ? "code" : "preview"}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
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
                  initialRebuildUrl={rebuildFromQuery}
                  isLanding
                  customSystemPrompt={settings.customSystemPrompt}
                  maxTokens={settings.maxTokens}
                  outputFormat={settings.outputFormat}
                  brandKit={settings.brandKit}
                  previewTheme={settings.previewTheme}
                  byobSchema={settings.byob?.schema ?? null}
                  designStyle={settings.designStyle}
                  onDesignStyleChange={(id) =>
                    setSettings((s) => ({ ...s, designStyle: id }))
                  }
                  onUpgradeNeeded={handleUpgradeNeeded}
                  initialPrompt={pendingPrompt}
                  storeBrief={pendingStoreBrief}
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
              activeCode ? listProjectFiles(activeCode).length : 0
            }
            byobTableCount={settings.byob?.schema?.tables?.length ?? 0}
            byobProvider={settings.byob?.schema?.provider ?? null}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenUpgrade={() => setUpgradeModalOpen(true)}
            onConnectGitHub={handleConnectGitHub}
            onOpenTelemetry={() => setTelemetryOpen(true)}
          />
        </div>
      )}

      <TelemetryPanel open={telemetryOpen} onClose={() => setTelemetryOpen(false)} />

      {/* Mobile bottom tab bar — only when session is active */}
      {showPreview && !fullscreen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
          <div className="flex h-14 items-stretch px-1">
            {([
              { key: "chat" as const, icon: MessageSquare, label: t("nav.chat") },
              { key: "preview" as const, icon: Eye, label: t("nav.preview") },
              { key: "code" as const, icon: Code2, label: t("nav.code") },
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
        activeSessionId={activeSessionId}
      />

      <GitHubPushDialog
        open={githubDialogOpen}
        onClose={() => {
          setGithubDialogOpen(false);
          setGithubAutoPush(false);
        }}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "Shipboard Project"}
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
        byobSchema={settings.byob?.schema ?? null}
        customTools={settings.byob?.customTools ?? null}
      />

      <DeployDialog
        open={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        code={versions[activeVersionIndex]?.code ?? ""}
        title={activeSession?.title ?? "Shipboard Project"}
        githubStatus={githubStatus}
        onConnectGitHub={handleConnectGitHub}
        byobSchema={settings.byob?.schema ?? null}
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
  <title>Shipboard Component</title>
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
