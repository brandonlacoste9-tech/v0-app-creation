"use client"

import { Zap, X } from "lucide-react"

interface UpgradeBannerProps {
  onUpgrade: () => void
  onDismiss?: () => void
}

export function UpgradeBanner({ onUpgrade, onDismiss }: UpgradeBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted border-b border-border text-xs">
      <Zap className="w-3.5 h-3.5 shrink-0 text-foreground" />
      <span className="flex-1 text-muted-foreground">
        You&apos;ve reached your monthly generation limit.
      </span>
      <button
        onClick={onUpgrade}
        className="px-3 py-1 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
      >
        Upgrade
      </button>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
