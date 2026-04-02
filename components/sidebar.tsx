"use client"

import {
  Plus,
  MessageSquare,
  Settings,
  ChevronRight,
  Layers,
  Clock,
  Star,
  Trash2,
} from "lucide-react"

export interface ChatThread {
  id: string
  title: string
  preview: string
  timestamp: string
  starred?: boolean
}

interface SidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  onNewChat: () => void
  onDeleteThread: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const starredThreads = threads.filter((t) => t.starred)
  const recentThreads = threads.filter((t) => !t.starred)

  return (
    <aside
      style={{
        width: collapsed ? "56px" : "256px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border)",
        background: "var(--sidebar)",
        transition: "width 200ms",
        overflow: "hidden",
      }}
    >
      {/* Logo + Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              background: "var(--foreground)",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "var(--background)",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              v0
            </span>
          </div>
          {!collapsed && (
            <span
              style={{
                color: "var(--foreground)",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              v0
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              color: "var(--muted-foreground)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronRight style={{ width: "16px", height: "16px", transform: "rotate(180deg)" }} />
          </button>
        )}
      </div>

      {/* New Chat button */}
      <div
        style={{
          padding: "8px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: collapsed ? "center" : "stretch",
        }}
      >
        <button
          onClick={onNewChat}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--muted-foreground)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            height: "32px",
            borderRadius: "6px",
            padding: collapsed ? "0 6px" : "0 8px",
            width: collapsed ? "32px" : "100%",
            justifyContent: collapsed ? "center" : "flex-start",
            transition: "background 150ms, color 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent)"
            e.currentTarget.style.color = "var(--foreground)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none"
            e.currentTarget.style.color = "var(--muted-foreground)"
          }}
        >
          <Plus style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Thread list */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {starredThreads.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  color: "var(--muted-foreground)",
                  fontSize: "11px",
                  marginBottom: "4px",
                }}
              >
                <Star style={{ width: "12px", height: "12px" }} />
                <span>Starred</span>
              </div>
              <ThreadList
                threads={starredThreads}
                activeId={activeThreadId}
                onSelect={onSelectThread}
                onDelete={onDeleteThread}
              />
            </div>
          )}

          {recentThreads.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  color: "var(--muted-foreground)",
                  fontSize: "11px",
                  marginBottom: "4px",
                }}
              >
                <Clock style={{ width: "12px", height: "12px" }} />
                <span>Recent</span>
              </div>
              <ThreadList
                threads={recentThreads}
                activeId={activeThreadId}
                onSelect={onSelectThread}
                onDelete={onDeleteThread}
              />
            </div>
          )}

          {threads.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 8px",
                color: "var(--muted-foreground)",
                fontSize: "12px",
              }}
            >
              <MessageSquare
                style={{ width: "32px", height: "32px", margin: "0 auto 8px", opacity: 0.4 }}
              />
              <p>No chats yet</p>
              <p style={{ marginTop: "4px" }}>Start a new chat to begin</p>
            </div>
          )}
        </div>
      )}

      {collapsed && <div style={{ flex: 1 }} />}

      {/* Bottom nav */}
      <div
        style={{
          padding: "8px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: collapsed ? "center" : "stretch",
          gap: "4px",
        }}
      >
        {[
          { Icon: Layers, label: "Projects" },
          { Icon: Settings, label: "Settings" },
        ].map(({ Icon, label }) => (
          <button
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--muted-foreground)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              height: "32px",
              borderRadius: "6px",
              padding: collapsed ? "0 6px" : "0 8px",
              width: collapsed ? "32px" : "100%",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)"
              e.currentTarget.style.color = "var(--foreground)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none"
              e.currentTarget.style.color = "var(--muted-foreground)"
            }}
          >
            <Icon style={{ width: "16px", height: "16px", flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              color: "var(--muted-foreground)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight style={{ width: "16px", height: "16px" }} />
          </button>
        )}
      </div>
    </aside>
  )
}

function ThreadList({
  threads,
  activeId,
  onSelect,
  onDelete,
}: {
  threads: ChatThread[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {threads.map((thread) => (
        <ThreadItem
          key={thread.id}
          thread={thread}
          isActive={activeId === thread.id}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function ThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
}: {
  thread: ChatThread
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      onClick={() => onSelect(thread.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        borderRadius: "6px",
        cursor: "pointer",
        background: isActive ? "var(--accent)" : "transparent",
        color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
        transition: "background 150ms, color 150ms",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "var(--accent)"
          e.currentTarget.style.color = "var(--foreground)"
        }
        const btn = e.currentTarget.querySelector<HTMLButtonElement>(".delete-btn")
        if (btn) btn.style.opacity = "1"
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "var(--muted-foreground)"
        }
        const btn = e.currentTarget.querySelector<HTMLButtonElement>(".delete-btn")
        if (btn) btn.style.opacity = "0"
      }}
    >
      <MessageSquare style={{ width: "14px", height: "14px", flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: "12px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.4,
        }}
      >
        {thread.title}
      </span>
      <button
        className="delete-btn"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(thread.id)
        }}
        style={{
          opacity: 0,
          color: "var(--muted-foreground)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          transition: "opacity 150ms",
          flexShrink: 0,
        }}
      >
        <Trash2 style={{ width: "12px", height: "12px" }} />
      </button>
    </div>
  )
}
