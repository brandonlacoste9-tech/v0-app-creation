"use client"

import { useState, useRef } from "react"
import { Share2, MoreHorizontal, Sparkles, ChevronDown, Pencil, Check, X } from "lucide-react"

interface TopbarProps {
  projectTitle: string | null
  onRename: (title: string) => void
  hasContent: boolean
}

export function Topbar({ projectTitle, onRename, hasContent }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setEditValue(projectTitle ?? "")
    setEditing(true)
    setMenuOpen(false)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const commitEdit = () => {
    if (editValue.trim()) onRename(editValue.trim())
    setEditing(false)
  }

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[var(--border)] bg-[var(--background)] shrink-0 relative">
      {/* Left: title */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[var(--foreground)]" />
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit()
                if (e.key === "Escape") setEditing(false)
              }}
              className="bg-[var(--muted)] border border-[var(--ring)] rounded px-2 py-0.5 text-sm text-[var(--foreground)] outline-none w-48"
              autoFocus
            />
            <button onClick={commitEdit} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[var(--foreground)] font-medium text-sm">
              {projectTitle ?? "New chat"}
            </span>
            {projectTitle && (
              <button onClick={startEdit} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] opacity-0 hover:opacity-100 transition-opacity">
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {hasContent && (
          <button className="flex items-center gap-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs h-7 px-2 rounded-md hover:bg-[var(--accent)] transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--popover)] border border-[var(--border)] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                <button
                  onClick={startEdit}
                  className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                >
                  Rename
                </button>
                <button className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
                  Duplicate
                </button>
                <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[var(--accent)] transition-colors">
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
