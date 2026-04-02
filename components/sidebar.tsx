"use client"

import { cn } from "@/lib/utils"
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
      className={cn(
        "flex flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border)]">
        {collapsed ? (
          <div className="w-6 h-6 bg-[var(--foreground)] rounded-sm flex items-center justify-center mx-auto">
            <span className="text-[var(--background)] text-xs font-bold font-mono">v0</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[var(--foreground)] rounded-sm flex items-center justify-center">
                <span className="text-[var(--background)] text-xs font-bold font-mono">v0</span>
              </div>
              <span className="text-[var(--foreground)] font-semibold text-sm">v0</span>
            </div>
            <button
              onClick={onToggleCollapse}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1 rounded"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </>
        )}
      </div>

      {/* New Chat */}
      <div className={cn("p-2 border-b border-[var(--border)]", collapsed && "flex justify-center")}>
        <button
          onClick={onNewChat}
          className={cn(
            "flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] text-sm h-8 rounded-md px-2 transition-colors",
            collapsed ? "w-8 justify-center" : "w-full"
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Thread list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-4">
            {starredThreads.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--muted-foreground)] mb-1">
                  <Star className="w-3 h-3" />
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
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--muted-foreground)] mb-1">
                  <Clock className="w-3 h-3" />
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
              <div className="text-center py-8 text-[var(--muted-foreground)] text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No chats yet</p>
                <p className="mt-1">Start a new chat to begin</p>
              </div>
            )}
          </div>
        </div>
      )}

      {collapsed && <div className="flex-1" />}

      {/* Bottom nav */}
      <div className={cn("p-2 border-t border-[var(--border)] space-y-1", collapsed && "flex flex-col items-center")}>
        <button
          className={cn(
            "flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] text-sm h-8 rounded-md px-2 transition-colors",
            collapsed ? "w-8 justify-center" : "w-full"
          )}
        >
          <Layers className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Projects</span>}
        </button>
        <button
          className={cn(
            "flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] text-sm h-8 rounded-md px-2 transition-colors",
            collapsed ? "w-8 justify-center" : "w-full"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded w-8 h-8 flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
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
    <div className="space-y-0.5">
      {threads.map((thread) => (
        <div
          key={thread.id}
          className={cn(
            "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
            activeId === thread.id
              ? "bg-[var(--accent)] text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          )}
          onClick={() => onSelect(thread.id)}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 truncate text-xs leading-relaxed">{thread.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(thread.id)
            }}
            className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity p-0.5 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
