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
  onOpenSettings?: () => void
}

export function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
}: SidebarProps) {
  const starredThreads = threads.filter((t) => t.starred)
  const recentThreads = threads.filter((t) => !t.starred)

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-[width] duration-200 overflow-hidden shrink-0",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {/* Logo + Toggle */}
      <div
        className={cn(
          "flex items-center border-b border-border px-3 py-2.5",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-foreground rounded flex items-center justify-center shrink-0">
            <span className="text-background text-[9px] font-bold font-mono tracking-tight">AG</span>
          </div>
          {!collapsed && (
            <span className="text-foreground font-semibold text-sm">adgenai</span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>

      {/* New Chat button */}
      <div
        className={cn(
          "p-2 border-b border-border",
          collapsed ? "flex justify-center" : ""
        )}
      >
        <button
          onClick={onNewChat}
          className={cn(
            "flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 transition-colors text-sm",
            collapsed ? "w-8 justify-center" : "w-full px-2"
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Thread list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2">
          {starredThreads.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground text-[11px] mb-1">
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
              <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground text-[11px] mb-1">
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
            <div className="text-center py-8 px-2 text-muted-foreground text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No chats yet</p>
              <p className="mt-1">Start a new chat to begin</p>
            </div>
          )}
        </div>
      )}

      {collapsed && <div className="flex-1" />}

      {/* Bottom nav */}
      <div
        className={cn(
          "p-2 border-t border-border flex flex-col gap-1",
          collapsed ? "items-center" : ""
        )}
      >
        <button
          className={cn(
            "flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 transition-colors text-sm",
            collapsed ? "w-8 justify-center" : "w-full px-2"
          )}
        >
          <Layers className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Projects</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={cn(
            "flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 transition-colors text-sm",
            collapsed ? "w-8 justify-center" : "w-full px-2"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
    <div className="flex flex-col gap-0.5">
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
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-xs truncate leading-normal">{thread.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(thread.id)
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}
