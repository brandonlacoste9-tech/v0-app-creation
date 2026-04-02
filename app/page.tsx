"use client"

// v2 - wired to updated ChatPanel with local input state
import { useState, useCallback } from "react"
import { UIMessage } from "ai"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import { Sidebar, ChatThread } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { ChatPanel } from "@/components/chat-panel"
import { PreviewPanel } from "@/components/preview-panel"

interface CodeVersion {
  id: string
  code: string
  title: string
  timestamp: string
}

interface ChatSession {
  id: string
  title: string
  messages: UIMessage[]
  versions: CodeVersion[]
  activeVersionIndex: number
  starred?: boolean
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  const handleNewChat = useCallback(() => {
    const id = generateId()
    const newSession: ChatSession = {
      id,
      title: "New chat",
      messages: [],
      versions: [],
      activeVersionIndex: 0,
    }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(id)
    setIsGenerating(false)
  }, [])

  // Create a session on first message if none exists
  const ensureSession = useCallback((): string => {
    if (activeSessionId) return activeSessionId
    const id = generateId()
    const newSession: ChatSession = {
      id,
      title: "New chat",
      messages: [],
      versions: [],
      activeVersionIndex: 0,
    }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(id)
    return id
  }, [activeSessionId])

  const handleCodeGenerated = useCallback(
    (code: string, title: string) => {
      const sid = activeSessionId ?? ensureSession()
      setIsGenerating(false)
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s
          const newVersion: CodeVersion = {
            id: generateId(),
            code,
            title,
            timestamp: formatTime(),
          }
          const updatedVersions = [...s.versions, newVersion]
          // Update session title on first code gen
          const updatedTitle = s.title === "New chat" ? title : s.title
          return {
            ...s,
            title: updatedTitle,
            versions: updatedVersions,
            activeVersionIndex: updatedVersions.length - 1,
          }
        })
      )
    },
    [activeSessionId, ensureSession]
  )

  const handleMessagesUpdate = useCallback(
    (messages: UIMessage[]) => {
      const sid = activeSessionId ?? ensureSession()
      // Detect if streaming started
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === "assistant") {
        setIsGenerating(true)
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s
          // Derive title from first user message if still "New chat"
          const firstUserMsg = messages.find((m) => m.role === "user")
          const userText = firstUserMsg?.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") ?? ""
          const newTitle =
            s.title === "New chat" && userText
              ? userText.slice(0, 40) + (userText.length > 40 ? "..." : "")
              : s.title
          return { ...s, messages, title: newTitle }
        })
      )
    },
    [activeSessionId, ensureSession]
  )

  const handleVersionChange = useCallback(
    (index: number) => {
      if (!activeSessionId) return
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, activeVersionIndex: index } : s
        )
      )
    },
    [activeSessionId]
  )

  const handleDeleteThread = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        setActiveSessionId(null)
      }
    },
    [activeSessionId]
  )

  const handleRename = useCallback(
    (title: string) => {
      if (!activeSessionId) return
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, title } : s))
      )
    },
    [activeSessionId]
  )

  const threads: ChatThread[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    preview: "",
    timestamp: "",
    starred: s.starred,
  }))

  const showPreview = activeSession !== null

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        threads={threads}
        activeThreadId={activeSessionId}
        onSelectThread={(id) => {
          setActiveSessionId(id)
          setIsGenerating(false)
        }}
        onNewChat={handleNewChat}
        onDeleteThread={handleDeleteThread}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          projectTitle={activeSession?.title ?? null}
          onRename={handleRename}
          hasContent={(activeSession?.versions.length ?? 0) > 0}
        />

        {/* Split pane: chat + preview */}
        <div className="flex-1 overflow-hidden">
          {showPreview ? (
            <PanelGroup direction="horizontal" className="h-full">
              <Panel defaultSize={38} minSize={25} maxSize={60}>
                <ChatPanel
                  key={activeSessionId ?? "empty"}
                  onCodeGenerated={handleCodeGenerated}
                  initialMessages={activeSession?.messages ?? []}
                  onMessagesUpdate={handleMessagesUpdate}
                />
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-ring transition-colors cursor-col-resize" />
              <Panel defaultSize={62} minSize={30}>
                <PreviewPanel
                  versions={activeSession?.versions ?? []}
                  activeVersionIndex={activeSession?.activeVersionIndex ?? 0}
                  onVersionChange={handleVersionChange}
                  isGenerating={isGenerating}
                />
              </Panel>
            </PanelGroup>
          ) : (
            // No active session: full-width chat centered
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
                <ChatPanel
                  key="landing"
                  onCodeGenerated={(code, title) => {
                    ensureSession()
                    handleCodeGenerated(code, title)
                  }}
                  onMessagesUpdate={(msgs) => {
                    ensureSession()
                    handleMessagesUpdate(msgs)
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
