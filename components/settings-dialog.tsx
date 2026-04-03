"use client"

import { useState, useEffect, useRef } from "react"
import { X, Sliders, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserSettings } from "@/lib/storage"

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  settings: UserSettings
  onSettingsChange: (settings: UserSettings) => void
  onUpgrade?: () => void
}

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "OpenAI · Fast and efficient" },
  { value: "gpt-4o", label: "GPT-4o", description: "OpenAI · Most capable" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", description: "Anthropic · Balanced" },
  { value: "grok-2", label: "Grok 2", description: "xAI · Powerful and witty" },
  { value: "grok-3-mini", label: "Grok 3 Mini", description: "xAI · Fast and efficient" },
  { value: "groq-llama-3.3-70b", label: "Llama 3.3 70B", description: "Groq · Fast inference" },
  { value: "groq-llama-3.1-8b", label: "Llama 3.1 8B", description: "Groq · Fastest inference" },
  { value: "groq-mixtral-8x7b", label: "Mixtral 8x7B", description: "Groq · Fast inference" },
] as const

export function SettingsDialog({
  open,
  onClose,
  settings,
  onSettingsChange,
  onUpgrade,
}: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState(settings)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleSave = () => {
    onSettingsChange(localSettings)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Model</label>
            <div className="space-y-1.5">
              {MODELS.map((model) => (
                <button
                  key={model.value}
                  onClick={() => setLocalSettings({ ...localSettings, model: model.value })}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors text-left",
                    localSettings.model === model.value
                      ? "border-foreground bg-accent"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{model.label}</div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </div>
                  {localSettings.model === model.value && (
                    <div className="w-2 h-2 rounded-full bg-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Temperature</label>
              <span className="text-xs text-muted-foreground font-mono">
                {localSettings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localSettings.temperature}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, temperature: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Plan & Billing */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Plan &amp; Billing</label>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {settings.planId ?? "Free"} Plan
                    </span>
                    {(settings.planId === "pro" || settings.planId === "unlimited") && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-foreground text-background rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {settings.planId === "unlimited"
                      ? "Unlimited generations per month"
                      : settings.planId === "pro"
                      ? `${settings.generationsUsed ?? 0} / 500 generations this month`
                      : `${settings.generationsUsed ?? 0} / 10 generations this month`}
                  </p>
                </div>
                {settings.planId !== "unlimited" && (
                  <button
                    onClick={() => {
                      onClose()
                      onUpgrade?.()
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded-lg hover:opacity-90 transition-opacity shrink-0"
                  >
                    <Zap className="w-3 h-3" />
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity font-medium"
          >
            Save changes
          </button>
        </div>
      </div>
    </>
  )
}
