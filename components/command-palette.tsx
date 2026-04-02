"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Search,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  Star,
  Code2,
  Monitor,
  Keyboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatThread } from "@/components/sidebar"
import { formatShortcut, isMac } from "@/hooks/use-keyboard-shortcuts"

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  threads: ChatThread[]
  onSelectThread: (id: string) => void
  onNewChat: () => void
  onOpenSettings: () => void
  onDeleteThread: (id: string) => void
  onTogglePreview: () => void
}

interface Command {
  id: string
  label: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
  category: "actions" | "threads"
}

export function CommandPalette({
  open,
  onClose,
  threads,
  onSelectThread,
  onNewChat,
  onOpenSettings,
  onDeleteThread,
  onTogglePreview,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const mac = isMac()
  const mod = mac ? "⌘" : "Ctrl+"

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      {
        id: "new-chat",
        label: "New chat",
        icon: <Plus className="w-4 h-4" />,
        shortcut: `${mod}N`,
        action: () => {
          onNewChat()
          onClose()
        },
        category: "actions",
      },
      {
        id: "settings",
        label: "Open settings",
        icon: <Settings className="w-4 h-4" />,
        shortcut: `${mod},`,
        action: () => {
          onOpenSettings()
          onClose()
        },
        category: "actions",
      },
      {
        id: "toggle-preview",
        label: "Toggle code/preview",
        icon: <Code2 className="w-4 h-4" />,
        shortcut: `${mod}/`,
        action: () => {
          onTogglePreview()
          onClose()
        },
        category: "actions",
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        icon: <Keyboard className="w-4 h-4" />,
        action: () => {
          // Could open a shortcuts modal
          onClose()
        },
        category: "actions",
      },
    ]

    const threadCommands: Command[] = threads.map((thread) => ({
      id: `thread-${thread.id}`,
      label: thread.title,
      icon: thread.starred ? (
        <Star className="w-4 h-4 text-amber-400" />
      ) : (
        <MessageSquare className="w-4 h-4" />
      ),
      action: () => {
        onSelectThread(thread.id)
        onClose()
      },
      category: "threads",
    }))

    return [...actions, ...threadCommands]
  }, [threads, onNewChat, onOpenSettings, onTogglePreview, onSelectThread, onClose, mod])

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) => cmd.label.toLowerCase().includes(q))
  }, [commands, query])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
          }
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, filteredCommands, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (selected) {
      selected.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  if (!open) return null

  const actionCommands = filteredCommands.filter((c) => c.category === "actions")
  const threadCommands = filteredCommands.filter((c) => c.category === "threads")

  let globalIndex = -1

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands and chats..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No results found
              </div>
            ) : (
              <>
                {actionCommands.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-[11px] text-muted-foreground font-medium">
                      Actions
                    </div>
                    {actionCommands.map((cmd) => {
                      globalIndex++
                      const idx = globalIndex
                      return (
                        <button
                          key={cmd.id}
                          data-index={idx}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            selectedIndex === idx
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {cmd.icon}
                            <span>{cmd.label}</span>
                          </div>
                          {cmd.shortcut && (
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {threadCommands.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[11px] text-muted-foreground font-medium">
                      Chats
                    </div>
                    {threadCommands.map((cmd) => {
                      globalIndex++
                      const idx = globalIndex
                      return (
                        <button
                          key={cmd.id}
                          data-index={idx}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            selectedIndex === idx
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {cmd.icon}
                          <span className="truncate">{cmd.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
