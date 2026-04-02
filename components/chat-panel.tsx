"use client"

import { useRef, useEffect } from "react"
import { UIMessage, DefaultChatTransport } from "ai"
import { useChat } from "@ai-sdk/react"
import { cn } from "@/lib/utils"
import {
  ArrowUp,
  Square,
  Sparkles,
  User,
  Loader2,
  Paperclip,
  Lightbulb,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ChatPanelProps {
  onCodeGenerated: (code: string, title: string) => void
  initialMessages?: UIMessage[]
  onMessagesUpdate?: (messages: UIMessage[]) => void
}

const SUGGESTIONS = [
  "Build a pricing page with 3 tiers",
  "Create a dashboard with stats cards",
  "Make a sign-in form with validation",
  "Design a product landing page",
]

function getUIMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

function extractTitle(text: string): string {
  const firstLine = text.split("\n")[0] ?? ""
  const cleaned = firstLine.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim()
  return cleaned.length > 0 && cleaned.length < 80 ? cleaned : "Generated Component"
}

export function ChatPanel({ onCodeGenerated, initialMessages = [], onMessagesUpdate }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastProcessedRef = useRef<string | null>(null)

  const { messages, sendMessage, status, stop, input, setInput } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    initialMessages,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Notify parent of messages update and extract code
  useEffect(() => {
    if (onMessagesUpdate) onMessagesUpdate(messages)

    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== "assistant") return
    if (lastMsg.id === lastProcessedRef.current) return
    if (status === "streaming") return

    const text = getUIMessageText(lastMsg)
    const code = extractCodeBlock(text)
    if (code) {
      lastProcessedRef.current = lastMsg.id
      const title = extractTitle(text)
      onCodeGenerated(code, title)
    }
  }, [messages, status, onCodeGenerated, onMessagesUpdate])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    sendMessage({ text: trimmed })
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={(s) => { setInput(s); inputRef.current?.focus() }} />
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === "assistant"} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-background" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex flex-col bg-muted rounded-xl border border-border focus-within:border-ring transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to build?"
              className="w-full bg-transparent text-foreground placeholder-muted-foreground text-sm leading-relaxed px-4 pt-3 pb-2 resize-none outline-none min-h-[44px] max-h-40 font-sans"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-3 pb-2 pt-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-muted-foreground hover:text-foreground"
                  disabled={isStreaming}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {isStreaming ? "Generating..." : "⏎ to send"}
                </span>
                {isStreaming ? (
                  <Button
                    onClick={stop}
                    size="icon"
                    className="w-7 h-7 bg-foreground hover:bg-foreground/80 text-background rounded-lg"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    size="icon"
                    className="w-7 h-7 bg-foreground hover:bg-foreground/80 text-background rounded-lg disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            v0 may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-6 py-12 text-center">
      <div className="w-12 h-12 bg-foreground rounded-2xl flex items-center justify-center mb-5">
        <Sparkles className="w-6 h-6 text-background" />
      </div>
      <h2 className="text-foreground text-2xl font-semibold mb-2 text-balance">
        What can I help you build?
      </h2>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm text-pretty leading-relaxed">
        Describe a UI component, page, or full app and I&apos;ll generate the code instantly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="flex items-start gap-2.5 text-left px-3.5 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-ring transition-colors text-sm text-muted-foreground hover:text-foreground group"
          >
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 group-hover:text-foreground" />
            <span className="leading-snug">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: UIMessage
  isStreaming: boolean
}) {
  const text = getUIMessageText(message)
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-lg bg-secondary rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-foreground leading-relaxed">
          {text}
        </div>
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-foreground" />
        </div>
      </div>
    )
  }

  // Assistant message — render with code block detection
  const parts = text.split(/(```(?:tsx?|jsx?)\n[\s\S]*?```)/g)

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-background" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {parts.map((part, i) => {
          if (part.startsWith("```")) {
            const codeMatch = part.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/)
            const code = codeMatch ? codeMatch[1] : part
            return (
              <div
                key={i}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-border" />
                      <div className="w-2.5 h-2.5 rounded-full bg-border" />
                      <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">component.tsx</span>
                  </div>
                </div>
                <pre className="overflow-x-auto p-4 text-xs leading-relaxed font-mono">
                  <code className="text-foreground">{code}</code>
                </pre>
              </div>
            )
          }
          const trimmed = part.trim()
          if (!trimmed) return null
          return (
            <div key={i} className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {trimmed}
            </div>
          )
        })}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}
