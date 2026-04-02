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
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

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
        "flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-background text-xs font-bold font-mono">v0</span>
            </div>
            <span className="text-foreground font-semibold text-sm">v0</span>
          </div>
        )}
        {collapsed && (
          <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center mx-auto">
            <span className="text-background text-xs font-bold font-mono">v0</span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>

      {/* New Chat */}
      <div className={cn("p-2 border-b border-border", collapsed && "flex justify-center")}>
        <Button
          onClick={onNewChat}
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent text-sm h-8",
            collapsed && "w-8 h-8 p-0 justify-center"
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>New chat</span>}
        </Button>
      </div>

      {/* Thread list */}
      {!collapsed && (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {starredThreads.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground mb-1">
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
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground mb-1">
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
              <div className="text-center py-8 text-muted-foreground text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No chats yet</p>
                <p className="mt-1">Start a new chat to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {collapsed && <div className="flex-1" />}

      {/* Bottom nav */}
      <div className={cn("p-2 border-t border-border space-y-1", collapsed && "flex flex-col items-center")}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent text-sm h-8",
            collapsed && "w-8 h-8 p-0 justify-center"
          )}
        >
          <Layers className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Projects</span>}
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent text-sm h-8",
            collapsed && "w-8 h-8 p-0 justify-center"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Button>
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded w-8 h-8 flex items-center justify-center"
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
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
