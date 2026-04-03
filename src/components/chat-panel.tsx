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
  onStreamStart: () => void;
  onStreamComplete: (text: string) => void;
  onTitleUpdate: (title: string) => void;
  onNewSession?: () => string;
  onSendPrompt?: (prompt: string) => void;
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
  onStreamStart,
  onStreamComplete,
  onTitleUpdate,
  onNewSession,
  onSendPrompt,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
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
        (title) => onTitleUpdate(title),
        () => {
          setIsStreaming(false);
          setStreamingText("");
          onStreamComplete(fullText);
        },
        (error) => {
          setIsStreaming(false);
          setStreamingText("");
          console.error("Stream error:", error);
        },
        { customSystemPrompt, maxTokens, outputFormat, brandKit }
      );
    },
    [input, isStreaming, sessionId, provider, model, apiKey, ollamaUrl, temperature, customSystemPrompt, maxTokens, outputFormat, brandKit, onStreamStart, onStreamComplete, onTitleUpdate, onNewSession]
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

  // Render markdown-ish content (code blocks)
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

  // Landing page with templates
  if (isLanding && messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
            <Zap className="w-7 h-7 text-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Ship UI fast</h1>
          <p className="text-muted-foreground text-sm mb-8 text-center max-w-md">
            Generate production-ready React + Tailwind components. Edit inline, preview live, push to GitHub.
          </p>

          {/* Template grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 w-full max-w-2xl mb-8">
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

        {/* Input */}
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
                <span className="text-[10px] text-muted-foreground">{isMac ? "⌘↵" : "Ctrl+↵"}</span>
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
      {/* Messages */}
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

        {/* Streaming message */}
        {isStreaming && streamingText && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 text-sm text-foreground leading-relaxed min-w-0">
              {renderContent(streamingText)}
              <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse-slow ml-0.5 -mb-0.5 rounded-sm" />
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Regen chips */}
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

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="relative bg-card border border-border rounded-xl overflow-hidden focus-within:border-ring transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={1}
            className="w-full bg-transparent px-4 pt-3 pb-10 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{isMac ? "⌘↵" : "Ctrl+↵"}</span>
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
