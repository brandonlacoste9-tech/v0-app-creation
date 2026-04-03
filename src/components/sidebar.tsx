"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Session, UserInfo } from "@/lib/types";
import {
  Plus,
  MessageSquare,
  Star,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Search,
  Clock,
  X,
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
  onClose?: () => void;
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
  onClose,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  const starred = sessions.filter((s) => s.starred);
  const recent = sessions.filter((s) => !s.starred);
  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : null;

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

      {/* Search */}
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

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {userInfo && (
          <button
            onClick={userInfo.plan === "pro" ? undefined : onUpgrade}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg text-xs font-medium transition-colors",
              collapsed ? "justify-center p-2" : "px-3 py-1.5",
              userInfo.plan === "pro"
                ? "text-emerald"
                : "text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            )}
          >
            {userInfo.plan === "pro" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" />
                {!collapsed && "Pro"}
              </>
            ) : userInfo.connected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                {!collapsed && "Free — Upgrade"}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                {!collapsed && "Free"}
              </>
            )}
          </button>
        )}
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
