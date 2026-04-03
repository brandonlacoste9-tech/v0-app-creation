"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Clock, Star, MoreHorizontal, Trash2, LogOut, Settings, Search, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { ChatSession } from "@/lib/storage"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { sessions, setSessions, setActiveSessionId } = useLocalStorage()
  const [search, setSearch] = useState("")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const filtered = sessions
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const starred = filtered.filter((s) => s.starred)
  const recent = filtered.filter((s) => !s.starred)

  function handleOpen(id: string) {
    setActiveSessionId(id)
    router.push("/")
  }

  async function handleNew() {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Project" }),
      })
      if (res.ok) {
        const { id } = await res.json()
        router.push(`/project/${id}`)
      } else {
        // Fallback to local session
        setActiveSessionId(null)
        router.push("/")
      }
    } catch {
      setActiveSessionId(null)
      router.push("/")
    }
  }

  function handleDelete(id: string) {
    setSessions((prev: ChatSession[]) => prev.filter((s) => s.id !== id))
    setOpenMenuId(null)
  }

  function handleToggleStar(id: string) {
    setSessions((prev: ChatSession[]) =>
      prev.map((s) => (s.id === id ? { ...s, starred: !s.starred } : s))
    )
    setOpenMenuId(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Topbar */}
      <header className="border-b border-border h-14 flex items-center px-6 gap-4">
        <Link href="/" className="font-semibold text-base tracking-tight text-foreground shrink-0">
          adgenai
        </Link>
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 h-8 px-3 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New project
          </button>
          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setOpenMenuId(openMenuId === "user" ? null : "user")}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </button>
            {openMenuId === "user" && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-medium text-foreground truncate">{user?.name ?? user?.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setOpenMenuId(null); router.push("/") }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <button
                    onClick={() => { setOpenMenuId(null); logout() }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-accent transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-foreground">
            {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Your projects"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sessions.length === 0
              ? "Start your first project below."
              : `${sessions.length} project${sessions.length !== 1 ? "s" : ""} — pick up where you left off.`}
          </p>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Describe what you want to build and let AI do the rest.</p>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 h-9 px-4 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
          </div>
        )}

        {/* Starred */}
        {starred.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Starred</h2>
            </div>
            <ProjectGrid
              projects={starred}
              onOpen={handleOpen}
              onDelete={handleDelete}
              onToggleStar={handleToggleStar}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          </section>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</h2>
            </div>
            <ProjectGrid
              projects={recent}
              onOpen={handleOpen}
              onDelete={handleDelete}
              onToggleStar={handleToggleStar}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          </section>
        )}

        {filtered.length === 0 && sessions.length > 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No projects match &ldquo;{search}&rdquo;
          </div>
        )}
      </main>
    </div>
  )
}

interface ProjectGridProps {
  projects: ChatSession[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
}

function ProjectGrid({ projects, onOpen, onDelete, onToggleStar, openMenuId, setOpenMenuId }: ProjectGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group relative p-4 rounded-xl border border-border bg-card hover:border-ring/60 transition-colors cursor-pointer"
          onClick={() => onOpen(project.id)}
        >
          {/* Preview thumbnail placeholder */}
          <div className="w-full aspect-video rounded-md bg-secondary mb-3 flex items-center justify-center overflow-hidden">
            {project.versions.length > 0 ? (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-mono">v{project.versions.length}</span>
              </div>
            ) : (
              <Zap className="w-4 h-4 text-muted-foreground/40" />
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{project.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {project.versions.length} version{project.versions.length !== 1 ? "s" : ""} · {timeAgo(project.updatedAt)}
              </p>
            </div>
            {/* Actions */}
            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {openMenuId === project.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => { onOpen(project.id); setOpenMenuId(null) }}
                      className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => onToggleStar(project.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
                    >
                      <Star className="w-3 h-3" />
                      {project.starred ? "Unstar" : "Star"}
                    </button>
                    <button
                      onClick={() => onDelete(project.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-accent transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
