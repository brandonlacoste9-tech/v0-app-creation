"use client"

import { useCallback, useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { UIMessage } from "ai"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import Link from "next/link"
import { ArrowLeft, FileCode, FolderOpen, Settings, ChevronRight } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { PreviewPanel } from "@/components/preview-panel-v2"
import { useAuth } from "@/lib/auth-context"
import { CodeVersion } from "@/lib/storage"

interface ProjectData {
  id: string
  name: string
  messages: Array<{ id: string; role: string; content: string; created_at: string }>
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function ProjectWorkspace() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { user } = useAuth()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [messages, setMessages] = useState<UIMessage[]>([])
  const [versions, setVersions] = useState<CodeVersion[]>([])
  const [activeVersionIndex, setActiveVersionIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProject(data)
          // Convert DB messages to UIMessage format
          if (data.messages?.length > 0) {
            const uiMessages: UIMessage[] = data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text", text: m.content }],
            }))
            setMessages(uiMessages)
          }
        } else if (res.status === 404) {
          setError("Project not found")
        } else {
          setError("Failed to load project")
        }
      } catch {
        setError("Failed to load project")
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [projectId])

  const handleCodeGenerated = useCallback(
    (code: string, title: string) => {
      setIsGenerating(false)
      const newVersion: CodeVersion = {
        id: generateId(),
        code,
        title,
        timestamp: formatTime(),
      }
      setVersions((prev) => [...prev, newVersion])
      setActiveVersionIndex((prev) => prev + 1)
    },
    []
  )

  const handleMessagesUpdate = useCallback((newMessages: UIMessage[]) => {
    setMessages(newMessages)
    const lastMsg = newMessages[newMessages.length - 1]
    if (lastMsg?.role === "assistant") {
      setIsGenerating(true)
    }
  }, [])

  const handleVersionChange = useCallback((index: number) => {
    setActiveVersionIndex(index)
  }, [])

  if (loading) {
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

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link href="/dashboard" className="text-sm text-foreground underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* File tree sidebar */}
      <div
        className={`flex flex-col border-r border-border bg-card transition-all ${
          sidebarCollapsed ? "w-12" : "w-56"
        }`}
      >
        {/* Sidebar header */}
        <div className="h-12 border-b border-border flex items-center px-3 gap-2">
          <Link
            href="/dashboard"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          {!sidebarCollapsed && (
            <span className="text-sm font-medium text-foreground truncate flex-1">
              {project?.name ?? "Project"}
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
          </button>
        </div>

        {/* File tree */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Files
            </div>
            {versions.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2">No files yet. Start chatting to generate code.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVersionIndex(i)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                      i === activeVersionIndex
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{v.title || `v${i + 1}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom actions */}
        <div className="border-t border-border p-2">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Settings className="w-3.5 h-3.5" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-12 border-b border-border flex items-center px-4 gap-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{project?.name ?? "Untitled"}</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {user?.email && <span>{user.email}</span>}
          </div>
        </div>

        {/* Panels */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={40} minSize={25} maxSize={60}>
              <ChatPanel
                onCodeGenerated={handleCodeGenerated}
                initialMessages={messages}
                onMessagesUpdate={handleMessagesUpdate}
                model="gpt-4o-mini"
              />
            </Panel>
            <PanelResizeHandle className="w-px bg-border hover:bg-ring transition-colors cursor-col-resize" />
            <Panel>
              <PreviewPanel
                versions={versions}
                activeVersionIndex={activeVersionIndex}
                onVersionChange={handleVersionChange}
                isGenerating={isGenerating}
              />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  )
}
