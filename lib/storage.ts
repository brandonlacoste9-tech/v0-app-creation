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
  model: "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet" | "grok-2" | "grok-3-mini" | "groq-llama-3.3-70b" | "groq-llama-3.1-8b" | "groq-mixtral-8x7b"
  temperature: number
  sidebarCollapsed: boolean
  // SaaS fields
  userId?: string
  planId?: "free" | "pro" | "unlimited"
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  generationsUsed?: number
  generationsResetAt?: string
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
  planId: "free",
  generationsUsed: 0,
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

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "server"
  const key = "adgenai-user-id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
