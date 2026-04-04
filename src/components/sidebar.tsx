"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Session, UserInfo } from "@/lib/types";
import {
  Plus,
  MessageSquare,
  Star,
  Trash2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Search,
  Clock,
  X,
  Crown,
  Sparkles,
  LogIn,
  LayoutTemplate,
  Rocket,
  Globe,
  Share2,
  Columns3,
} from "lucide-react";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  collapsed: boolean;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  userInfo?: UserInfo | null;
  onUpgrade?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onClose?: () => void;
  onSelectTemplate?: (prompt: string) => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  collapsed,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onToggleStar,
  onToggleCollapse,
  onOpenSettings,
  userInfo,
  onUpgrade,
  onSignIn,
  onSignOut,
  onClose,
  onSelectTemplate,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  const starred = sessions.filter((s) => s.starred);
  const recent = sessions.filter((s) => !s.starred);
  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  const isPro = userInfo?.plan === "pro";
  const generationsUsed = userInfo?.generationsToday ?? 0;
  const generationsLimit = userInfo?.generationsLimit ?? 5;
  const usagePercent = generationsLimit ? Math.min(100, Math.round((generationsUsed / generationsLimit) * 100)) : 0;
  const projectsUsed = userInfo?.projectCount ?? 0;
  const projectsLimit = userInfo?.projectLimit;

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-foreground" />
            <span className="font-semibold text-sm text-foreground">adgenai</span>
            {isPro && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald/10 text-emerald uppercase tracking-wider">
                Pro
              </span>
            )}
          </div>
        )}
        <button
          onClick={onClose || onToggleCollapse}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            collapsed && "mx-auto"
          )}
        >
          {onClose ? <X className="w-3.5 h-3.5" /> : collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* New chat */}
      <div className="p-2">
        <button
          onClick={() => { onNewChat(); onClose?.(); }}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg text-sm font-medium transition-colors bg-accent hover:bg-ring/20 text-foreground",
            collapsed ? "justify-center p-2" : "px-3 py-2"
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && "New project"}
        </button>
      </div>

      {/* Search Bar */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-muted border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
            />
          </div>
        </div>
      )}

      {/* Templates Section (Antigravity Feature) */}
      {!collapsed && (
        <div className="px-2 pb-4">
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <LayoutTemplate className="w-3 h-3" />
            Launchpad
          </div>
          <div className="grid grid-cols-2 gap-1 px-1">
            <button 
              onClick={() => onSelectTemplate?.("Create a high-end, dark-themed SaaS landing page for an AI developer tool with glassmorphism, animated scrolling sections, and a sleek geometric hero section using emerald accents.")}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-accent/30 hover:bg-emerald/10 hover:border-emerald/30 border border-transparent transition-all text-[10px] text-muted-foreground hover:text-emerald group"
            >
              <Rocket className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              SaaS Hero
            </button>
            <button 
              onClick={() => onSelectTemplate?.("Build a beautiful, high-conversion pricing page with three tiers (Free, Pro, Enterprise). Include a monthly/yearly toggle, pulsing 'Most Popular' badge, and smooth Framer Motion entrance animations.")}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-accent/30 hover:bg-emerald/10 hover:border-emerald/30 border border-transparent transition-all text-[10px] text-muted-foreground hover:text-emerald group"
            >
              <Columns3 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              Pricing
            </button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered ? (
          <SessionList
            sessions={filtered}
            activeSessionId={activeSessionId}
            collapsed={collapsed}
            onSelectSession={(id) => { onSelectSession(id); onClose?.(); }}
            onDeleteSession={onDeleteSession}
            onToggleStar={onToggleStar}
          />
        ) : (
          <>
            {starred.length > 0 && (
              <>
                {!collapsed && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <Star className="w-3 h-3" />
                    Pinned
                  </div>
                )}
                <SessionList
                  sessions={starred}
                  activeSessionId={activeSessionId}
                  collapsed={collapsed}
                  onSelectSession={(id) => { onSelectSession(id); onClose?.(); }}
                  onDeleteSession={onDeleteSession}
                  onToggleStar={onToggleStar}
                />
              </>
            )}
            {recent.length > 0 && (
              <>
                {!collapsed && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 mt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <Clock className="w-3 h-3" />
                    Recent Projects
                  </div>
                )}
                <SessionList
                  sessions={recent}
                  activeSessionId={activeSessionId}
                  collapsed={collapsed}
                  onSelectSession={(id) => { onSelectSession(id); onClose?.(); }}
                  onDeleteSession={onDeleteSession}
                  onToggleStar={onToggleStar}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* ── Usage Dashboard (Free tier) ── */}
      {userInfo && !isPro && !collapsed && (
        <div className="mx-2 mb-2 p-3 rounded-xl border border-border bg-background/50 space-y-2.5">
          {/* Generations bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Generations</span>
              <span className="text-[10px] text-muted-foreground font-mono">{generationsUsed}/{generationsLimit}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${usagePercent}%`,
                  background: usagePercent > 80
                    ? "linear-gradient(90deg, #ef4444, #f97316)"
                    : usagePercent > 50
                      ? "linear-gradient(90deg, #f59e0b, #eab308)"
                      : "linear-gradient(90deg, #10b981, #34d399)",
                }}
              />
            </div>
          </div>
          {/* Projects bar */}
          {projectsLimit && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
                <span className="text-[10px] text-muted-foreground font-mono">{projectsUsed}/{projectsLimit}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out bg-foreground/30"
                  style={{
                    width: `${Math.min(100, Math.round((projectsUsed / projectsLimit) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
          {/* Upgrade CTA */}
          <button
            onClick={onUpgrade}
            className="w-full py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-[0.98] group"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
            }}
          >
            <Sparkles className="w-3 h-3" />
            Upgrade to Pro
          </button>
        </div>
      )}

      {/* ── Pro Badge (Pro tier) ── */}
      {userInfo && isPro && !collapsed && (
        <div className="mx-2 mb-2 p-2.5 rounded-xl bg-emerald/5 border border-emerald/10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald/10 flex items-center justify-center">
              <Crown className="w-3 h-3 text-emerald" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald">Pro Plan</p>
              <p className="text-[10px] text-muted-foreground">Unlimited everything</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed usage indicator */}
      {userInfo && !isPro && collapsed && (
        <div className="mx-auto mb-2">
          <button
            onClick={onUpgrade}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer relative group"
            title={`${generationsUsed}/${generationsLimit} generations used`}
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Footer — Settings & Sign out */}
      <div className="p-2 border-t border-border space-y-1">
        <button
          onClick={onOpenSettings}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            collapsed ? "justify-center p-2" : "px-3 py-2"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && "Settings"}
        </button>

        {/* Resources Section (Antigravity Feature) */}
        {!collapsed && (
          <div className="pt-2 pb-1 px-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">
              Connections
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <button className="flex items-center justify-center gap-1.5 p-1.5 rounded bg-accent/20 hover:bg-accent text-[10px] text-muted-foreground transition-colors">
                <Globe className="w-3 h-3" />
                Discord
              </button>
              <button className="flex items-center justify-center gap-1.5 p-1.5 rounded bg-accent/20 hover:bg-accent text-[10px] text-muted-foreground transition-colors">
                <Share2 className="w-3 h-3" />
                Showcase
              </button>
            </div>
          </div>
        )}

        {/* User info section */}
        {userInfo?.connected && !collapsed && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            {userInfo.avatarUrl ? (
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border/50">
                <Image 
                  src={userInfo.avatarUrl} 
                  alt={userInfo.username || "User"} 
                  fill
                  className="object-cover" 
                />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                {userInfo.username?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate flex-1">{userInfo.username}</span>
          </div>
        )}

        {userInfo?.connected && onSignOut && (
          <button
            onClick={onSignOut}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              collapsed ? "justify-center p-2" : "px-3 py-1.5"
            )}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        )}

        {!userInfo?.connected && onSignIn && (
          <button
            onClick={onSignIn}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg text-xs text-foreground bg-accent hover:bg-ring/20 transition-all font-medium",
              collapsed ? "justify-center p-2" : "px-3 py-1.5"
            )}
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && "Sign in with GitHub"}
          </button>
        )}
      </div>
    </aside>
  );
}

function SessionList({
  sessions,
  activeSessionId,
  collapsed,
  onSelectSession,
  onDeleteSession,
  onToggleStar,
}: {
  sessions: Session[];
  activeSessionId: string | null;
  collapsed: boolean;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onToggleStar: (id: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {sessions.map((s) => (
        <div
          key={s.id}
          className={cn(
            "group flex items-center gap-2 rounded-lg transition-colors cursor-pointer",
            collapsed ? "justify-center p-2" : "px-2.5 py-2",
            s.id === activeSessionId ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
          onClick={() => onSelectSession(s.id)}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-xs">{s.title}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStar(s.id); }}
                  className="p-0.5 rounded hover:bg-background/50"
                >
                  <Star className={cn("w-3 h-3", s.starred ? "fill-yellow-500 text-yellow-500" : "")} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                  className="p-0.5 rounded hover:bg-background/50 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
