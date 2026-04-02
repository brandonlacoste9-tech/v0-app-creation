import { UIMessage } from "ai"

export interface CodeVersion {
  id: string
  code: string
  title: string
  timestamp: string
}

export interface ChatSession {
  id: string
  title: string
  messages: UIMessage[]
  versions: CodeVersion[]
  activeVersionIndex: number
  starred?: boolean
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  model: "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet"
  temperature: number
  sidebarCollapsed: boolean
}

export interface StorageSchema {
  sessions: ChatSession[]
  activeSessionId: string | null
  settings: UserSettings
}

const STORAGE_KEY = "v0-clone-data"

export const DEFAULT_SETTINGS: UserSettings = {
  model: "gpt-4o-mini",
  temperature: 0.7,
  sidebarCollapsed: false,
}

export function loadFromStorage(): StorageSchema | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StorageSchema
  } catch {
    return null
  }
}

export function saveToStorage(data: StorageSchema): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable
  }
}

export function clearStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
