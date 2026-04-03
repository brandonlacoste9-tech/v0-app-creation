"use client"

import { useRef, useEffect, useState } from "react"
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

interface ChatPanelProps {
  onCodeGenerated: (code: string, title: string) => void
  initialMessages?: UIMessage[]
  onMessagesUpdate?: (messages: UIMessage[]) => void
  model?: string
  userId?: string
  onLimitReached?: () => void
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

export function ChatPanel({
  onCodeGenerated,
  initialMessages = [],
  onMessagesUpdate,
  model = "gpt-4o-mini",
  userId,
  onLimitReached,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastProcessedRef = useRef<string | null>(null)
  const [inputValue, setInputValue] = useState("")

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model, userId },
      async fetch(input, init) {
        const res = await window.fetch(input, init)
        if (res.status === 402) {
          onLimitReached?.()
          throw new Error("generation_limit_reached")
        }
        return res
      },
    }),
    initialMessages,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
      onCodeGenerated(code, extractTitle(text))
    }
  }, [messages, status, onCodeGenerated, onMessagesUpdate])

  function handleSend() {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) return
    sendMessage({ text: trimmed })
    setInputValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState
            onSuggestion={(s) => {
              setInputValue(s)
              textareaRef.current?.focus()
            }}
          />
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={
                  isStreaming &&
                  msg === messages[messages.length - 1] &&
                  msg.role === "assistant"
                }
              />
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-background" />
                </div>
                <div className="flex items-center gap-2 text-sm pt-1 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-border bg-background">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex flex-col rounded-xl bg-muted border border-border transition-colors focus-within:border-ring">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to build?"
              disabled={isStreaming}
              className="w-full bg-transparent text-sm leading-relaxed px-4 pt-3 pb-2 resize-none outline-none text-foreground placeholder:text-muted-foreground min-h-[44px] max-h-40"
            />
            <div className="flex items-center justify-between px-3 pb-2 pt-1">
              <button
                disabled={isStreaming}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {isStreaming ? "Generating..." : "Enter to send"}
                </span>
                {isStreaming ? (
                  <button
                    onClick={stop}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-2 text-muted-foreground">
            adgenai may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-foreground">
        <Sparkles className="w-6 h-6 text-background" />
      </div>
      <h2 className="text-2xl font-semibold mb-2 text-balance text-foreground">
        What can I help you build?
      </h2>
      <p className="text-sm mb-8 max-w-sm text-pretty leading-relaxed text-muted-foreground">
        Describe a UI component, page, or full app and I&apos;ll generate the code instantly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="flex items-start gap-2.5 text-left px-3.5 py-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
          >
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
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
        <div className="max-w-lg rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed bg-secondary text-foreground">
          {text}
        </div>
        <div className="w-7 h-7 rounded-full border border-border bg-secondary flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-foreground" />
        </div>
      </div>
    )
  }

  const parts = text.split(/(```(?:tsx?|jsx?)\n[\s\S]*?```)/g)

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-foreground">
        <Sparkles className="w-3.5 h-3.5 text-background" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {parts.map((part, i) => {
          if (part.startsWith("```")) {
            const codeMatch = part.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/)
            const code = codeMatch ? codeMatch[1] : part
            return (
              <div key={i} className="rounded-xl overflow-hidden border border-border bg-card">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((n) => (
                      <div key={n} className="w-2.5 h-2.5 rounded-full bg-border" />
                    ))}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">component.tsx</span>
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
            <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {trimmed}
            </div>
          )
        })}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 animate-pulse rounded-sm bg-foreground" />
        )}
      </div>
    </div>
  )
}
