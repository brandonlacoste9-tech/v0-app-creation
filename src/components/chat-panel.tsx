"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { streamChat, scrapeInspirationUrl, ApiError } from "@/lib/api-client";
import type { Message, AIProvider, BrandKit, UserInfo } from "@/lib/types";
import { PROMPT_TEMPLATES, ITERATE_CHIPS, PROVIDER_MODELS, PROVIDER_INFO } from "@/lib/types";
import { DESIGN_STYLES, type DesignStyleId } from "@/lib/design-system";
import { shouldClarify, getClarifyChoices, type ClarifyChoice } from "@/lib/clarify";
import {
  Send,
  Loader2,
  User,
  Bot,
  Zap,
  Layout,
  BarChart3,
  Lock,
  ShoppingCart,
  MessageSquare,
  Settings,
  Columns3,
  DollarSign,
  FolderOpen,
  Music,
  Calendar,
  Grid3X3,
  Terminal,
  Lightbulb,
  Sparkles,
  Square,
  ChevronDown,
  ListPlus,
  X,
  CornerDownRight,
  HelpCircle,
  Palette,
  FileCode2,
  PanelLeftClose,
  Brain,
  ChevronRight,
  Globe2,
  Link2,
} from "lucide-react";

const STYLE_CHIP_OPTIONS: { id: DesignStyleId; label: string; title: string }[] = [
  { id: "auto", label: "Auto", title: "Pick style from your prompt keywords" },
  ...DESIGN_STYLES.map((s) => ({
    id: s.id,
    label: s.label,
    title: `${s.short} — ${s.bestFor}`,
  })),
];

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: Layout,
  chart: BarChart3,
  lock: Lock,
  shopping: ShoppingCart,
  message: MessageSquare,
  settings: Settings,
  columns: Columns3,
  dollar: DollarSign,
  folder: FolderOpen,
  music: Music,
  calendar: Calendar,
  grid: Grid3X3,
  sparkles: Sparkles,
};

const REGEN_CHIPS = [
  { label: "Redo hero", section: "hero" },
  { label: "Redo navbar", section: "navbar" },
  { label: "Redo footer", section: "footer" },
  { label: "Redo pricing", section: "pricing" },
  { label: "Redo features", section: "features" },
];

/** Survives Strict Mode remount so landing bootstrap auto-send is not dropped. */
const bootedPrompts = new Set<string>();

/** Collapsible chain-of-thought (inspired by v0 thinking sections). */
function ThinkingBlock({
  thought,
  streaming,
  defaultOpen = true,
}: {
  thought: string;
  streaming?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Auto-open while model is only thinking; soft-close once answer text arrives
  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);

  const display =
    thought.length > 900 ? "…" + thought.slice(-900) : thought;

  return (
    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-orange-500/10"
      >
        {streaming ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-400" />
        ) : (
          <Brain className="h-3.5 w-3.5 shrink-0 text-orange-400/90" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">
          {streaming ? "Thinking" : "Thought"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          {streaming ? "reasoning through the UI…" : "tap to expand"}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap border-t border-orange-500/15 px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground/95">
          {display}
        </p>
      )}
    </div>
  );
}

interface ChatPanelProps {
  sessionId: string | null;
  messages: Message[];
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaUrl: string;
  temperature: number;
  isLanding?: boolean;
  /** Code used as iteration base (active version, may not be latest). */
  latestCode?: string;
  /** e.g. "v2" or "v4 (latest)" — shown on iterate chips. */
  baseVersionLabel?: string;
  customSystemPrompt?: string;
  maxTokens?: number;
  outputFormat?: "tsx" | "jsx" | "html";
  brandKit?: BrandKit;
  previewTheme?: string;
  /** Design style id for generation brief (auto | minimal | glass | …). */
  designStyle?: string;
  onDesignStyleChange?: (styleId: string) => void;
  onStreamStart: () => void;
  onStreamComplete: (text: string) => void;
  /** Fired on every delta so the preview can show a live build. */
  onStreamDelta?: (fullText: string) => void;
  onTitleUpdate: (title: string) => void;
  /**
   * Create a session for the first message from landing.
   * Prefer returning after the parent has mounted the session ChatPanel;
   * use with pending prompt auto-send so the stream is not lost on remount.
   */
  onNewSession?: () => Promise<string> | string;
  /** Landing-only: create session + hand prompt to the session panel (avoids remount mid-stream). */
  onBootstrapProject?: (prompt: string) => Promise<void>;
  onUpgradeNeeded?: (needsAuth: boolean) => void;
  initialPrompt?: string | null;
  onClearPrompt?: () => void;
  duelMode?: boolean;
  duelModel?: string;
  promptOptimizer?: boolean;
  userInfo?: UserInfo | null;
  onModelChange?: (model: string) => void;
  /** Called with the user prompt when a generation starts (for checkpoints). */
  onUserPrompt?: (prompt: string) => void;
  /** Collapse chat column for full-width preview */
  onHideChat?: () => void;
  /** Prefill composer (e.g. Fix-from-QA) then clear via onClearPendingPrompt */
  pendingPromptFill?: string | null;
  onClearPendingPrompt?: () => void;
  /** Show Fix-from-QA chip when last audit has issues */
  lastQaScore?: number | null;
  onFixFromQa?: () => void;
}

export function ChatPanel({
  sessionId,
  messages,
  provider,
  model,
  apiKey,
  ollamaUrl,
  temperature,
  isLanding,
  latestCode,
  baseVersionLabel,
  customSystemPrompt,
  maxTokens,
  outputFormat,
  brandKit,
  previewTheme,
  designStyle = "auto",
  onDesignStyleChange,
  onStreamStart,
  onStreamComplete,
  onStreamDelta,
  onTitleUpdate,
  onNewSession,
  onBootstrapProject,
  onUpgradeNeeded,
  initialPrompt,
  onClearPrompt,
  duelMode,
  duelModel,
  promptOptimizer,
  userInfo,
  onModelChange,
  onUserPrompt,
  onHideChat,
  pendingPromptFill,
  onClearPendingPrompt,
  lastQaScore,
  onFixFromQa,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThoughts, setStreamingThoughts] = useState("");
  const [duelStreamingText, setDuelStreamingText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hackerMode, setHackerMode] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspireUrl, setInspireUrl] = useState("");
  const [inspireBusy, setInspireBusy] = useState(false);
  const [clarify, setClarify] = useState<{
    original: string;
    choices: ClarifyChoice[];
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const duelAbortRef = useRef<AbortController | null>(null);
  const streamTextRef = useRef("");
  const queueRef = useRef<string[]>([]);
  const drainQueueRef = useRef<(next?: string) => void>(() => {});
  /** Sync style for same-tick template sends (before parent re-render). */
  const designStyleRef = useRef(designStyle);

  useEffect(() => {
    designStyleRef.current = designStyle;
  }, [designStyle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, queue]);

  // Keep long prompts scrolled into view inside the capped textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [input]);

  // Prefill from Fix-from-QA / external inject
  useEffect(() => {
    if (!pendingPromptFill?.trim()) return;
    setInput(pendingPromptFill);
    onClearPendingPrompt?.();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [pendingPromptFill, onClearPendingPrompt]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const finishStream = useCallback(
    (fullText: string, opts?: { aborted?: boolean }) => {
      setIsStreaming(false);
      setStreamingText("");
      setStreamingThoughts("");
      setDuelStreamingText("");
      streamTextRef.current = "";
      abortRef.current = null;
      duelAbortRef.current = null;
      if (fullText.trim()) {
        onStreamComplete(fullText);
        if (opts?.aborted) {
          toast.message("Generation stopped", { description: "Partial result saved when possible" });
        }
      }
      // Drain queue
      const next = queueRef.current[0];
      if (next) {
        setQueue((q) => q.slice(1));
        queueRef.current = queueRef.current.slice(1);
        // slight delay so parent can settle versions
        setTimeout(() => drainQueueRef.current(next), 80);
      }
    },
    [onStreamComplete]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    duelAbortRef.current?.abort();
    const partial = streamTextRef.current;
    finishStream(partial, { aborted: true });
    onStreamDelta?.("");
  }, [finishStream, onStreamDelta]);

  const startGeneration = useCallback(
    async (
      msg: string,
      opts?: { force?: boolean; skipClarify?: boolean; designStyle?: string }
    ) => {
      if (!msg.trim()) return;
      if (opts?.designStyle) {
        designStyleRef.current = opts.designStyle;
        onDesignStyleChange?.(opts.designStyle);
      }
      const styleForGen = opts?.designStyle || designStyleRef.current || designStyle;

      // Queue follow-up while streaming (unless force redirect)
      if (isStreaming && !opts?.force) {
        const q = msg.trim();
        setInput("");
        setQueue((prev) => [...prev, q]);
        toast.message("Queued", { description: "Sends when this build finishes" });
        return;
      }

      // Clarify thin first prompts (save gens)
      if (
        !opts?.skipClarify &&
        !opts?.force &&
        !latestCode &&
        shouldClarify(msg, Boolean(latestCode))
      ) {
        setClarify({ original: msg.trim(), choices: getClarifyChoices(msg) });
        setInput("");
        return;
      }

      setClarify(null);

      // Landing: bootstrap session + remount with prompt so stream runs on stable panel
      if (!sessionId && onBootstrapProject) {
        setInput("");
        setStreamError(null);
        onUserPrompt?.(msg.trim());
        try {
          await onBootstrapProject(msg.trim());
        } catch (err) {
          setStreamError(err instanceof Error ? err.message : "Could not create project");
        }
        return;
      }

      let sid = sessionId;
      if (!sid && onNewSession) {
        try {
          sid = await Promise.resolve(onNewSession());
        } catch (err) {
          setStreamError(err instanceof Error ? err.message : "Could not create project");
          return;
        }
      }

      if (!sid) return;

      onUserPrompt?.(msg.trim());

      // Auto-optimize if enabled
      let finalMsg = msg;
      if (promptOptimizer) {
        finalMsg = `[TECHNICAL OPTIMIZER ENABLED] Refactor and enhance this prompt for professional engineering implementation: ${msg}`;
      }

      setInput("");
      setStreamError(null);
      setIsStreaming(true);
      setStreamingText("");
      setDuelStreamingText("");
      streamTextRef.current = "";
      onStreamStart();

      let fullText = "";
      let fullThoughts = "";
      let duelFullText = "";
      let lastDeltaFlush = 0;

      abortRef.current = streamChat(
        sid,
        finalMsg,
        provider,
        model,
        apiKey,
        ollamaUrl,
        temperature,
        (delta) => {
          fullText += delta;
          streamTextRef.current = fullText;
          const now = Date.now();
          if (now - lastDeltaFlush >= 80) {
            lastDeltaFlush = now;
            setStreamingText(fullText);
            onStreamDelta?.(fullText);
          }
        },
        (thoughtDelta) => {
          fullThoughts += thoughtDelta;
          setStreamingThoughts(fullThoughts);
        },
        (title) => onTitleUpdate(title),
        () => {
          setStreamingText(fullText);
          onStreamDelta?.(fullText);
          if (!duelMode) {
            finishStream(fullText);
          } else {
            onStreamComplete(fullText);
            if (duelFullText) {
              finishStream(fullText);
            }
          }
        },
        (error, flags) => {
          // Abort is handled in handleStop
          if (error === "The user aborted a request." || error?.includes("aborted")) {
            return;
          }
          setIsStreaming(false);
          setStreamingText("");
          streamTextRef.current = "";
          const errMsg = error || "Generation failed. Try again.";
          setStreamError(errMsg);
          if (flags?.upgrade) {
            const isLimit =
              /limit|generations today|upgrade/i.test(errMsg);
            toast.error(isLimit ? "Daily limit reached" : "Upgrade needed", {
              description: errMsg,
              duration: 9000,
              action: {
                label: flags.needsAuth ? "Sign in" : "Upgrade",
                onClick: () => onUpgradeNeeded?.(!!flags.needsAuth),
              },
            });
            onUpgradeNeeded?.(!!flags.needsAuth);
          } else {
            // Surface API failures clearly (missing key, model error, etc.)
            toast.error("Generation failed", {
              description: errMsg.slice(0, 220),
              duration: 9000,
            });
          }
          onStreamDelta?.("");

          const next = queueRef.current[0];
          if (next) {
            setQueue((q) => q.slice(1));
            setTimeout(() => drainQueueRef.current(next), 80);
          }
        },
        {
          customSystemPrompt,
          maxTokens,
          outputFormat,
          brandKit,
          previewTheme,
          previousCode: latestCode,
          designStyle: styleForGen,
        }
      );

      if (duelMode && duelModel) {
        duelAbortRef.current = streamChat(
          sid,
          finalMsg,
          provider,
          duelModel,
          apiKey,
          ollamaUrl,
          temperature,
          (delta) => {
            duelFullText += delta;
            setDuelStreamingText(duelFullText);
          },
          () => {},
          () => {},
          () => {
            onStreamComplete(duelFullText);
            if (fullText) finishStream(fullText);
          },
          () => {},
          {
            customSystemPrompt,
            maxTokens,
            outputFormat,
            brandKit,
            previewTheme,
            previousCode: latestCode,
            designStyle: styleForGen,
          }
        );
      }
    },
    [
      isStreaming,
      sessionId,
      provider,
      model,
      apiKey,
      ollamaUrl,
      temperature,
      customSystemPrompt,
      maxTokens,
      outputFormat,
      brandKit,
      previewTheme,
      designStyle,
      onDesignStyleChange,
      latestCode,
      onStreamStart,
      onStreamComplete,
      onStreamDelta,
      onTitleUpdate,
      onNewSession,
      onBootstrapProject,
      onUpgradeNeeded,
      onUserPrompt,
      duelMode,
      duelModel,
      promptOptimizer,
      finishStream,
    ]
  );

  const handleSend = useCallback(
    async (text?: string, sendOpts?: { designStyle?: string }) => {
      const msg = text || input;
      if (!msg.trim()) return;
      await startGeneration(msg.trim(), sendOpts);
    },
    [input, startGeneration]
  );

  const handleRedirect = useCallback(() => {
    const msg = input.trim();
    if (!msg || !isStreaming) return;
    // Abort current build, drop queue, inject new direction
    abortRef.current?.abort();
    duelAbortRef.current?.abort();
    setQueue([]);
    queueRef.current = [];
    const partial = streamTextRef.current;
    setIsStreaming(false);
    setStreamingText("");
    setStreamingThoughts("");
    setDuelStreamingText("");
    streamTextRef.current = "";
    abortRef.current = null;
    duelAbortRef.current = null;
    if (partial.trim()) onStreamComplete(partial);
    onStreamDelta?.("");
    setInput("");
    toast.message("Redirected", { description: "Stopped previous build — starting new direction" });
    setTimeout(() => {
      void startGeneration(msg, { force: true, skipClarify: true });
    }, 100);
  }, [input, isStreaming, onStreamComplete, onStreamDelta, startGeneration]);

  drainQueueRef.current = (next?: string) => {
    if (next) void startGeneration(next, { skipClarify: true });
  };

  /** Expand a rough idea into a stronger UI generation prompt (no extra API call). */
  const improvePrompt = useCallback(() => {
    const raw = input.trim();
    if (!raw || isOptimizing) return;
    setIsOptimizing(true);
    try {
      // Already looks structured — light polish only
      if (
        raw.length > 280 &&
        /\b(hero|navbar|dashboard|cta|useState|pricing)\b/i.test(raw)
      ) {
        const polished = raw
          .replace(/\s+/g, " ")
          .replace(/\.\s*$/, "")
          .concat(
            ". Production React + Tailwind, mobile-first, interactive useState where useful, concrete copy (no lorem)."
          );
        setInput(polished);
        toast.message("Prompt improved", {
          description: "Tightened for clearer generation",
        });
        return;
      }

      const idea = raw.replace(/^build\s+(me\s+)?/i, "").replace(/\.$/, "");
      const improved = [
        `Build a polished, production-ready UI for: ${idea}.`,
        "Include: clear visual hierarchy, navbar or app chrome if relevant, primary hero/action, concrete benefit-driven copy (no lorem / Feature 1), and at least one interactive piece with useState (tabs, form success, toggle, or menu).",
        "Mobile-first Tailwind, high contrast, hover/focus states, real CTAs.",
        "If multi-section: split into files (Navbar, Hero, etc.) with entry src/Component.tsx.",
      ].join(" ");
      setInput(improved);
      toast.success("Prompt helper", {
        description: "Expanded your idea into a full UI brief — edit or send",
      });
    } finally {
      setIsOptimizing(false);
    }
  }, [input, isOptimizing]);

  const PromptHelperButton = ({
    className,
    showLabel = true,
  }: {
    className?: string;
    showLabel?: boolean;
  }) => (
    <button
      type="button"
      onClick={improvePrompt}
      disabled={!input.trim() || isOptimizing || isStreaming}
      title="AI prompt helper — expand your idea into a stronger brief"
      aria-label="Improve prompt"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] font-medium text-amber-200/95 transition-all hover:border-amber-500/50 hover:bg-amber-500/15 active:scale-[0.98] disabled:opacity-35 disabled:hover:bg-amber-500/10",
        className
      )}
    >
      {isOptimizing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
      )}
      {showLabel && <span className="hidden sm:inline">Improve prompt</span>}
    </button>
  );

  // Auto-send once per session+prompt (landing bootstrap). Module-level guard
  // survives React Strict Mode remounts without dropping the stream.
  useEffect(() => {
    if (!initialPrompt || !sessionId) return;
    const key = `${sessionId}::${initialPrompt}`;
    if (bootedPrompts.has(key)) return;
    bootedPrompts.add(key);
    const prompt = initialPrompt;
    onClearPrompt?.();
    void handleSend(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  const canBrowserAgent = Boolean(userInfo?.browserAgent);
  const handleInspireScrape = useCallback(async () => {
    const url = inspireUrl.trim();
    if (!url) return;
    if (!canBrowserAgent) {
      toast.error("Pro+ feature", {
        description: "Inspiration scrape from live URLs unlocks on Pro / Max.",
      });
      onUpgradeNeeded?.(false);
      return;
    }
    setInspireBusy(true);
    try {
      const res = await scrapeInspirationUrl(url);
      if (!res.scrape) {
        toast.error("Scrape failed", {
          description: res.error || "Worker unavailable",
        });
        return;
      }
      const brief = res.scrape.briefPrompt;
      setInput((prev) =>
        prev.trim()
          ? `${prev.trim()}\n\n${brief}`
          : `Build a polished landing page inspired by this site:\n\n${brief}`
      );
      setInspireOpen(false);
      if (res.deferred || res.scrape.source === "stub") {
        toast.message("Worker offline — stub brief inserted", {
          description:
            "Run workers/adgen-browser and set ADGEN_BROWSER_WORKER_URL for live scrape.",
          duration: 8000,
        });
      } else {
        toast.success("Inspiration loaded", {
          description: res.scrape.title || url,
          duration: 5000,
        });
      }
      textareaRef.current?.focus();
    } catch (e) {
      if (e instanceof ApiError && e.upgrade) {
        toast.error("Pro+ required", {
          description: e.message || "Upgrade for live URL inspiration",
        });
        onUpgradeNeeded?.(false);
      } else {
        toast.error("Scrape failed", {
          description: e instanceof Error ? e.message : "Network error",
        });
      }
    } finally {
      setInspireBusy(false);
    }
  }, [inspireUrl, canBrowserAgent, onUpgradeNeeded]);

  /**
   * Chat shows conversation only — no code dumps.
   * Extracts plan prose (before first fence) + summary (after last fence).
   * Code lives in the preview / Code tab on the right.
   */
  const chatOnly = (content: string) => {
    const hasCode = /```/.test(content);
    const firstFence = content.search(/```/);
    let plan = "";
    let summary = "";
    if (firstFence < 0) {
      plan = content.trim();
    } else {
      plan = content.slice(0, firstFence).trim();
      // Find end of last closed fence (``` ... ```)
      const fenceRe = /```[\w-]*(?:[^\n`]*)?\n[\s\S]*?```/g;
      let lastEnd = -1;
      let m: RegExpExecArray | null;
      while ((m = fenceRe.exec(content)) !== null) {
        lastEnd = m.index + m[0].length;
      }
      if (lastEnd >= 0 && lastEnd < content.length) {
        summary = content.slice(lastEnd).trim();
      }
    }
    // Strip accidental inline code leftovers / empty fence noise from prose
    const clean = (s: string) =>
      s
        .replace(/```[\s\S]*$/g, "")
        .replace(/`{3,}/g, "")
        .trim();
    plan = clean(plan);
    summary = clean(summary);
    const fileMatches = [...content.matchAll(/file=["']([^"']+)["']/gi)].map(
      (m) => m[1]
    );
    const fileCount =
      fileMatches.length ||
      (hasCode ? Math.max(1, (content.match(/```(?:tsx?|jsx?)/gi) || []).length) : 0);
    return { plan, summary, prose: plan, hasCode, fileCount, files: fileMatches };
  };

  const renderChatMessage = (content: string, opts?: { streaming?: boolean }) => {
    const { plan, summary, hasCode, fileCount, files } = chatOnly(content);
    const showBuilding = opts?.streaming && hasCode;
    const planningOnly = opts?.streaming && !hasCode && !!plan;
    return (
      <div className="space-y-2.5">
        {plan ? (
          <div className="space-y-1">
            {(hasCode || planningOnly) && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/80">
                {opts?.streaming && !hasCode ? "Planning" : "Plan"}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {plan}
            </p>
          </div>
        ) : opts?.streaming && !hasCode ? (
          <p className="text-sm text-muted-foreground">Thinking…</p>
        ) : null}
        {showBuilding && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-500/25 bg-orange-500/5 px-2.5 py-2 text-[11px] text-orange-200/90">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-400" />
            <span>Building UI in the preview…</span>
          </div>
        )}
        {!opts?.streaming && hasCode && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
            <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400/90" />
            <div className="min-w-0">
              <p className="font-medium text-foreground/90">
                UI ready · see preview
              </p>
              <p className="mt-0.5 truncate">
                {fileCount > 1
                  ? `${fileCount} files`
                  : files[0] || "src/Component.tsx"}{" "}
                · open Code tab for source
              </p>
            </div>
          </div>
        )}
        {summary ? (
          <div className="space-y-1 border-t border-border/40 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {summary}
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  const models = PROVIDER_MODELS[provider] || [];
  const modelLabel = models.find((m) => m.value === model)?.label || model;
  const gensUsed = userInfo?.generationsToday ?? 0;
  const gensLimit = userInfo?.generationsLimit;
  const hasGenCap = gensLimit != null;
  const usagePct =
    hasGenCap && gensLimit
      ? Math.min(100, Math.round((gensUsed / gensLimit) * 100))
      : 0;

  if (isLanding && messages.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/35 bg-gradient-to-br from-orange-500/25 via-orange-500/10 to-transparent shadow-[0_0_48px_-12px_rgba(249,115,22,0.55)]">
            <Sparkles className="h-7 w-7 text-orange-400" />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400/90">
            AdGenAI · for developers
          </p>
          <h1 className="mb-3 max-w-xl text-center text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Describe the idea.{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Get the UI.
            </span>
          </h1>
          <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
            Production React + Tailwind. Live preview while it builds. Iterate in chat, then push to GitHub.
          </p>

          {/* Style chips — design brief for generation */}
          <div className="mb-5 w-full max-w-2xl">
            <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
              <Palette className="h-3 w-3 text-orange-400/90" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Style
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {STYLE_CHIP_OPTIONS.map((opt) => {
                const active = (designStyle || "auto") === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.title}
                    onClick={() => onDesignStyleChange?.(opt.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      active
                        ? "border-orange-500/50 bg-orange-500/15 text-orange-200 shadow-[0_0_16px_-8px_rgba(249,115,22,0.5)]"
                        : "border-border/80 bg-card/60 text-muted-foreground hover:border-orange-500/30 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-2 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {PROMPT_TEMPLATES.map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon] || Layout;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setInput(t.prompt);
                    void handleSend(t.prompt, {
                      designStyle: t.designStyle,
                    });
                  }}
                  className="group flex items-center gap-2.5 rounded-xl border border-border/80 bg-card/80 px-3 py-3 text-left shadow-sm transition-all hover:border-orange-500/45 hover:bg-orange-500/[0.06] hover:shadow-[0_0_24px_-12px_rgba(249,115,22,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 transition-colors group-hover:bg-orange-500/15">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-orange-400" />
                  </span>
                  <span className="truncate text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 bg-background/80 px-4 py-4 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl">
            <div className="relative flex max-h-[min(42vh,300px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_40px_-20px_rgba(0,0,0,0.6)] transition-colors focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What are you building? e.g. Waitlist page for an AI code review tool..."
                rows={3}
                className="min-h-[4.5rem] w-full max-h-[min(34vh,240px)] resize-none overflow-y-auto overscroll-contain bg-transparent px-4 pb-12 pt-3.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 scrollbar-thin"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-12 bg-gradient-to-t from-card via-card/95 to-transparent" />
              <div className="absolute bottom-2.5 left-3 z-10 flex items-center gap-1.5">
                <PromptHelperButton />
              </div>
              <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-2">
                <kbd className="hidden rounded-md border border-border bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                  {isMac ? "⌘↵" : "Ctrl+↵"}
                </kbd>
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-[0_0_20px_-6px_rgba(249,115,22,0.7)] transition-all hover:bg-orange-400 disabled:opacity-30 disabled:shadow-none"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              Tip: type a rough idea, tap <span className="text-amber-400/90">Improve prompt</span>, then send
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {onHideChat && (
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-2 py-1.5">
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Chat
          </span>
          <button
            type="button"
            onClick={onHideChat}
            title="Hide chat — expand preview"
            aria-label="Hide chat"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hide</span>
          </button>
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3 animate-fadeIn">
            <div
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                m.role === "user" ? "bg-accent" : "bg-card border border-border"
              )}
            >
              {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
              {m.role === "assistant"
                ? renderChatMessage(m.content)
                : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
            </div>
          </div>
        ))}

        {isStreaming && (streamingText || streamingThoughts) && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-foreground">
              {/* Collapsible reasoning (v0-style thinking) when provider streams CoT */}
              {streamingThoughts ? (
                <ThinkingBlock
                  thought={streamingThoughts}
                  streaming={!streamingText}
                  defaultOpen={!streamingText}
                />
              ) : null}
              {streamingText ? (
                renderChatMessage(streamingText, { streaming: true })
              ) : !streamingThoughts ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connecting…
                </div>
              ) : null}
            </div>
          </div>
        )}

        {isStreaming && !streamingText && !streamingThoughts && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                <span className="text-foreground/90">Planning your UI…</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-5">
                Chat will show the plan, then the preview builds — no code dump here.
              </p>
            </div>
          </div>
        )}

        {duelStreamingText && (
          <div className="flex gap-3 animate-fadeIn border-l-2 border-blue-500/30 pl-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="flex-1 text-sm text-foreground leading-relaxed min-w-0">
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Duelist Output ({duelModel?.split("-")[0]})
              </div>
              {renderChatMessage(duelStreamingText, { streaming: true })}
            </div>
          </div>
        )}

        {streamError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fadeIn">
            <p className="font-medium">Generation failed</p>
            <p className="mt-0.5 text-destructive/80">{streamError}</p>
            <button
              type="button"
              onClick={() => setStreamError(null)}
              className="mt-2 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Design style chips */}
      <div className="border-t border-border/50 px-3 pt-2 md:px-4">
        <div className="mb-1 flex items-center gap-1.5">
          <Palette className="h-3 w-3 text-orange-400/80" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Style
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {STYLE_CHIP_OPTIONS.map((opt) => {
            const active = (designStyle || "auto") === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.title}
                onClick={() => {
                  onDesignStyleChange?.(opt.id);
                  if (opt.id !== designStyle) {
                    toast.message("Style set", {
                      description:
                        opt.id === "auto"
                          ? "Auto — matched from your next prompt"
                          : `${opt.label}: ${opt.title}`,
                    });
                  }
                }}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  active
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                    : "border-border bg-card/80 text-muted-foreground hover:border-orange-500/30 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {latestCode && !isStreaming && (
        <div className="flex flex-col gap-1.5 border-t border-border/50 px-4 pt-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Iterate on{" "}
            <span className="font-mono normal-case tracking-normal text-orange-300/90">
              {baseVersionLabel || "this version"}
            </span>
            {baseVersionLabel && !baseVersionLabel.includes("latest") ? (
              <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/80">
                · switch chips in preview to pick another
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {onFixFromQa &&
              lastQaScore != null &&
              lastQaScore < 85 && (
                <button
                  type="button"
                  onClick={onFixFromQa}
                  className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-500/50 hover:bg-amber-500/15"
                  title="Auto-build a fix prompt from the last Browser QA"
                >
                  Fix from QA · {lastQaScore}
                </button>
              )}
            {ITERATE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleSend(chip.prompt)}
                className="rounded-md border border-orange-500/20 bg-orange-500/5 px-2.5 py-1 text-[11px] text-orange-200/90 transition-colors hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-100"
              >
                {chip.label}
              </button>
            ))}
            {REGEN_CHIPS.map((chip) => (
              <button
                key={chip.section}
                type="button"
                onClick={() =>
                  handleSend(
                    `Regenerate only the ${chip.section} section. Keep everything else.`,
                  )
                }
                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status + model picker */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-3 py-1.5">
        <div className="relative flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isStreaming
                ? "animate-pulse bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.7)]"
                : "bg-emerald/50"
            )}
          />
          <button
            type="button"
            onClick={() => setModelOpen((o) => !o)}
            className="flex max-w-[14rem] items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-left text-[11px] font-medium text-foreground transition-colors hover:border-orange-500/40 hover:bg-accent"
            title="Change model"
          >
            <span className="truncate">
              {PROVIDER_INFO[provider]?.name?.split(" ")[0] || provider} · {modelLabel}
            </span>
            <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", modelOpen && "rotate-180")} />
          </button>
          {modelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-2xl">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {PROVIDER_INFO[provider]?.name || provider}
                </p>
                {models.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      onModelChange?.(m.value);
                      setModelOpen(false);
                      toast.message("Model set", { description: m.label });
                    }}
                    className={cn(
                      "flex w-full flex-col px-3 py-2 text-left text-xs transition-colors",
                      m.value === model
                        ? "bg-orange-500/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span className="font-medium">{m.label}</span>
                    {m.description && (
                      <span className="text-[10px] opacity-70">{m.description}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {duelMode && duelModel && (
            <span className="hidden text-[10px] font-medium text-blue-400 sm:inline">
              vs {duelModel.split("-")[0]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
          <span className={isStreaming ? "text-orange-400" : ""}>
            {isStreaming ? "Building" : "Ready"}
          </span>
          {queue.length > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-orange-500/10 px-1.5 py-0.5 font-medium text-orange-300">
              <ListPlus className="h-3 w-3" />
              {queue.length} queued
            </span>
          )}
        </div>
      </div>

      {/* Queued follow-ups */}
      {queue.length > 0 && (
        <div className="space-y-1 border-t border-border/40 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Queue
          </p>
          {queue.map((q, i) => (
            <div
              key={`${i}-${q.slice(0, 12)}`}
              className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground"
            >
              <span className="mt-0.5 font-mono text-[9px] text-orange-400/80">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{q}</span>
              <button
                type="button"
                onClick={() => setQueue((prev) => prev.filter((_, j) => j !== i))}
                className="rounded p-0.5 hover:bg-accent hover:text-foreground"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Clarify before expensive first build */}
      {clarify && (
        <div className="border-t border-border/50 bg-card/80 px-3 py-3 md:px-4">
          <div className="mb-2 flex items-start gap-2">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div>
              <p className="text-xs font-semibold text-foreground">Quick clarify</p>
              <p className="text-[11px] text-muted-foreground">
                “{clarify.original.slice(0, 80)}
                {clarify.original.length > 80 ? "…" : ""}” is a bit open — pick a direction to save a generation.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {clarify.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void startGeneration(c.prompt, { skipClarify: true })}
                className="rounded-lg border border-border bg-background px-2.5 py-2 text-left text-[11px] font-medium text-foreground transition-colors hover:border-orange-500/40 hover:bg-orange-500/5"
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void startGeneration(clarify.original, { skipClarify: true })
              }
              className="text-[11px] font-medium text-orange-400 hover:underline"
            >
              Skip — build as written
            </button>
            <button
              type="button"
              onClick={() => {
                setInput(clarify.original);
                setClarify(null);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Edit prompt
            </button>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-border/40 bg-background/95 px-3 pb-3 pt-2 backdrop-blur-sm md:px-4">
        {inspireOpen && (
          <div className="mb-2 space-y-2 rounded-xl border border-orange-500/25 bg-orange-500/5 p-2.5 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">
              <Globe2 className="h-3 w-3" />
              Inspire from URL
              {!canBrowserAgent && (
                <span className="rounded bg-orange-500/20 px-1 py-0.5 text-[9px] normal-case tracking-normal">
                  Pro+
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Live scrape (Playwright worker) → palette, CTAs, headlines into your prompt.
              {canBrowserAgent
                ? " Pro+ enabled."
                : " Unlock on Pro / Max — or upgrade toast will appear."}
            </p>
            <div className="flex flex-wrap gap-1">
              {["https://linear.app", "https://stripe.com", "https://vercel.com"].map(
                (u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setInspireUrl(u)}
                    className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-orange-500/30 hover:text-foreground"
                  >
                    {u.replace("https://", "")}
                  </button>
                )
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={inspireUrl}
                onChange={(e) => setInspireUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleInspireScrape();
                  }
                }}
                placeholder="https://your-favorite-saas.com"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-orange-500/40"
              />
              <button
                type="button"
                disabled={inspireBusy || !inspireUrl.trim()}
                onClick={() => void handleInspireScrape()}
                className="flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                {inspireBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                {inspireBusy ? "Scraping…" : "Scrape"}
              </button>
              <button
                type="button"
                onClick={() => setInspireOpen(false)}
                className="rounded-lg border border-border px-2 text-xs text-muted-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Usage meter */}
        {userInfo && hasGenCap && gensLimit != null && (
          <div className="mb-2 flex items-center gap-2 px-0.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePct > 80 ? "bg-amber-500" : "bg-emerald"
                )}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {gensUsed}/{gensLimit} gens
            </span>
          </div>
        )}
        {userInfo && !hasGenCap && userInfo.plan !== "free" && (
          <p className="mb-2 px-0.5 text-[10px] font-medium text-emerald/80">
            {userInfo.plan === "max" ? "Max" : userInfo.plan === "pro" ? "Pro" : "Builder"} ·{" "}
            unlimited gens
          </p>
        )}

        <div
          className={cn(
            "relative flex max-h-[min(42vh,300px)] flex-col overflow-hidden rounded-xl border transition-all duration-300 focus-within:border-orange-500/40 focus-within:ring-2 focus-within:ring-orange-500/15",
            hackerMode
              ? "border-emerald/20 bg-black shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              : "border-border bg-card"
          )}
        >
          {hackerMode && (
            <div className="pointer-events-none absolute left-3 top-2 z-10 font-mono text-[10px] uppercase tracking-widest text-emerald/50">
              adgen@user:~$
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hackerMode
                ? ""
                : isStreaming
                  ? "Type a follow-up — queues until this build finishes…"
                  : latestCode
                    ? "Iterate… e.g. make the hero punchier, add pricing, mobile nav"
                    : "What are you building? Describe the product or UI…"
            }
            rows={2}
            className={cn(
              "min-h-[2.75rem] w-full max-h-[min(34vh,240px)] flex-1 resize-none overflow-y-auto overscroll-contain bg-transparent pb-11 pt-3 outline-none transition-all scrollbar-thin",
              hackerMode
                ? "px-4 pl-24 font-mono text-xs text-emerald placeholder:text-emerald/20"
                : "px-3 text-sm text-foreground placeholder:text-muted-foreground md:px-4"
            )}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-11 bg-gradient-to-t from-card via-card/95 to-transparent" />
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
            <PromptHelperButton />
            <button
              type="button"
              onClick={() => setInspireOpen((v) => !v)}
              className={cn(
                "rounded-lg border p-1.5 transition-all active:scale-95",
                inspireOpen
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title="Inspire from URL (browser scrape)"
            >
              <Globe2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setHackerMode(!hackerMode)}
              className={cn(
                "rounded-lg border p-1.5 transition-all active:scale-95",
                hackerMode
                  ? "border-emerald/20 bg-emerald/10 text-emerald"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title="Terminal mode"
            >
              <Terminal className="h-3.5 w-3.5" />
            </button>
            {duelMode && (
              <span className="flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase text-blue-400">
                <Zap className="h-3 w-3" />
                Duel
              </span>
            )}
          </div>
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-2">
            <kbd
              className={cn(
                "hidden rounded border px-1 py-0.5 font-mono text-[10px] md:inline-block",
                hackerMode
                  ? "border-emerald/20 bg-emerald/5 text-emerald/50"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {isMac ? "⌘↵" : "Ctrl+↵"}
            </kbd>
            {isStreaming ? (
              <>
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/90 px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  title="Stop generation"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </button>
                {input.trim() ? (
                  <button
                    type="button"
                    onClick={handleRedirect}
                    className="flex h-8 items-center gap-1 rounded-lg bg-orange-500 px-2.5 text-[11px] font-bold text-white hover:bg-orange-400"
                    title="Stop current build and start this new direction"
                  >
                    <CornerDownRight className="h-3.5 w-3.5" />
                    Redirect
                  </button>
                ) : null}
                {input.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    className="flex h-8 items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    title="Queue follow-up after this build"
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                    Queue
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all disabled:opacity-30",
                  hackerMode
                    ? "bg-emerald text-black shadow-[0_0_15px_rgba(16,185,129,0.45)]"
                    : "bg-orange-500 text-white hover:bg-orange-400"
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
