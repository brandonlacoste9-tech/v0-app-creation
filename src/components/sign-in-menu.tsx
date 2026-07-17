"use client";

import { useState } from "react";
import { LogIn, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { GithubIcon } from "@/components/icons";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.3l3.2 2.4C8 7.4 9.8 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 8.2 2 4.9 4.1 3.9 7.3z"
      />
      <path
        fill="#4A90E2"
        d="M12 22c2.5 0 4.6-.8 6.1-2.2l-3-2.4c-.8.6-1.9 1-3.1 1-3 0-5.5-2-6.4-4.7l-3.2 2.5C4 19.7 7.6 22 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 13.7c-.2-.6-.3-1.2-.3-1.7s.1-1.2.3-1.7L2.4 7.8C1.8 9.1 1.5 10.5 1.5 12s.3 2.9.9 4.2l3.2-2.5z"
      />
    </svg>
  );
}

interface SignInMenuProps {
  onGitHub: () => void;
  onGoogle: () => void;
  /** Compact sidebar style */
  collapsed?: boolean;
  className?: string;
  /** Primary filled button (header) vs accent (sidebar) */
  variant?: "primary" | "sidebar";
  githubAvailable?: boolean;
  googleAvailable?: boolean;
}

export function SignInMenu({
  onGitHub,
  onGoogle,
  collapsed,
  className,
  variant = "primary",
  githubAvailable = true,
  googleAvailable = true,
}: SignInMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const showGithub = githubAvailable !== false;
  const showGoogle = googleAvailable !== false;

  // Single provider → direct button
  if (showGithub && !showGoogle) {
    return (
      <button
        type="button"
        onClick={onGitHub}
        className={cn(
          "flex items-center gap-2 rounded-lg text-xs font-semibold transition-all",
          variant === "primary"
            ? "bg-foreground px-3 py-1.5 text-background hover:opacity-90"
            : "w-full bg-accent px-3 py-1.5 text-foreground hover:bg-ring/20",
          collapsed && "justify-center p-2",
          className
        )}
      >
        <GithubIcon className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && t("nav.signInGitHub")}
      </button>
    );
  }
  if (showGoogle && !showGithub) {
    return (
      <button
        type="button"
        onClick={onGoogle}
        className={cn(
          "flex items-center gap-2 rounded-lg text-xs font-semibold transition-all",
          variant === "primary"
            ? "bg-foreground px-3 py-1.5 text-background hover:opacity-90"
            : "w-full bg-accent px-3 py-1.5 text-foreground hover:bg-ring/20",
          collapsed && "justify-center p-2",
          className
        )}
      >
        <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && t("nav.signInGoogle")}
      </button>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all",
          variant === "primary"
            ? "bg-foreground px-3 py-1.5 text-background hover:opacity-90"
            : "w-full bg-accent px-3 py-1.5 text-foreground hover:bg-ring/20",
          collapsed && "justify-center p-2"
        )}
      >
        <LogIn className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && (
          <>
            {t("nav.signIn")}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl",
              variant === "primary" ? "right-0" : "left-0 right-0"
            )}
          >
            {showGithub && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onGitHub();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
              >
                <GithubIcon className="h-4 w-4" />
                {t("nav.signInGitHub")}
              </button>
            )}
            {showGoogle && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onGoogle();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
              >
                <GoogleIcon className="h-4 w-4" />
                {t("nav.signInGoogle")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
