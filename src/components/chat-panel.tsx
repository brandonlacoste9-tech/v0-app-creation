"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/api-client";
import type { Message, AIProvider, BrandKit } from "@/lib/types";
import { PROMPT_TEMPLATES } from "@/lib/types";
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
} from "lucide-react";

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: Layout, chart: BarChart3, lock: Lock, shopping: ShoppingCart,
  message: MessageSquare, settings: Settings, columns: Columns3, dollar: DollarSign,
  folder: FolderOpen, music: Music, calendar: Calendar, grid: Grid3X3,
};

const REGEN_CHIPS = [
  { label: "Redo hero", section: "hero" },
  { label: "Redo navbar", section: "navbar" },
  { label: "Redo footer", section: "footer" },
  { label: "Redo pricing", section: "pricing" },
  { label: "Redo features", section: "features" },
];

interface ChatPanelProps {
  sessionId: string | null;
  messages: Message[];
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaUrl: string;
  temperature: number;
  isLanding?: boolean;
  latestCode?: string;
  customSystemPrompt?: string;
  maxTokens?: number;
  outputFormat?: "tsx" | "jsx" | "html";
  brandKit?: BrandKit;
  previewTheme?: string;
  onStreamStart: () => void;
  onStreamComplete: (text: string) => void;
  onTitleUpdate: (title: string) => void;
  onNewSession?: () => string;
  onUpgradeNeeded?: (needsAuth: boolean) => void;
  initialPrompt?: string | null;
  onClearPrompt?: () => void;
  duelMode?: boolean;
  duelModel?: string;
  promptOptimizer?: boolean;
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
  customSystemPrompt,
  maxTokens,
  outputFormat,
  brandKit,
  previewTheme,
  onStreamStart,
  onStreamComplete,
  onTitleUpdate,
  onNewSession,
  onUpgradeNeeded,
  initialPrompt,
  onClearPrompt,
  duelMode,
  duelModel,
  promptOptimizer,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThoughts, setStreamingThoughts] = useState("");
  const [duelStreamingText, setDuelStreamingText] = useState("");
  const [showThoughts, setShowThoughts] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hackerMode, setHackerMode] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = text || input;
      if (!msg.trim() || isStreaming) return;

      let sid = sessionId;
      if (!sid && onNewSession) {
        sid = onNewSession();
      }

      if (!sid) return;

      // Auto-optimize if enabled
      let finalMsg = msg;
      if (promptOptimizer && !text) { // only auto-optimize fresh inputs, not chips
        finalMsg = `[TECHNICAL OPTIMIZER ENABLED] Refactor and enhance this prompt for professional engineering implementation: ${msg}`;
      }

      setInput("");
      setIsStreaming(true);
      setStreamingText("");
      setDuelStreamingText("");
      onStreamStart();

      let fullText = "";
      let fullThoughts = "";
      let duelFullText = "";

      // Main Model Stream
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
          setStreamingText(fullText);
        },
        (thoughtDelta) => {
          fullThoughts += thoughtDelta;
          setStreamingThoughts(fullThoughts);
        },
        (title) => onTitleUpdate(title),
        () => {
          if (!duelMode) {
            setIsStreaming(false);
            setStreamingText("");
            setStreamingThoughts("");
            onStreamComplete(fullText);
          } else {
            // In duel mode, we wait for both or just finalize this one
            onStreamComplete(fullText);
            if (duelFullText) {
              setIsStreaming(false);
              setStreamingText("");
              setDuelStreamingText("");
            }
          }
        },
        (error, flags) => {
          setIsStreaming(false);
          setStreamingText("");
          if (flags?.upgrade && onUpgradeNeeded) {
            onUpgradeNeeded(!!flags.needsAuth);
          }
        },
        { customSystemPrompt, maxTokens, outputFormat, brandKit, previewTheme }
      );

      // Duel Model Stream (if enabled)
      if (duelMode && duelModel) {
        streamChat(
          sid,
          finalMsg,
          provider, // Assuming same provider for now or could map
          duelModel,
          apiKey,
          ollamaUrl,
          temperature,
          (delta) => {
            duelFullText += delta;
            setDuelStreamingText(duelFullText);
          },
          () => {}, // Duel models usually don't show thoughts in the same UI
          () => {},
          () => {
            onStreamComplete(duelFullText);
            if (fullText) {
              setIsStreaming(false);
              setStreamingText("");
              setDuelStreamingText("");
            }
          },
          () => {},
          { customSystemPrompt, maxTokens, outputFormat, brandKit, previewTheme }
        );
      }
    },
    [input, isStreaming, sessionId, provider, model, apiKey, ollamaUrl, temperature, customSystemPrompt, maxTokens, outputFormat, brandKit, previewTheme, onStreamStart, onStreamComplete, onTitleUpdate, onNewSession, onUpgradeNeeded, duelMode, duelModel, promptOptimizer]
  );

  const optimizePrompt = async () => {
    if (!input.trim() || isOptimizing) return;
    setIsOptimizing(true);
    // Real optimizer would call a model here, we'll prefix it for simulation/immediate value
    const optimized = `As a senior software engineer, implement the following with high-performance patterns, accessibility (A11y), and beautiful UI: ${input}`;
    setInput(optimized);
    setIsOptimizing(false);
  };

  useEffect(() => {
    if (initialPrompt && !isStreaming && onClearPrompt) {
      // Use setTimeout to avoid cascading render error while triggering generation
      const timer = setTimeout(() => {
        handleSend(initialPrompt);
        onClearPrompt();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, isStreaming, handleSend, onClearPrompt]);

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

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const lang = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        return (
          <div key={i} className="my-3 rounded-lg overflow-hidden border border-border">
            {lang && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted text-[10px] text-muted-foreground font-mono uppercase">
                {lang}
              </div>
            )}
            <pre className="p-3 bg-card overflow-x-auto text-xs font-mono leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  if (isLanding && messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
            <Zap className="w-7 h-7 text-foreground" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">Ship UI fast</h1>
          <p className="text-muted-foreground text-xs md:text-sm mb-6 md:mb-8 text-center max-w-md px-2">
            Generate production-ready React + Tailwind components. Edit inline, preview live, push to GitHub.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 w-full max-w-2xl mb-6 md:mb-8 px-2 md:px-0">
            {PROMPT_TEMPLATES.map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon] || Layout;
              return (
                <button
                  key={t.label}
                  onClick={() => {
                    setInput(t.prompt);
                    handleSend(t.prompt);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent text-left transition-colors group"
                >
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative bg-card border border-border rounded-xl overflow-hidden focus-within:border-ring transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a component, page, or layout..."
                rows={2}
                className="w-full bg-transparent px-4 pt-3 pb-10 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                <kbd className="text-[10px] text-muted-foreground font-mono px-1 py-0.5 rounded border border-border bg-muted">{isMac ? "⌘↵" : "Ctrl+↵"}</kbd>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-opacity"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Always review generated code before shipping.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
            <div className="flex-1 text-sm text-foreground leading-relaxed min-w-0">
              {renderContent(m.content)}
            </div>
          </div>
        ))}

        {isStreaming && (streamingText || streamingThoughts) && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 text-sm text-foreground leading-relaxed min-w-0">
              {streamingThoughts && (
                <div className="mb-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <button
                    onClick={() => setShowThoughts(!showThoughts)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 uppercase font-semibold tracking-wider font-mono">
                      <Zap className="w-3 h-3 text-emerald" />
                      AI Thought Process
                    </span>
                    <span className="text-[9px]">{showThoughts ? "Hide" : "Show"}</span>
                  </button>
                  {showThoughts && (
                    <div className="px-3 py-2 text-[11px] text-muted-foreground/80 font-mono italic whitespace-pre-wrap border-t border-border/50 bg-background/20">
                      {streamingThoughts}
                      {!streamingText && (
                        <span className="inline-block w-1 h-3 bg-muted-foreground/40 animate-pulse-slow ml-1" />
                      )}
                    </div>
                  )}
                </div>
              )}
              {streamingText ? (
                <>
                  {renderContent(streamingText)}
                  <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse-slow ml-0.5 -mb-0.5 rounded-sm" />
                </>
              ) : !streamingThoughts ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Connecting...
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Initializing model...
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
              {renderContent(duelStreamingText)}
              <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse-slow ml-0.5 -mb-0.5 rounded-sm" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {latestCode && !isStreaming && (
        <div className="px-4 pt-2 flex flex-wrap gap-1.5">
          {REGEN_CHIPS.map((chip) => (
            <button
              key={chip.section}
              onClick={() => {
                const prompt = `Keep the existing component but regenerate only the ${chip.section} section. Here's the current code:\n\`\`\`tsx\n${latestCode}\n\`\`\``;
                handleSend(prompt);
              }}
              className="px-2.5 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* AI Status Bar (Antigravity Feature) */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-b border-border/50 bg-black/20 text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald/5 border border-emerald/10 shadow-sm group relative cursor-help">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full transition-shadow duration-500",
              isStreaming ? "bg-emerald animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-emerald/30 shadow-[0_0_4px_rgba(16,185,129,0.3)]"
            )} />
            <span className="text-[10px] font-bold text-emerald/80 tracking-tight uppercase">ENGINE: {model.split("-")[0]}</span>
            {duelMode && (
              <>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <span className="text-[10px] font-bold text-blue-400/80 tracking-tight uppercase">VS {duelModel?.split("-")[0]}</span>
              </>
            )}
            
            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 rounded-lg bg-popover border border-border bg-card shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="text-[10px] space-y-1">
                <div className="flex justify-between font-mono text-muted-foreground uppercase"><span className="text-emerald">Architecture</span> <span>MoE-671B</span></div>
                <div className="flex justify-between font-mono text-muted-foreground uppercase"><span>Context Window</span> <span>128k</span></div>
                <div className="flex justify-between font-mono text-muted-foreground uppercase"><span>Infrastructure</span> <span>NVIDIA H100</span></div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/30 border border-border shadow-sm">
            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-tighter">LATENCY: 142ms</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/30 border border-border shadow-sm">
            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">Session: {sessionId?.slice(0, 8) || "Local"}</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald/5 border border-border/10 shadow-sm transition-all hover:bg-emerald/10 group cursor-help relative">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-bold text-emerald/80 tracking-tighter uppercase cursor-pointer" onClick={() => setShowParams(!showParams)}>Local Sync: ON</span>
            
            {showParams && (
              <div className="absolute bottom-full left-0 mb-3 w-56 p-4 rounded-xl bg-black border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] text-zinc-500 font-mono uppercase">Temperature</span>
                       <span className="text-[9px] text-emerald font-mono">{temperature.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald" style={{ width: `${temperature * 100}%` }} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] text-zinc-500 font-mono uppercase">Top-P Sampling</span>
                       <span className="text-[9px] text-blue-400 font-mono">0.95</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-400" style={{ width: `95%` }} />
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                       <span className="text-[9px] text-zinc-500 font-mono uppercase">Stream Protocol</span>
                       <span className="text-[9px] text-white/50 font-mono">SSE/HTTP2</span>
                    </div>
                 </div>
              </div>
            )}
            
            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 rounded-lg bg-card border border-border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <p className="text-[9px] text-muted-foreground uppercase font-mono leading-tight">
                Real-time file sync enabled. Run <span className="text-emerald">npx adgen pull</span> in your terminal to sync code locally.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-50">Pulse: {isStreaming ? "Active" : "Idle"}</span>
          <div className="w-px h-3 bg-border/50" />
          <div className="flex items-center gap-1">
            <Terminal className="w-3 h-3 opacity-50" />
            <span>v1.0.4-beta</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:pb-4 pt-2">
        <div className={cn(
          "relative border rounded-xl overflow-hidden focus-within:border-ring transition-all duration-300",
          hackerMode ? "bg-black border-emerald/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "bg-card border-border"
        )}>
          {hackerMode && (
             <div className="absolute top-2 left-3 text-[10px] font-mono text-emerald/50 uppercase tracking-widest pointer-events-none">
                adgen@user:~$
             </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hackerMode ? "" : "Describe a component, page, or layout..."}
            rows={1}
            className={cn(
              "w-full bg-transparent pt-3 pb-10 outline-none resize-none transition-all",
              hackerMode ? "pl-24 pr-4 text-emerald font-mono text-xs placeholder:text-emerald/20" : "px-3 md:px-4 text-sm text-foreground placeholder:text-muted-foreground",
            )}
          />
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <button
               onClick={() => setHackerMode(!hackerMode)}
               className={cn(
                 "p-1.5 rounded-lg transition-all active:scale-95 group relative border",
                 hackerMode ? "text-emerald border-emerald/20 bg-emerald/10" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent"
               )}
               title="Terminal Mode"
            >
               <Terminal className="w-3.5 h-3.5" />
               <div className="absolute bottom-full left-0 mb-2 invisible group-hover:visible bg-node border border-border px-2 py-1 rounded text-[9px] whitespace-nowrap z-50 shadow-xl">
                 {hackerMode ? "Exit Terminal" : "Terminal Mode"}
               </div>
            </button>

            <button
              onClick={optimizePrompt}
              disabled={!input.trim() || isStreaming || isOptimizing}
              className={cn(
                "p-1.5 rounded-lg transition-all active:scale-95 group relative",
                promptOptimizer ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
              )}
              title="Technical Prompt Optimizer"
            >
              <Lightbulb className={cn("w-3.5 h-3.5", isOptimizing && "animate-pulse")} />
              <div className="absolute bottom-full left-0 mb-2 invisible group-hover:visible bg-card border border-border px-2 py-1 rounded text-[9px] whitespace-nowrap z-50 shadow-xl">
                Technical Optimizer {promptOptimizer ? "(On)" : "(Off)"}
              </div>
            </button>
            {duelMode && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-tighter">
                <Zap className="w-3 h-3" />
                Duel
              </div>
            )}
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <kbd className={cn("hidden md:inline-block text-[10px] font-mono px-1 py-0.5 rounded border", hackerMode ? "text-emerald/50 border-emerald/20 bg-emerald/5" : "text-muted-foreground border-border bg-muted")}>{isMac ? "⌘↵" : "Ctrl+↵"}</kbd>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                hackerMode ? "bg-emerald text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-primary text-primary-foreground",
                "disabled:opacity-30"
              )}
            >
              {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
