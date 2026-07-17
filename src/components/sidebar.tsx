"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Session, UserInfo } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
import { SignInMenu } from "@/components/sign-in-menu";
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
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
  /** Which OAuth providers are configured on the server */
  authProviders?: { github?: boolean; google?: boolean };
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
  onSignInGoogle,
  onSignOut,
  onClose,
  onSelectTemplate,
  authProviders,
}: SidebarProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const starred = sessions.filter((s) => s.starred);
  const recent = sessions.filter((s) => !s.starred);
  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  const isPaid = userInfo?.plan != null && userInfo.plan !== "free";
  const planBadge =
    userInfo?.plan === "max"
      ? "Max"
      : userInfo?.plan === "pro"
        ? "Pro"
        : userInfo?.plan === "builder"
          ? "Builder"
          : null;
  const generationsUsed = userInfo?.generationsToday ?? 0;
  const generationsLimit = userInfo?.generationsLimit ?? null;
  const usagePercent =
    generationsLimit != null
      ? Math.min(100, Math.round((generationsUsed / generationsLimit) * 100))
      : 0;
  const projectsUsed = userInfo?.projectCount ?? 0;
  const projectsLimit = userInfo?.projectLimit;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-card/95 transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-foreground" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {t("app.name")}
            </span>
            {planBadge && (
              <span className="rounded-full bg-emerald/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald">
                {planBadge}
              </span>
            )}
          </div>
        )}
        <div className={cn("flex items-center gap-1", collapsed && "mx-auto flex-col")}>
          {!collapsed && <LanguageToggle />}
          <button
            onClick={onClose || onToggleCollapse}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {onClose ? <X className="h-3.5 w-3.5" /> : collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* New project */}
      <div className="p-2">
        <button
          onClick={() => { onNewChat(); onClose?.(); }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed ? "justify-center p-2" : "px-3 py-2"
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && t("nav.newProject")}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("nav.search")}
              className="w-full rounded-lg border border-border bg-muted/60 py-1.5 pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background"
            />
          </div>
        </div>
      )}

      {/* Launchpad */}
      {!collapsed && (
        <div className="px-2 pb-3">
          <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <LayoutTemplate className="h-3 w-3" />
            {t("nav.templates")}
          </div>
          <div className="grid grid-cols-2 gap-1.5 px-0.5">
            <button
              onClick={() => onSelectTemplate?.("Create a high-end, dark-themed SaaS landing page for an AI developer tool with glassmorphism, animated scrolling sections, and a sleek geometric hero section using emerald accents.")}
              className="group flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-2 text-[10px] text-muted-foreground transition-all hover:border-emerald/35 hover:bg-emerald/10 hover:text-emerald"
            >
              <Rocket className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
              SaaS Hero
            </button>
            <button
              onClick={() => onSelectTemplate?.("Build a beautiful, high-conversion pricing page with three tiers (Free, Pro, Enterprise). Include a monthly/yearly toggle, pulsing 'Most Popular' badge, and smooth Framer Motion entrance animations.")}
              className="group flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-2 text-[10px] text-muted-foreground transition-all hover:border-emerald/35 hover:bg-emerald/10 hover:text-emerald"
            >
              <Columns3 className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
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
                    {t("nav.starred")}
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
                    {t("nav.recent")}
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

      {/* ── Usage dashboard when daily gen cap exists ── */}
      {userInfo && generationsLimit != null && !collapsed && (
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
          {projectsLimit != null && (
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
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald py-2 text-[11px] font-bold text-zinc-950 shadow-[0_2px_12px_rgba(16,185,129,0.25)] transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          >
            <Sparkles className="h-3 w-3" />
            {t("nav.upgrade")}
          </button>
        </div>
      )}

      {/* ── Paid badge when unlimited gens ── */}
      {userInfo && isPaid && generationsLimit == null && !collapsed && (
        <div className="mx-2 mb-2 p-2.5 rounded-xl bg-emerald/5 border border-emerald/10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald/10 flex items-center justify-center">
              <Crown className="w-3 h-3 text-emerald" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald">{planBadge} plan</p>
              <p className="text-[10px] text-muted-foreground">Unlimited generations</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed usage indicator */}
      {userInfo && generationsLimit != null && collapsed && (
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
          {!collapsed && t("nav.settings")}
        </button>

        {/* Resources Section (Antigravity Feature) */}
        {!collapsed && (
          <div className="pt-2 pb-1 px-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">
              Connections
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <a
                href="https://discord.gg"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 p-1.5 rounded bg-accent/20 hover:bg-accent text-[10px] text-muted-foreground transition-colors"
              >
                <Globe className="w-3 h-3" />
                Discord
              </a>
              <a
                href="/gallery"
                className="flex items-center justify-center gap-1.5 p-1.5 rounded bg-accent/20 hover:bg-accent text-[10px] text-muted-foreground transition-colors"
              >
                <Share2 className="w-3 h-3" />
                Showcase
              </a>
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
            {!collapsed && t("nav.signOut")}
          </button>
        )}

        {!userInfo?.connected && (onSignIn || onSignInGoogle) && (
          <SignInMenu
            variant="sidebar"
            collapsed={collapsed}
            onGitHub={() => onSignIn?.()}
            onGoogle={() => onSignInGoogle?.()}
            githubAvailable={authProviders?.github !== false && !!onSignIn}
            googleAvailable={authProviders?.google !== false && !!onSignInGoogle}
          />
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
