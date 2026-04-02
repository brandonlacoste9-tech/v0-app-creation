"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  StorageSchema,
  loadFromStorage,
  saveToStorage,
  DEFAULT_SETTINGS,
  ChatSession,
  UserSettings,
} from "@/lib/storage"

const DEBOUNCE_MS = 500

export function useLocalStorage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [hydrated, setHydrated] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load on mount
  useEffect(() => {
    const data = loadFromStorage()
    if (data) {
      setSessions(data.sessions)
      setActiveSessionId(data.activeSessionId)
      setSettings(data.settings)
    }
    setHydrated(true)
  }, [])

  // Debounced save
  const scheduleSave = useCallback((data: StorageSchema) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(data)
    }, DEBOUNCE_MS)
  }, [])

  // Save on changes
  useEffect(() => {
    if (!hydrated) return
    scheduleSave({ sessions, activeSessionId, settings })
  }, [sessions, activeSessionId, settings, hydrated, scheduleSave])

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    settings,
    setSettings,
    hydrated,
  }
}
