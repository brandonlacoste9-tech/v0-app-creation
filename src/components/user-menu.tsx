"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, LogOut, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserInfo } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface UserMenuProps {
  userInfo: UserInfo;
  onOpenSettings?: () => void;
  onSignOut: () => void;
  onUpgrade?: () => void;
  className?: string;
}

/**
 * Header account menu — avatar + Sign out (always visible when signed in).
 */
export function UserMenu({
  userInfo,
  onOpenSettings,
  onSignOut,
  onUpgrade,
  className,
}: UserMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Use click (not mousedown) so menu item clicks fire before outside-close
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial =
    userInfo.username?.charAt(0).toUpperCase() ||
    userInfo.email?.charAt(0).toUpperCase() ||
    "?";

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-haspopup="menu"
        title={userInfo.username || userInfo.email || "Account menu — Sign out"}
      >
        {userInfo.avatarUrl ? (
          <div className="relative h-6 w-6 overflow-hidden rounded-full border border-border">
            <Image
              src={userInfo.avatarUrl}
              alt=""
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {initial}
          </div>
        )}
        <span className="hidden max-w-[7rem] truncate text-xs font-medium text-foreground sm:inline">
          {userInfo.username || userInfo.email || "Account"}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-xs font-semibold text-foreground">
              {userInfo.username || "Signed in"}
            </p>
            {userInfo.email && (
              <p className="truncate text-[10px] text-muted-foreground">
                {userInfo.email}
              </p>
            )}
            {userInfo.authProvider && (
              <p className="mt-0.5 text-[10px] capitalize text-muted-foreground/80">
                via {userInfo.authProvider}
              </p>
            )}
          </div>

          {/* Sign out first — most discoverable */}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("nav.signOut")}
          </button>

          <div className="my-1 border-t border-border" />

          {onOpenSettings && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              {t("nav.settings")}
            </button>
          )}

          {userInfo.plan === "free" && onUpgrade && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onUpgrade();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-emerald hover:bg-accent"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("nav.upgrade")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
