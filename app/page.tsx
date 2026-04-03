"use client"

import { useCallback, useState, useEffect } from "react"
import { UIMessage } from "ai"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import { Sidebar, ChatThread } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { ChatPanel } from "@/components/chat-panel"
import { PreviewPanel } from "@/components/preview-panel-v2"
import { SettingsDialog } from "@/components/settings-dialog"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { ChatSession, CodeVersion, UserSettings } from "@/lib/storage"

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export default function Home() {
  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    settings,
    setSettings,
    hydrated,
  } = useLocalStorage()

  const [isGenerating, setIsGenerating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  const handleNewChat = useCallback(() => {
    const id = generateId()
    const now = new Date().toISOString()
    const newSession: ChatSession = {
      id,
      title: "New chat",
      messages: [],
      versions: [],
      activeVersionIndex: 0,
      createdAt: now,
      updatedAt: now,
    }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(id)
    setIsGenerating(false)
  }, [setSessions, setActiveSessionId])

  const ensureSession = useCallback((): string => {
    if (activeSessionId) return activeSessionId
    const id = generateId()
    const now = new Date().toISOString()
    const newSession: ChatSession = {
      id,
      title: "New chat",
      messages: [],
      versions: [],
      activeVersionIndex: 0,
      createdAt: now,
      updatedAt: now,
    }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(id)
    return id
  }, [activeSessionId, setSessions, setActiveSessionId])

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
          const updatedTitle = s.title === "New chat" ? title : s.title
          // Persist version to Neon
          fetch("/api/versions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sid,
              version: {
                id: newVersion.id,
                title: newVersion.title,
                code: newVersion.code,
                timestamp: newVersion.timestamp,
                version_index: updatedVersions.length - 1,
              },
            }),
          }).catch(() => {})
          return {
            ...s,
            title: updatedTitle,
            versions: updatedVersions,
            activeVersionIndex: updatedVersions.length - 1,
            updatedAt: new Date().toISOString(),
          }
        })
      )
    },
    [activeSessionId, ensureSession, setSessions]
  )

  const handleMessagesUpdate = useCallback(
    (messages: UIMessage[]) => {
      const sid = activeSessionId ?? ensureSession()
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === "assistant") {
        setIsGenerating(true)
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s
          const firstUserMsg = messages.find((m) => m.role === "user")
          const userText =
            firstUserMsg?.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("") ?? ""
          const newTitle =
            s.title === "New chat" && userText
              ? userText.slice(0, 40) + (userText.length > 40 ? "..." : "")
              : s.title
          return { ...s, messages, title: newTitle, updatedAt: new Date().toISOString() }
        })
      )
    },
    [activeSessionId, ensureSession, setSessions]
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
    [activeSessionId, setSessions]
  )

  const handleDeleteThread = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        setActiveSessionId(null)
      }
    },
    [activeSessionId, setSessions, setActiveSessionId]
  )

  const handleRename = useCallback(
    (title: string) => {
      if (!activeSessionId) return
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, title } : s))
      )
    },
    [activeSessionId, setSessions]
  )

  const handleSettingsChange = useCallback(
    (newSettings: UserSettings) => {
      setSettings(newSettings)
    },
    [setSettings]
  )

  const threads: ChatThread[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    preview: "",
    timestamp: "",
    starred: s.starred,
  }))

  const showPreview = activeSession !== null

  // Sync session to Neon whenever it changes
  useEffect(() => {
    if (!hydrated || !activeSession) return
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeSession.id, title: activeSession.title }),
    }).catch(() => {})
  }, [activeSession?.id, hydrated])

  useEffect(() => {
    if (!hydrated || !activeSession) return
    fetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: activeSession.id,
        title: activeSession.title,
        starred: activeSession.starred ?? false,
      }),
    }).catch(() => {})
  }, [activeSession?.title, activeSession?.starred, hydrated])

  // Keyboard shortcuts
  useKeyboardShortcuts(
    [
      {
        key: "k",
        meta: true,
        handler: handleNewChat,
        description: "New chat",
      },
      {
        key: "b",
        meta: true,
        handler: () => setSettings({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed }),
        description: "Toggle sidebar",
      },
      {
        key: ",",
        meta: true,
        handler: () => setSettingsOpen(true),
        description: "Open settings",
      },
    ],
    hydrated
  )

  // Show loading state while hydrating from localStorage
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-foreground animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar
        threads={threads}
        activeThreadId={activeSessionId}
        onSelectThread={(id) => {
          setActiveSessionId(id)
          setIsGenerating(false)
        }}
        onNewChat={handleNewChat}
        onDeleteThread={handleDeleteThread}
        collapsed={settings.sidebarCollapsed}
        onToggleCollapse={() =>
          setSettings({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed })
        }
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          projectTitle={activeSession?.title ?? null}
          onRename={handleRename}
          hasContent={(activeSession?.versions.length ?? 0) > 0}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex-1 overflow-hidden">
          {showPreview ? (
            <PanelGroup direction="horizontal" className="h-full">
              <Panel defaultSize={38} minSize={25} maxSize={60}>
                <ChatPanel
                  key={activeSessionId ?? "empty"}
                  onCodeGenerated={handleCodeGenerated}
                  initialMessages={activeSession?.messages ?? []}
                  onMessagesUpdate={handleMessagesUpdate}
                  model={settings.model}
                />
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-ring transition-colors cursor-col-resize" />
              <Panel>
                <PreviewPanel
                  versions={activeSession?.versions ?? []}
                  activeVersionIndex={activeSession?.activeVersionIndex ?? 0}
                  onVersionChange={handleVersionChange}
                  isGenerating={isGenerating}
                />
              </Panel>
            </PanelGroup>
          ) : (
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
                  model={settings.model}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  )
}
