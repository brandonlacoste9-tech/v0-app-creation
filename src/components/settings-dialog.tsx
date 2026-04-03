"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Sliders, ChevronDown, ExternalLink, Server, Key, Info, RotateCcw } from "lucide-react";
import type { AppSettings, AIProvider, BrandKit } from "@/lib/types";
import { PROVIDER_INFO, PROVIDER_MODELS, DEFAULT_SETTINGS } from "@/lib/types";
import { SYSTEM_PROMPT } from "@/lib/ai";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

const PROVIDER_ORDER: AIProvider[] = ["groq", "deepseek", "ollama", "openai", "anthropic"];

type SettingsTab = "provider" | "generation" | "brandkit";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "provider", label: "AI Provider" },
  { key: "generation", label: "Generation" },
  { key: "brandkit", label: "Brand Kit" },
];

const FONT_SUGGESTIONS = ["Inter", "Poppins", "Roboto", "Open Sans", "Lato", "Montserrat", "Nunito", "Raleway"];

export function SettingsDialog({ open, onClose, settings, onSettingsChange }: SettingsDialogProps) {
  const [local, setLocal] = useState(settings);
  const [showOllamaGuide, setShowOllamaGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("provider");

  useEffect(() => { setLocal(settings); }, [settings, open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleProviderChange = (provider: AIProvider) => {
    const models = PROVIDER_MODELS[provider];
    setLocal({
      ...local,
      provider,
      model: models[0]?.value ?? "",
      apiKey: "",
    });
  };

  const updateBrandKit = (patch: Partial<BrandKit>) => {
    setLocal({ ...local, brandKit: { ...local.brandKit, ...patch } });
  };

  if (!open) return null;

  const providerInfo = PROVIDER_INFO[local.provider];
  const models = PROVIDER_MODELS[local.provider];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Settings</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-0 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1">

          {/* ═══ AI Provider Tab ═══ */}
          {activeTab === "provider" && (
            <>
              {/* Provider grid */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDER_ORDER.map((p) => {
                    const info = PROVIDER_INFO[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={cn(
                          "flex flex-col items-start px-3 py-2.5 rounded-lg border transition-colors text-left",
                          local.provider === p ? "border-foreground bg-accent" : "border-border hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <span className="text-sm font-medium text-foreground">{info.name}</span>
                          {local.provider === p && <div className="w-1.5 h-1.5 rounded-full bg-foreground ml-auto" />}
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{info.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* API Key */}
              {providerInfo.requiresKey && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-muted-foreground" />
                    API Key
                  </label>
                  <input
                    type="password"
                    value={local.apiKey}
                    onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
                    placeholder={providerInfo.keyPlaceholder ?? "Enter API key..."}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono"
                  />
                  {providerInfo.keyHint && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3 shrink-0" />
                      {providerInfo.keyHint}
                    </p>
                  )}
                  {(local.provider === "groq" || local.provider === "deepseek") && (
                    <p className="text-[11px] text-muted-foreground">
                      Optional — falls back to server-side key if left empty.
                    </p>
                  )}
                </div>
              )}

              {/* Ollama URL */}
              {local.provider === "ollama" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-muted-foreground" />
                    Ollama URL
                  </label>
                  <input
                    type="text"
                    value={local.ollamaUrl}
                    onChange={(e) => setLocal({ ...local, ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono"
                  />
                  <button
                    onClick={() => setShowOllamaGuide(!showOllamaGuide)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showOllamaGuide && "rotate-180")} />
                    {showOllamaGuide ? "Hide" : "Show"} Ollama setup guide
                  </button>

                  {showOllamaGuide && (
                    <div className="bg-background border border-border rounded-lg p-4 space-y-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground text-sm">Setting up Ollama</p>
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">1. Install Ollama</p>
                        <p>
                          Download from{" "}
                          <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 inline-flex items-center gap-0.5">
                            ollama.com <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">2. Pull a model</p>
                        <code className="block bg-card border border-border rounded px-2 py-1.5 font-mono text-foreground text-[11px]">
                          ollama pull qwen2.5-coder:7b
                        </code>
                        <p>Recommended for coding. Needs ~5GB VRAM.</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">3. Start Ollama</p>
                        <code className="block bg-card border border-border rounded px-2 py-1.5 font-mono text-foreground text-[11px]">
                          ollama serve
                        </code>
                        <p>Runs on localhost:11434 by default. On macOS/Windows the app starts the server automatically.</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">4. CORS (if running remotely)</p>
                        <p>If accessing from a different host, set:</p>
                        <code className="block bg-card border border-border rounded px-2 py-1.5 font-mono text-foreground text-[11px]">
                          OLLAMA_ORIGINS=* ollama serve
                        </code>
                      </div>
                      <div className="pt-1 border-t border-border">
                        <p className="font-medium text-foreground">Recommended models by VRAM:</p>
                        <ul className="mt-1 space-y-0.5">
                          <li><span className="text-foreground font-mono">8GB+</span> — qwen2.5-coder:7b, llama3.1:8b</li>
                          <li><span className="text-foreground font-mono">12GB+</span> — deepseek-coder-v2, codellama:13b</li>
                          <li><span className="text-foreground font-mono">16GB+</span> — qwen2.5-coder:14b, llama3.1:14b</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Model</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {models.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setLocal({ ...local, model: m.value })}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors text-left",
                        local.model === m.value ? "border-foreground bg-accent" : "border-border hover:bg-accent"
                      )}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                      </div>
                      {local.model === m.value && <div className="w-2 h-2 rounded-full bg-foreground" />}
                    </button>
                  ))}
                </div>
                {local.provider === "ollama" && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">Or enter a custom model name:</p>
                    <input
                      type="text"
                      value={models.some((m) => m.value === local.model) ? "" : local.model}
                      onChange={(e) => setLocal({ ...local, model: e.target.value })}
                      placeholder="e.g. codellama:13b, phi3:latest"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Temperature</label>
                  <span className="text-xs text-muted-foreground font-mono">{local.temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={local.temperature}
                  onChange={(e) => setLocal({ ...local, temperature: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Precise</span><span>Creative</span>
                </div>
              </div>
            </>
          )}

          {/* ═══ Generation Tab ═══ */}
          {activeTab === "generation" && (
            <>
              {/* Theme */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Theme</label>
                <div className="flex gap-2">
                  {(["dark", "light", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setLocal({ ...local, theme: t })}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors capitalize",
                        local.theme === t ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Output Format</label>
                <div className="flex gap-2">
                  {(["tsx", "jsx", "html"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setLocal({ ...local, outputFormat: f })}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border text-xs font-medium font-mono transition-colors uppercase",
                        local.outputFormat === f ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Max Tokens</label>
                  <span className="text-xs text-muted-foreground font-mono">{local.maxTokens}</span>
                </div>
                <input
                  type="range" min="1024" max="16384" step="512"
                  value={local.maxTokens}
                  onChange={(e) => setLocal({ ...local, maxTokens: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1024</span><span>16384</span>
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Custom System Prompt</label>
                  {local.customSystemPrompt && (
                    <button
                      onClick={() => setLocal({ ...local, customSystemPrompt: "" })}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to default
                    </button>
                  )}
                </div>
                <textarea
                  value={local.customSystemPrompt}
                  onChange={(e) => setLocal({ ...local, customSystemPrompt: e.target.value })}
                  placeholder={SYSTEM_PROMPT.slice(0, 200) + "..."}
                  rows={5}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono resize-none leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave empty to use the default system prompt.
                </p>
              </div>
            </>
          )}

          {/* ═══ Brand Kit Tab ═══ */}
          {activeTab === "brandkit" && (
            <>
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">Brand Kit</label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Inject brand guidelines into generated code</p>
                </div>
                <button
                  onClick={() => updateBrandKit({ enabled: !local.brandKit.enabled })}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    local.brandKit.enabled ? "bg-foreground" : "bg-border"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform",
                      local.brandKit.enabled && "translate-x-5"
                    )}
                  />
                </button>
              </div>

              {local.brandKit.enabled && (
                <>
                  {/* Colors */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">Colors</label>
                    {([
                      { key: "primaryColor" as const, label: "Primary" },
                      { key: "secondaryColor" as const, label: "Secondary" },
                      { key: "accentColor" as const, label: "Accent" },
                    ]).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={local.brandKit[key]}
                          onChange={(e) => updateBrandKit({ [key]: e.target.value })}
                          className="w-8 h-8 rounded-md border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={local.brandKit[key]}
                          onChange={(e) => updateBrandKit({ [key]: e.target.value })}
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono outline-none focus:border-ring transition-colors"
                        />
                        <span className="text-[11px] text-muted-foreground w-20">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Font Family</label>
                    <input
                      type="text"
                      value={local.brandKit.fontFamily}
                      onChange={(e) => updateBrandKit({ fontFamily: e.target.value })}
                      placeholder="e.g. Inter, Poppins, Roboto"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
                    />
                    <div className="flex flex-wrap gap-1">
                      {FONT_SUGGESTIONS.map((f) => (
                        <button
                          key={f}
                          onClick={() => updateBrandKit({ fontFamily: f })}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] border transition-colors",
                            local.brandKit.fontFamily === f
                              ? "border-foreground bg-accent text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo URL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Logo URL</label>
                    <input
                      type="text"
                      value={local.brandKit.logoUrl}
                      onChange={(e) => updateBrandKit({ logoUrl: e.target.value })}
                      placeholder="https://example.com/logo.svg"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono"
                    />
                  </div>

                  {/* Button Style */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Button Style</label>
                    <div className="flex gap-2">
                      {(["rounded", "pill", "square"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateBrandKit({ buttonStyle: s })}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 border transition-colors",
                            s === "rounded" ? "rounded-lg" : s === "pill" ? "rounded-full" : "rounded-none",
                            local.brandKit.buttonStyle === s
                              ? "border-foreground bg-accent text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          <div
                            className={cn(
                              "w-full h-6 bg-foreground/20",
                              s === "rounded" ? "rounded-md" : s === "pill" ? "rounded-full" : "rounded-none"
                            )}
                          />
                          <span className="text-[11px] font-medium capitalize">{s}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Tone</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["professional", "casual", "playful", "minimal"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateBrandKit({ tone: t })}
                          className={cn(
                            "px-3 py-2 rounded-lg border text-xs font-medium transition-colors capitalize",
                            local.brandKit.tone === t
                              ? "border-foreground bg-accent text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Cancel</button>
          <button onClick={() => { onSettingsChange(local); onClose(); }} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Save changes</button>
        </div>
      </div>
    </>
  );
}
