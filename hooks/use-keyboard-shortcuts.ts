"use client"

import { useEffect, useCallback } from "react"

export interface ShortcutHandler {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  handler: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      for (const shortcut of shortcuts) {
        const modifierMatch =
          (shortcut.ctrlKey === undefined || e.ctrlKey === shortcut.ctrlKey) &&
          (shortcut.metaKey === undefined || e.metaKey === shortcut.metaKey) &&
          (shortcut.shiftKey === undefined || e.shiftKey === shortcut.shiftKey)

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const requiresModifier = shortcut.ctrlKey || shortcut.metaKey || shortcut.shiftKey

        if (keyMatch && modifierMatch) {
          // Allow Escape to work even in inputs
          if (shortcut.key === "Escape" || !isInputFocused || requiresModifier) {
            e.preventDefault()
            shortcut.handler()
            return
          }
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

// Helper to detect Mac vs Windows
export function isMac(): boolean {
  if (typeof window === "undefined") return false
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0
}

// Format shortcut for display
export function formatShortcut(shortcut: ShortcutHandler): string {
  const parts: string[] = []
  const mac = isMac()

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(mac ? "⌘" : "Ctrl")
  }
  if (shortcut.shiftKey) {
    parts.push(mac ? "⇧" : "Shift")
  }

  const keyMap: Record<string, string> = {
    enter: "↵",
    escape: "Esc",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    " ": "Space",
  }

  const displayKey = keyMap[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase()
  parts.push(displayKey)

  return parts.join(mac ? "" : "+")
}
