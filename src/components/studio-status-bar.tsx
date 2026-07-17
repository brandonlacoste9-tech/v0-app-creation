"use client";

import { cn } from "@/lib/utils";
import type { GitHubStatus, UserInfo, AIProvider } from "@/lib/types";
import { PROVIDER_INFO, PROVIDER_MODELS } from "@/lib/types";
import { GithubIcon } from "@/components/icons";
import { Activity, Circle, Loader2, Zap } from "lucide-react";

interface StudioStatusBarProps {
  model: string;
  provider: AIProvider;
  userInfo: UserInfo | null;
  githubStatus?: GitHubStatus;
  isGenerating: boolean;
  hasProject: boolean;
  fileCount?: number;
  className?: string;
  onOpenSettings?: () => void;
  onOpenUpgrade?: () => void;
  onConnectGitHub?: () => void;
  onOpenTelemetry?: () => void;
}

export function StudioStatusBar({
  model,
  provider,
  userInfo,
  githubStatus,
  isGenerating,
  hasProject,
  fileCount,
  className,
  onOpenSettings,
  onOpenUpgrade,
  onConnectGitHub,
  onOpenTelemetry,
}: StudioStatusBarProps) {
  const modelLabel =
    PROVIDER_MODELS[provider]?.find((m) => m.value === model)?.label || model;
  const providerName = PROVIDER_INFO[provider]?.name?.split(" ")[0] || provider;
  const isPaid = userInfo?.plan != null && userInfo.plan !== "free";
  const planLabel =
    userInfo?.plan === "max"
      ? "Max"
      : userInfo?.plan === "pro"
        ? "Pro"
        : userInfo?.plan === "builder"
          ? "Builder"
          : "Free";
  const gens = userInfo?.generationsToday ?? 0;
  const limit = userInfo?.generationsLimit;

  return (
    <footer
      className={cn(
        "hidden h-7 shrink-0 items-center justify-between border-t border-border bg-card/95 px-3 text-[10px] text-muted-foreground backdrop-blur-sm md:flex",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5">
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
          ) : (
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                hasProject ? "text-emerald" : "text-muted-foreground/40"
              )}
            />
          )}
          <span className={cn("font-medium", isGenerating && "text-orange-400")}>
            {isGenerating ? "Building" : hasProject ? "Ready" : "Idle"}
          </span>
        </span>

        <button
          type="button"
          onClick={onOpenSettings}
          className="truncate rounded px-1.5 py-0.5 font-mono hover:bg-accent hover:text-foreground"
          title="Open settings"
        >
          {providerName} · {modelLabel}
        </button>

        {typeof fileCount === "number" && fileCount > 0 && (
          <span className="hidden font-mono sm:inline">
            {fileCount} file{fileCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onOpenTelemetry && (
          <button
            type="button"
            onClick={onOpenTelemetry}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
            title="Agent X-Ray telemetry"
          >
            <Activity className="h-3 w-3" />
            X-Ray
          </button>
        )}
        {userInfo && (
          <button
            type="button"
            onClick={isPaid && limit == null ? undefined : onOpenUpgrade}
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5",
              isPaid
                ? "text-emerald"
                : "hover:bg-accent hover:text-foreground"
            )}
          >
            <Zap className="h-3 w-3" />
            {isPaid
              ? limit != null
                ? `${planLabel} · ${gens}/${limit}`
                : planLabel
              : limit != null
                ? `${gens}/${limit} gens`
                : "Free"}
          </button>
        )}

        <button
          type="button"
          onClick={githubStatus?.connected ? undefined : onConnectGitHub}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5",
            githubStatus?.connected
              ? "text-foreground/80"
              : "hover:bg-accent hover:text-foreground"
          )}
          title={
            githubStatus?.connected
              ? `@${githubStatus.username || "github"}`
              : "Connect GitHub"
          }
        >
          <GithubIcon className="h-3 w-3" />
          {githubStatus?.connected
            ? githubStatus.username || "GitHub"
            : "GitHub"}
        </button>
      </div>
    </footer>
  );
}
