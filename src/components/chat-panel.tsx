"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { streamChat, scrapeInspirationUrl, ApiError } from "@/lib/api-client";
import { isContinueRepairPrompt, readTruncatedPaths } from "@/lib/file-checkpoint";
import { type TruncationRisk } from "@/lib/truncation-risk";
import {
  resolveEffectiveMaxTokens,
  shouldShowTokenGuard,
  type SendOptions,
} from "@/lib/token-guard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { listProjectFiles } from "@/lib/project-files";
import { analyzeSourceTruncation } from "@/lib/code-truncation";
import {
  parseToolLog,
  type StudioToolEvent,
} from "@/lib/studio-tool-log";
import { rebuildPromptFromUrl } from "@/lib/rebuild-prompt";
import type { Message, AIProvider, BrandKit, UserInfo, CodeVersion } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
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
  globe: Globe2,
};

function ToolTrace({ events }: { events: StudioToolEvent[] }) {
  if (!events.length) return null;
  return (
    <ul className="space-y-1 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
      {events.map((e, i) => (
        <li
          key={`${e.name}-${i}`}
          className="flex items-center gap-2 text-[11px] text-muted-foreground"
        >
          {e.status === "running" ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-orange-400" />
          ) : e.name === "generate_image" ? (
            <Sparkles className="h-3 w-3 shrink-0 text-orange-400" />
          ) : (
            <Globe2 className="h-3 w-3 shrink-0 text-orange-400" />
          )}
          <span className="min-w-0 truncate">
            {e.status === "error" ? `Failed: ${e.summary}` : e.summary}
          </span>
        </li>
      ))}
    </ul>
  );
}

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
  /** BYOB schema map for prompt context (no connection string). */
  byobSchema?: import("@/lib/byob/types").DatabaseSchemaMap | null;
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
  onBootstrapProject?: (prompt: string, sendOpts?: SendOptions) => Promise<void>;
  onUpgradeNeeded?: (needsAuth: boolean) => void;
  initialPrompt?: string | null;
  /** One-send options (guard raise/skip) carried across the landing bootstrap. */
  initialSendOpts?: SendOptions | null;
  /** Guided store brief from /studio/new-store — passed through to /api/chat */
  storeBrief?: import("@/lib/commerce/store-brief").StoreBrief | null;
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
  /** Prefill Rebuild-from-URL field (e.g. /studio?rebuild=https://…) */
  initialRebuildUrl?: string | null;
  /** Show Fix-from-QA chip when last audit has issues */
  lastQaScore?: number | null;
  onFixFromQa?: () => void;
  /** All saved versions, oldest-first. The k-th assistant message that
   * delivered code maps to versions[k] (one version row per code-bearing
   * generation, created in order) — so every code chip can report its own
   * truncation state, not just the newest message. */
  versions?: CodeVersion[];
  /** Synchronous truncation verdict for the just-finished generation,
   * until versions refetch. */
  pendingTruncated?: boolean | null;
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
  byobSchema,
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
  initialSendOpts,
  storeBrief = null,
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
  initialRebuildUrl,
  versions = [],
  pendingTruncated = null,
}: ChatPanelProps) {
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThoughts, setStreamingThoughts] = useState("");
  const [duelStreamingText, setDuelStreamingText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hackerMode, setHackerMode] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  // Pre-send truncation guard: pending send held for user confirmation when the
  // prompt looks like a bigger build than the studio's maxTokens can output.
  const [tokenGuard, setTokenGuard] = useState<{
    msg: string;
    risk: TruncationRisk;
    sendOpts?: SendOptions;
  } | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspireUrl, setInspireUrl] = useState("");
  const [inspireBusy, setInspireBusy] = useState(false);
  const [streamingTools, setStreamingTools] = useState<StudioToolEvent[]>([]);
  const [rebuildUrl, setRebuildUrl] = useState(initialRebuildUrl || "");
  const rebuildUrlRef = useRef<HTMLInputElement>(null);
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
    if (initialRebuildUrl) setRebuildUrl(initialRebuildUrl);
  }, [initialRebuildUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, queue]);

  // Auto-size composer with a hard viewport cap (field-sizing alone can overflow)
  useEffect(() => {
    const fit = () => {
      const el = textareaRef.current;
      if (!el) return;
      const maxPx = Math.min(Math.round(window.innerHeight * 0.28), 200);
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxPx);
      el.style.height = `${Math.max(next, 44)}px`;
      el.style.overflowY = el.scrollHeight > maxPx + 1 ? "auto" : "hidden";
      el.scrollTop = el.scrollHeight;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [input]);

  // Prefill from Fix-from-QA / external inject
  useEffect(() => {
    if (!pendingPromptFill?.trim()) return;
    setInput(pendingPromptFill);
    onClearPendingPrompt?.();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const maxPx = Math.min(Math.round(window.innerHeight * 0.28), 200);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
      el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
      el.scrollTop = el.scrollHeight;
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
      opts?: {
        force?: boolean;
        skipClarify?: boolean;
        designStyle?: string;
        maxTokensOverride?: number;
        skipTokenGuard?: boolean;
      }
    ) => {
      if (!msg.trim()) return;
      if (opts?.designStyle) {
        designStyleRef.current = opts.designStyle;
        onDesignStyleChange?.(opts.designStyle);
      }
      const styleForGen = opts?.designStyle || designStyleRef.current || designStyle;
      // One-send token-budget override (from the pre-send truncation guard).
      const effectiveMaxTokens = resolveEffectiveMaxTokens(
        opts?.maxTokensOverride,
        maxTokens
      );

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
          await onBootstrapProject(msg.trim(), opts);
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

      if (!sid) {
        const errMsg = "Could not create a project. Try again, or sign in if you hit the free project cap.";
        setStreamError(errMsg);
        toast.error("Generation did not start", { description: errMsg });
        return;
      }

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
      setStreamingTools([]);
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
          maxTokens: effectiveMaxTokens,
          outputFormat,
          brandKit,
          previewTheme,
          previousCode: latestCode,
          designStyle: styleForGen,
          uiLocale: locale,
          byobSchema: byobSchema || null,
          storeBrief: storeBrief || null,
          isRepairContinue: isContinueRepairPrompt(finalMsg) || undefined,
          onTool: (ev) => {
            setStreamingTools((prev) => {
              const next = [...prev];
              const i = next.findIndex(
                (t) => t.name === ev.name && t.status === "running"
              );
              const row: StudioToolEvent = {
                name: ev.name as StudioToolEvent["name"],
                status: ev.status,
                summary: ev.summary || ev.name,
                url: ev.url,
              };
              if (i >= 0) next[i] = row;
              else next.push(row);
              return next;
            });
          },
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
            maxTokens: effectiveMaxTokens,
            outputFormat,
            brandKit,
            previewTheme,
            previousCode: latestCode,
            designStyle: styleForGen,
            uiLocale: locale,
            byobSchema: byobSchema || null,
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
      byobSchema,
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
      locale,
      storeBrief,
    ]
  );

  const handleSend = useCallback(
    async (text?: string, sendOpts?: SendOptions) => {
      const msg = text || input;
      if (!msg.trim()) {
        toast.error("Type a prompt first", {
          description: "Or pick Agent-ready store, then hit Send.",
        });
        return;
      }
      // Pre-send truncation guard: a big multi-file brief at a low maxTokens
      // budget will truncate mid-file and burn the generation. Hold the send
      // and offer a one-click raise instead. Repair-Continue prompts are
      // single-file by design, so they skip the guard.
      const guardRisk = shouldShowTokenGuard(msg, maxTokens, sendOpts);
      if (guardRisk) {
        setTokenGuard({ msg: msg.trim(), risk: guardRisk, sendOpts });
        return;
      }
      await startGeneration(msg.trim(), sendOpts);
    },
    [input, startGeneration, maxTokens]
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
        "inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] font-medium text-amber-600 transition-all hover:border-amber-500/50 hover:bg-amber-500/15 active:scale-[0.98] disabled:opacity-35 disabled:hover:bg-amber-500/10",
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
  // One-send guard decisions (raise/skip) from the landing guard dialog ride
  // along via initialSendOpts so the post-bootstrap auto-send does not
  // re-trigger the guard.
  useEffect(() => {
    if (!initialPrompt || !sessionId) return;
    const key = `${sessionId}::${initialPrompt}`;
    if (bootedPrompts.has(key)) return;
    bootedPrompts.add(key);
    const prompt = initialPrompt;
    onClearPrompt?.();
    void handleSend(prompt, initialSendOpts ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, sessionId, initialSendOpts]);

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
    const { rest } = parseToolLog(content);
    content = rest;
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

  /**
   * Order index of each message among assistant messages that delivered
   * code. The k-th such message maps to versions[k]: the studio saves one
   * version row per code-bearing generation, oldest-first.
   */
  const codeOrderByIdx = useMemo(() => {
    const byIdx = new Array<number>(messages.length).fill(-1);
    let k = 0;
    messages.forEach((m, i) => {
      if (m.role !== "assistant") return;
      try {
        const { rest } = parseToolLog(m.content);
        if (/```/.test(rest)) byIdx[i] = k++;
      } catch {
        /* ignore unparseable content */
      }
    });
    return { byIdx, count: k };
  }, [messages]);

  /**
   * Truncation state of one saved version's code. Prefers the per-file
   * truncated list; falls back to a structural scan for legacy versions
   * saved before per-file tracking existed.
   */
  const versionTruncated = (code: string): boolean => {
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
  };

  /**
   * Truncation state of the code delivered in message idx: true/false when
   * the message↔version alignment holds (counts line up), null when unknown.
   * The newest code message also honors the synchronous pending verdict,
   * which covers the window before versions refetch.
   */
  const messageCodeTruncated = (idx: number): boolean | null => {
    const k = codeOrderByIdx.byIdx[idx] ?? -1;
    if (k < 0) return null;
    if (codeOrderByIdx.count !== versions.length || versions.length === 0)
      return null;
    const vFlag = versionTruncated(versions[k]?.code ?? "");
    return k === codeOrderByIdx.count - 1 ? (pendingTruncated ?? vFlag) : vFlag;
  };

  const renderChatMessage = (
    content: string,
    opts?: { streaming?: boolean; truncated?: boolean | null }
  ) => {
    const parsedTools = parseToolLog(content);
    const { plan, summary, hasCode, fileCount, files } = chatOnly(content);
    const showBuilding = opts?.streaming && hasCode;
    const planningOnly = opts?.streaming && !hasCode && !!plan;
    return (
      <div className="space-y-2.5">
        {parsedTools.events.length ? (
          <ToolTrace events={parsedTools.events} />
        ) : null}
        {plan ? (
          <div className="space-y-1">
            {(hasCode || planningOnly) && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/80">
                {opts?.streaming && !hasCode
                  ? t("chat.planningLabel")
                  : t("chat.plan")}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {plan}
            </p>
          </div>
        ) : opts?.streaming && !hasCode ? (
          <p className="text-sm text-muted-foreground">{t("chat.thinking")}</p>
        ) : null}
        {showBuilding && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-500/25 bg-orange-500/5 px-2.5 py-2 text-[11px] font-medium text-orange-500">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-500" />
            <span>{t("chat.buildingPreview")}</span>
          </div>
        )}
        {!opts?.streaming && hasCode && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
            <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400/90" />
            <div className="min-w-0">
              <p className="font-medium text-foreground/90">
                {opts?.truncated
                  ? t("chat.needsContinue")
                  : t("chat.uiReady")}
              </p>
              <p className="mt-0.5 truncate">
                {fileCount > 1
                  ? `${fileCount} ${t("chat.files")}`
                  : files[0] || "src/Component.tsx"}{" "}
                · {t("chat.openCode")}
              </p>
            </div>
          </div>
        )}
        {summary ? (
          <div className="space-y-1 border-t border-border/40 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("chat.summary")}
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

  // Pre-send truncation guard dialog. Rendered in BOTH the landing and the
  // session layouts: the landing composer shares handleSend, so without this
  // the guard would swallow the send silently (dialog state set, nothing
  // shown, generation never started).
  const tokenGuardDialog = (
    <Dialog
      open={tokenGuard !== null}
      onOpenChange={(open) => {
        if (!open) setTokenGuard(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.tokenGuardTitle")}</DialogTitle>
          <DialogDescription>
            {t("chat.tokenGuardBody")
              .replace("{files}", String(tokenGuard?.risk.requestedFiles ?? 0))
              .replace(
                "{tokens}",
                `~${Math.round((tokenGuard?.risk.estimatedTokens ?? 0) / 1000)}k`
              )
              .replace(
                "{max}",
                `${Math.round((tokenGuard?.risk.maxTokens ?? 0) / 1000)}k`
              )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              const g = tokenGuard;
              setTokenGuard(null);
              if (g)
                startGeneration(g.msg, {
                  ...g.sendOpts,
                  skipTokenGuard: true,
                });
            }}
            className="flex h-9 items-center rounded-lg border border-border bg-muted/50 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            {t("chat.tokenGuardSendAnyway")}
          </button>
          <button
            type="button"
            onClick={() => {
              const g = tokenGuard;
              setTokenGuard(null);
              if (g)
                startGeneration(g.msg, {
                  ...g.sendOpts,
                  maxTokensOverride: g.risk.suggestedTokens,
                  skipTokenGuard: true,
                });
            }}
            className="flex h-9 items-center rounded-lg bg-orange-500 px-3 text-[13px] font-bold text-white hover:bg-orange-400"
          >
            {t("chat.tokenGuardRaise").replace(
              "{n}",
              `${Math.round((tokenGuard?.risk.suggestedTokens ?? 16384) / 1000)}k`
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLanding && messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
          <div className="mb-4 h-12 w-12 overflow-hidden rounded-2xl border border-orange-500/35 shadow-[0_0_48px_-12px_rgba(249,115,22,0.55)] ring-1 ring-orange-500/20 md:mb-5 md:h-16 md:w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shipboard-logo.jpg"
              alt="Shipboard"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400/90">
            {t("chat.forDevelopers")}
          </p>
          <h1 className="mb-2 max-w-xl text-center text-2xl font-bold tracking-tight text-foreground md:mb-3 md:text-4xl">
            {t("chat.heroTitle")}{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              {t("chat.heroAccent")}
            </span>
          </h1>
          <p className="mb-5 max-w-md text-center text-sm leading-relaxed text-muted-foreground md:mb-8">
            {t("chat.heroBody")}
          </p>

          {/* Style chips — design brief for generation */}
          <div className="mb-5 w-full max-w-2xl">
            <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
              <Palette className="h-3 w-3 text-orange-400/90" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("chat.style")}
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
                        ? "border-orange-500/50 bg-orange-500/15 text-orange-500 shadow-[0_0_16px_-8px_rgba(249,115,22,0.5)]"
                        : "border-border/80 bg-card/60 text-muted-foreground hover:border-orange-500/30 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Golden path — dogfood winners (BETA recipes 1 / 6 / 7) */}
          <div className="mb-3 w-full max-w-2xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-orange-400/90">
              Golden path
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROMPT_TEMPLATES.filter((t) =>
                ["Agent-ready store", "Rebuild from URL"].includes(t.label)
              ).map((t) => {
                const Icon = TEMPLATE_ICONS[t.icon] || Layout;
                const isRebuild = t.label === "Rebuild from URL";
                return (
                  <button
                    key={`gold-${t.label}`}
                    type="button"
                    onClick={() => {
                      if (isRebuild) {
                        rebuildUrlRef.current?.focus();
                        rebuildUrlRef.current?.select();
                        toast.message("Paste the live URL", {
                          description:
                            "Use the bar below — Shipboard reads the page, then builds.",
                          duration: 5000,
                        });
                        return;
                      }
                      window.location.href = "/studio/new-store";
                    }}
                    className="group flex items-center gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/[0.08] px-3 py-3 text-left shadow-[0_0_28px_-14px_rgba(249,115,22,0.5)] transition-all hover:border-orange-400/60 hover:bg-orange-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
                      <Icon className="h-3.5 w-3.5 text-orange-400" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {t.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {isRebuild
                          ? "Read the live site · honest facts only"
                          : "Start a store · name, products, vibe"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            className="mb-4 flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const url = rebuildUrl.trim();
              if (!/^https?:\/\//i.test(url)) {
                toast.error("Need a public http(s) URL");
                rebuildUrlRef.current?.focus();
                return;
              }
              void handleSend(rebuildPromptFromUrl(url), {
                designStyle: "minimal",
              });
            }}
          >
            <input
              ref={rebuildUrlRef}
              type="url"
              value={rebuildUrl}
              onChange={(e) => setRebuildUrl(e.target.value)}
              placeholder="https://your-site.com — rebuild from a live URL"
              className="min-w-0 flex-1 rounded-xl border border-orange-500/30 bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20"
            />
            <button
              type="submit"
              disabled={isStreaming}
              className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-40"
            >
              Rebuild
            </button>
          </form>

          <div className="mb-2 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {PROMPT_TEMPLATES.filter(
              (t) =>
                !["Rebuild from URL", "Agent-ready store"].includes(t.label)
            ).map((t) => {
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
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl">
            <div className="relative flex max-h-[min(32vh,240px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_40px_-20px_rgba(0,0,0,0.6)] transition-colors focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chat.placeholder")}
                rows={3}
                className="composer-textarea min-h-[4.5rem] w-full max-h-[min(28vh,200px)] shrink-0 resize-none overflow-y-auto overscroll-contain bg-transparent px-4 pb-12 pt-3.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 scrollbar-thin"
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
                  aria-label={t("chat.send")}
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
              {t("chat.tipImprove")}
            </p>
          </div>
        </div>
        {tokenGuardDialog}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-2 py-1.5">
        <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("nav.chat")}
        </span>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          {onHideChat && (
            <button
              type="button"
              onClick={onHideChat}
              title={t("nav.hideChat")}
              aria-label={t("nav.hideChat")}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("nav.hideChat")}</span>
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {(() => {
          // Each code message's chip reports that message's own truncation
          // state (via messageCodeTruncated), so a no-code follow-up can
          // never flip an older code message's chip.
          return messages.map((m, i) => (
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
                ? renderChatMessage(m.content, { truncated: messageCodeTruncated(i) })
                : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
            </div>
          </div>
          ));
        })()}

        {isStreaming &&
          (streamingText || streamingThoughts || streamingTools.length > 0) && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-foreground">
              {streamingTools.length ? (
                <ToolTrace events={streamingTools} />
              ) : null}
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

        {isStreaming &&
          !streamingText &&
          !streamingThoughts &&
          streamingTools.length === 0 && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                <span className="text-foreground/90">{t("chat.planning")}</span>
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
            <p className="font-medium">{t("chat.failed")}</p>
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
            {t("chat.style")}
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
                    toast.message(t("chat.style"), {
                      description:
                        opt.id === "auto"
                          ? "Auto"
                          : `${opt.label}: ${opt.title}`,
                    });
                  }
                }}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  active
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-500"
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
            {t("chat.iterateOn")}{" "}
            <span className="font-mono normal-case tracking-normal text-orange-300/90">
              {baseVersionLabel || "—"}
            </span>
            {baseVersionLabel && !baseVersionLabel.includes("latest") ? (
              <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/80">
                · {t("chat.switchVersion")}
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
                  className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 transition-colors hover:border-amber-500/50 hover:bg-amber-500/15"
                  title={t("chat.fixFromQa")}
                >
                  {t("chat.fixFromQa")} · {lastQaScore}
                </button>
              )}
            {ITERATE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleSend(chip.prompt)}
                className="rounded-md border border-orange-500/20 bg-orange-500/5 px-2.5 py-1 text-[11px] font-medium text-orange-500 transition-colors hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-600"
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
            {isStreaming ? t("chat.building") : t("chat.ready")}
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
            {t("chat.queue")}
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

      <div className="shrink-0 border-t border-border/40 bg-background/95 px-3 pb-3 pt-2 backdrop-blur-sm md:px-4 max-h-[min(45vh,360px)] overflow-y-auto">
        {inspireOpen && (
          <div className="mb-2 space-y-2 rounded-xl border border-orange-500/25 bg-orange-500/5 p-2.5 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">
              <Globe2 className="h-3 w-3" />
              {t("chat.inspire")}
              {!canBrowserAgent && (
                <span className="rounded bg-orange-500/20 px-1 py-0.5 text-[9px] normal-case tracking-normal">
                  Pro+
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("chat.inspireHint")}{" "}
              {!canBrowserAgent ? t("chat.inspirePro") : null}
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
                {inspireBusy ? t("chat.scraping") : t("chat.scrape")}
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
              {gensUsed}/{gensLimit} {t("gens.used")}
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
            "relative flex max-h-[min(32vh,240px)] flex-col overflow-hidden rounded-xl border transition-all duration-300 focus-within:border-orange-500/40 focus-within:ring-2 focus-within:ring-orange-500/15",
            hackerMode
              ? "border-emerald/20 bg-black shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              : "border-border bg-card"
          )}
        >
          {hackerMode && (
            <div className="pointer-events-none absolute left-3 top-2 z-10 font-mono text-[10px] uppercase tracking-widest text-emerald/50">
              shipboard@user:~$
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
                  ? t("chat.placeholderStreaming")
                  : latestCode
                    ? t("chat.placeholderIterate")
                    : t("chat.placeholder")
            }
            rows={2}
            className={cn(
              "composer-textarea min-h-[2.75rem] w-full max-h-[min(28vh,200px)] shrink-0 resize-none overflow-y-auto overscroll-contain bg-transparent pb-11 pt-3 outline-none transition-all scrollbar-thin",
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
                  title={t("chat.stop")}
                >
                  <Square className="h-3 w-3 fill-current" />
                  {t("chat.stop")}
                </button>
                {input.trim() ? (
                  <button
                    type="button"
                    onClick={handleRedirect}
                    className="flex h-8 items-center gap-1 rounded-lg bg-orange-500 px-2.5 text-[11px] font-bold text-white hover:bg-orange-400"
                    title={t("chat.redirect")}
                  >
                    <CornerDownRight className="h-3.5 w-3.5" />
                    {t("chat.redirect")}
                  </button>
                ) : null}
                {input.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    className="flex h-8 items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    title={t("chat.queue")}
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                    {t("chat.queue")}
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
      {/* Pre-send truncation guard: confirm before spending a generation on a
          build the token budget can't finish. */}
      {tokenGuardDialog}
    </div>
  );
}
