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
  Activity,
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
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThoughts, setStreamingThoughts] = useState("");
  const [showThoughts, setShowThoughts] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || isStreaming) return;

      let sid = sessionId;
      if (!sid && onNewSession) {
        sid = onNewSession();
      }
      if (!sid) return;

      setInput("");
      setIsStreaming(true);
      setStreamingText("");
      onStreamStart();

      let fullText = "";
      let fullThoughts = "";
      abortRef.current = streamChat(
        sid,
        msg,
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
          setIsStreaming(false);
          setStreamingText("");
          setStreamingThoughts("");
          onStreamComplete(fullText);
        },
        (error, flags) => {
          setIsStreaming(false);
          setStreamingText("");
          setStreamingThoughts("");
          if (flags?.upgrade && onUpgradeNeeded) {
            onUpgradeNeeded(!!flags.needsAuth);
          } else {
            console.error("Stream error:", error);
          }
        },
        { customSystemPrompt, maxTokens, outputFormat, brandKit, previewTheme }
      );
    },
    [input, isStreaming, sessionId, provider, model, apiKey, ollamaUrl, temperature, customSystemPrompt, maxTokens, outputFormat, brandKit, previewTheme, onStreamStart, onStreamComplete, onTitleUpdate, onNewSession, onUpgradeNeeded]
  );

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
            <span className="text-[10px] font-bold text-emerald/80 tracking-tight">ENGINE: DEEPSEEK-V3</span>
            
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
        <div className="relative bg-card border border-border rounded-xl overflow-hidden focus-within:border-ring transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a component, page, or layout..."
            rows={1}
            className="w-full bg-transparent px-3 md:px-4 pt-3 pb-10 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <kbd className="hidden md:inline-block text-[10px] text-muted-foreground font-mono px-1 py-0.5 rounded border border-border bg-muted">{isMac ? "⌘↵" : "Ctrl+↵"}</kbd>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-opacity"
            >
              {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
