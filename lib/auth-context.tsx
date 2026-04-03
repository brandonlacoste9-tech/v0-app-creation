"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  provider: string
  planId: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  register: (email: string, password: string, name?: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const defaultCtx: AuthContextValue = {
  user: null,
  loading: true,
  login: async () => ({ error: "Not ready" }),
  register: async () => ({ error: "Not ready" }),
  logout: async () => {},
  refresh: async () => {},
}

const Ctx = createContext<AuthContextValue>(defaultCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session")
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? "Login failed" }
    setUser(data.user)
    return {}
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? "Registration failed" }
    setUser(data.user)
    return {}
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    window.location.href = "/login"
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(Ctx)
}
