"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sliders, ChevronDown, ExternalLink, Server, Key, Info, RotateCcw, Zap, Sparkles, Lock, Bot, Plus, Trash2, Shield } from "lucide-react";
import type { AppSettings, AIProvider, BrandKit, UserInfo } from "@/lib/types";
import { PROVIDER_INFO, PROVIDER_MODELS, APP_THEMES } from "@/lib/types";
import { SYSTEM_PROMPT } from "@/lib/ai";
import { introspectDatabase } from "@/lib/api-client";
import { toast } from "sonner";
import {
  emptyCustomTool,
  isValidToolName,
  type CustomAgentTool,
  type CustomToolParamType,
} from "@/lib/byob/agent-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  userInfo?: UserInfo | null;
  onUpgrade?: () => void;
  /** Active studio session id — for project ingest keys */
  activeSessionId?: string | null;
}

const PROVIDER_ORDER: AIProvider[] = ["groq", "xai", "ollama", "deepseek", "openai", "anthropic"];

type SettingsTab =
  | "provider"
  | "generation"
  | "brandkit"
  | "database"
  | "agents"
  | "access";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "provider", label: "AI Provider" },
  { key: "generation", label: "Generation" },
  { key: "brandkit", label: "Brand Kit" },
  { key: "database", label: "Database" },
  { key: "agents", label: "Agents" },
  { key: "access", label: "Access" },
];

const FONT_SUGGESTIONS = ["Inter", "Poppins", "Roboto", "Open Sans", "Lato", "Montserrat", "Nunito", "Raleway"];

export function SettingsDialog({
  open,
  onClose,
  settings,
  onSettingsChange,
  userInfo,
  onUpgrade,
  activeSessionId,
}: SettingsDialogProps) {
  const [local, setLocal] = useState(settings);
  const [showOllamaGuide, setShowOllamaGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("provider");
  const [dbUrl, setDbUrl] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [pats, setPats] = useState<
    { id: string; name: string; prefix: string; createdAt: string }[]
  >([]);
  const [ingestKeys, setIngestKeys] = useState<
    {
      id: string;
      name: string;
      prefix: string;
      projectId: string;
      createdAt: string;
    }[]
  >([]);
  const [newRawToken, setNewRawToken] = useState<string | null>(null);
  const [newRawIngest, setNewRawIngest] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);

  const refreshAccess = async () => {
    try {
      const [tRes, kRes] = await Promise.all([
        fetch("/api/auth/tokens"),
        fetch(
          activeSessionId
            ? `/api/auth/ingest-keys?projectId=${encodeURIComponent(activeSessionId)}`
            : "/api/auth/ingest-keys"
        ),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setPats(d.tokens || []);
      }
      if (kRes.ok) {
        const d = await kRes.json();
        setIngestKeys(d.keys || []);
      }
    } catch {
      /* ignore */
    }
  };

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

  const providerInfo = PROVIDER_INFO[local.provider];
  const models = PROVIDER_MODELS[local.provider];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sliders className="h-4 w-4 text-muted-foreground" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 px-5 pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
            <TabsList className="h-9 w-full justify-start gap-1 bg-muted/60">
              {TABS.map((tab) => {
                const isBrandKit = tab.key === "brandkit";
                const isLocked = isBrandKit && userInfo && !userInfo.brandKit && userInfo.plan === "free";
                const brandLocked = isBrandKit && userInfo && userInfo.brandKit === false;
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="text-xs data-[state=active]:shadow-sm">
                    {tab.label}
                    {(isLocked || brandLocked) && (
                      <span className="ml-1 text-[9px] font-bold tracking-tighter text-emerald">PRO</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">

          {/* ═══ AI Provider Tab ═══ */}
          {activeTab === "provider" && (
            <>
              {/* Provider grid */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDER_ORDER.map((p) => {
                    const info = PROVIDER_INFO[p];
                    const allowed = !userInfo?.providers?.length || userInfo.providers.includes(p);
                    const isLocked = Boolean(userInfo?.connected && !allowed);
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          if (isLocked) { onUpgrade?.(); return; }
                          handleProviderChange(p);
                        }}
                        className={cn(
                          "flex flex-col items-start px-3 py-2.5 rounded-lg border transition-colors text-left relative",
                          isLocked
                            ? "border-border opacity-60 cursor-pointer"
                            : local.provider === p ? "border-foreground bg-accent" : "border-border hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <span className="text-sm font-medium text-foreground">{info.name}</span>
                          {isLocked && (
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Lock className="w-3 h-3" />
                              PRO
                            </span>
                          )}
                          {!isLocked && local.provider === p && <div className="w-1.5 h-1.5 rounded-full bg-foreground ml-auto" />}
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
                  {(local.provider === "groq" ||
                    local.provider === "xai" ||
                    local.provider === "deepseek") && (
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
              {/* Multi-Model Duel Mode */}
              <div className="space-y-3 p-3 rounded-lg bg-accent/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground">Duel Mode</label>
                      <p className="text-[11px] text-muted-foreground">Compare two models side-by-side</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLocal({ ...local, duelMode: !local.duelMode })}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors",
                      local.duelMode ? "bg-blue-500" : "bg-border"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform shadow-sm",
                        local.duelMode && "translate-x-5"
                      )}
                    />
                  </button>
                </div>

                {local.duelMode && (
                  <div className="space-y-2 mt-2 pt-3 border-t border-border/50">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Opponent Model</label>
                    <select
                      value={local.duelModel}
                      onChange={(e) => setLocal({ ...local, duelModel: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-ring transition-colors"
                    >
                      {Object.entries(PROVIDER_MODELS).flatMap(([provider, models]) =>
                        models.map((m) => (
                          <option key={`${provider}-${m.value}`} value={m.value}>
                            {PROVIDER_INFO[provider as AIProvider].name}: {m.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Prompt Optimizer */}
              <div className="space-y-3 p-3 rounded-lg bg-accent/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground">Technical Optimizer</label>
                      <p className="text-[11px] text-muted-foreground">Auto-enhance prompts for engineering</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLocal({ ...local, promptOptimizer: !local.promptOptimizer })}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors",
                      local.promptOptimizer ? "bg-amber-500" : "bg-border"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform shadow-sm",
                        local.promptOptimizer && "translate-x-5"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* App Theme */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">App Theme</label>
                <div className="grid grid-cols-5 gap-2">
                  {APP_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setLocal({ ...local, appTheme: t.id })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors",
                        local.appTheme === t.id ? "border-foreground bg-accent" : "border-border hover:bg-accent/50"
                      )}
                    >
                      <div className="flex w-full h-6 rounded-md overflow-hidden border border-border/50">
                        <div className="flex-1" style={{ background: t.background }} />
                        <div className="flex-1" style={{ background: t.card }} />
                        <div className="flex-1" style={{ background: t.accent }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight text-center truncate w-full">{t.name}</span>
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
            <div className="relative">
              {/* Lock overlay for Free users */}
              {userInfo && userInfo.brandKit === false && (
                <div className="absolute inset-0 z-10 bg-card/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 space-y-4 rounded-xl border border-dashed border-border mt-[-10px]">
                  <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-emerald" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Brand Kit is on Pro & Max</h3>
                    <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
                      Save brand colors, logos, and fonts so every generation stays on-brand.
                    </p>
                  </div>
                  <button
                    onClick={onUpgrade}
                    className="px-6 py-2 rounded-lg bg-emerald text-white text-xs font-bold shadow-lg shadow-emerald/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}

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
            </div>
          )}

          {/* ═══ Database / BYOB Tab ═══ */}
          {activeTab === "database" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-muted-foreground" />
                  Bring Your Own Backend
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Paste a Neon or Supabase Postgres connection string. Shipboard runs{" "}
                  <strong className="text-foreground/80">read-only introspection</strong>, maps
                  tables, injects them into generation, and ships Drizzle schema + Server Actions
                  with your Next.js export. The password is never stored — only the schema map.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Connection string
                </label>
                <input
                  type="password"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  placeholder="postgresql://user:pass@ep-….neon.tech/neondb?sslmode=require"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={dbLoading || !dbUrl.trim()}
                  onClick={async () => {
                    setDbLoading(true);
                    try {
                      const { schema, message } = await introspectDatabase(dbUrl.trim());
                      setLocal({
                        ...local,
                        byob: { schema },
                      });
                      setDbUrl("");
                      toast.success(message || `Mapped ${schema.tableCount} tables`);
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "Introspection failed");
                    } finally {
                      setDbLoading(false);
                    }
                  }}
                >
                  {dbLoading ? "Introspecting…" : "Connect & map schema"}
                </Button>
                {local.byob?.schema && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLocal({ ...local, byob: { schema: null } });
                      toast.message("Database disconnected");
                    }}
                  >
                    Disconnect
                  </Button>
                )}
              </div>

              {local.byob?.schema ? (
                <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Connected · {local.byob.schema.provider}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {local.byob.schema.tableCount} tables
                      {local.byob.schema.hostHint
                        ? ` · ${local.byob.schema.hostHint}`
                        : ""}
                    </span>
                  </div>
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono text-muted-foreground">
                    {local.byob.schema.tables.slice(0, 20).map((t) => (
                      <li key={t.name} className="truncate">
                        <span className="text-foreground/90">{t.name}</span>
                        <span className="opacity-60">
                          {" "}
                          ({t.columns.length} cols
                          {t.foreignKeys.length
                            ? `, ${t.foreignKeys.length} FK`
                            : ""}
                          )
                        </span>
                      </li>
                    ))}
                    {local.byob.schema.tables.length > 20 && (
                      <li>…+{local.byob.schema.tables.length - 20} more</li>
                    )}
                  </ul>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Save settings, then generate UI. Export/Push includes{" "}
                    <code className="text-foreground/80">lib/db/schema.ts</code>,{" "}
                    <code className="text-foreground/80">lib/db/index.ts</code>, and{" "}
                    <code className="text-foreground/80">app/actions.ts</code>.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground leading-relaxed">
                  No database mapped yet. After connect, chat generations know your tables and
                  ship export wires Drizzle + Neon.
                </div>
              )}
            </div>
          )}

          {/* ═══ Access / multi-tenant tokens ═══ */}
          {activeTab === "access" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  Multi-tenant access
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  CLI PATs and project ingest keys are scoped to your account. Secrets are
                  hashed at rest and shown only once. Sign in required.
                </p>
              </div>

              {!userInfo?.connected && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-100">
                  Sign in to create PATs and ingest keys. Without them, sync and telemetry
                  APIs reject unauthenticated traffic.
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!userInfo?.connected || accessBusy}
                  onClick={() => void refreshAccess()}
                >
                  Refresh
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">CLI personal access tokens</span>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!userInfo?.connected || accessBusy}
                    onClick={async () => {
                      setAccessBusy(true);
                      setNewRawToken(null);
                      try {
                        const res = await fetch("/api/auth/tokens", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: "CLI token" }),
                        });
                        const d = await res.json();
                        if (!res.ok) throw new Error(d.error || "Failed");
                        setNewRawToken(d.raw);
                        toast.success("PAT created — copy it now");
                        void refreshAccess();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      } finally {
                        setAccessBusy(false);
                      }
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Generate PAT
                  </Button>
                </div>
                {newRawToken && (
                  <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-2 space-y-1">
                    <p className="text-[10px] font-medium text-orange-200">
                      Copy now — will not be shown again
                    </p>
                    <code className="block break-all text-[10px] font-mono text-foreground">
                      {newRawToken}
                    </code>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      npx shipboard link --url{" "}
                      {typeof window !== "undefined" ? window.location.origin : "https://shipboard.ca"}{" "}
                      --session &lt;id&gt; --token {newRawToken.slice(0, 16)}…
                    </p>
                  </div>
                )}
                <ul className="space-y-1 text-[11px]">
                  {pats.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded border border-border px-2 py-1.5"
                    >
                      <span className="font-mono truncate">
                        {t.prefix}… · {t.name}
                      </span>
                      <button
                        type="button"
                        className="text-red-400 text-[10px] hover:underline"
                        onClick={async () => {
                          await fetch(`/api/auth/tokens?id=${t.id}`, {
                            method: "DELETE",
                          });
                          void refreshAccess();
                        }}
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                  {!pats.length && (
                    <li className="text-muted-foreground">No active PATs</li>
                  )}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    Project ingest key (telemetry)
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={
                      !userInfo?.connected || accessBusy || !activeSessionId
                    }
                    onClick={async () => {
                      if (!activeSessionId) {
                        toast.error("Open a project first");
                        return;
                      }
                      setAccessBusy(true);
                      setNewRawIngest(null);
                      try {
                        const res = await fetch("/api/auth/ingest-keys", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            projectId: activeSessionId,
                            name: "Agent X-Ray",
                          }),
                        });
                        const d = await res.json();
                        if (!res.ok) throw new Error(d.error || "Failed");
                        setNewRawIngest(d.raw);
                        toast.success("Ingest key created — copy env vars");
                        void refreshAccess();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      } finally {
                        setAccessBusy(false);
                      }
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Generate ingest key
                  </Button>
                </div>
                {!activeSessionId && (
                  <p className="text-[10px] text-muted-foreground">
                    Open a studio project to bind an ingest key to that session id.
                  </p>
                )}
                {newRawIngest && activeSessionId && (
                  <div className="rounded-lg border border-emerald/40 bg-emerald/10 p-2 space-y-1">
                    <p className="text-[10px] font-medium text-emerald-200">
                      Ejected app .env.local
                    </p>
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all text-foreground">
{`SHIPBOARD_TELEMETRY_URL=${typeof window !== "undefined" ? window.location.origin : ""}/api/telemetry/events
SHIPBOARD_PROJECT_ID=${activeSessionId}
SHIPBOARD_INGEST_KEY=${newRawIngest}`}
                    </pre>
                  </div>
                )}
                <ul className="space-y-1 text-[11px]">
                  {ingestKeys.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between rounded border border-border px-2 py-1.5"
                    >
                      <span className="font-mono truncate text-[10px]">
                        {k.prefix}… · {k.projectId.slice(0, 8)}…
                      </span>
                      <button
                        type="button"
                        className="text-red-400 text-[10px] hover:underline"
                        onClick={async () => {
                          await fetch(`/api/auth/ingest-keys?id=${k.id}`, {
                            method: "DELETE",
                          });
                          void refreshAccess();
                        }}
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                  {!ingestKeys.length && (
                    <li className="text-muted-foreground">No active ingest keys</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ═══ Agents / Tool Bus Tab ═══ */}
          {activeTab === "agents" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                  Sovereign Tool Bus
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Database tools are auto-bound from your BYOB schema. Add custom tools for
                  HTTP, Stripe, or open data — they ship as{" "}
                  <code className="text-foreground/80">lib/agent/customTools.ts</code> +{" "}
                  <code className="text-foreground/80">app/api/chat/route.ts</code> (Vercel AI SDK).
                </p>
              </div>

              {local.byob?.schema?.tables?.length ? (
                <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-3 text-[11px]">
                  <p className="font-semibold text-foreground">
                    Auto DB tools · {local.byob.schema.tableCount} table(s)
                  </p>
                  <p className="mt-1 text-muted-foreground font-mono leading-relaxed">
                    list/get/create/update/delete per table via drizzle-zod schemas
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  Connect a database (Database tab) to unlock zero-config CRUD agent tools.
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Custom tools</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    const tools = [...(local.byob?.customTools || [])];
                    tools.push(emptyCustomTool());
                    setLocal({
                      ...local,
                      byob: { ...local.byob, schema: local.byob?.schema ?? null, customTools: tools },
                    });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add tool
                </Button>
              </div>

              {(local.byob?.customTools || []).length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No custom tools yet. Add one for weather, Stripe, scrapers, etc.
                </p>
              )}

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {(local.byob?.customTools || []).map((tool, idx) => (
                  <div
                    key={tool.id}
                    className="rounded-xl border border-border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={tool.name}
                        onChange={(e) => {
                          const tools = [...(local.byob?.customTools || [])];
                          tools[idx] = { ...tool, name: e.target.value };
                          setLocal({
                            ...local,
                            byob: {
                              ...local.byob,
                              schema: local.byob?.schema ?? null,
                              customTools: tools,
                            },
                          });
                        }}
                        placeholder="toolName"
                        className={cn(
                          "flex-1 bg-background border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-ring",
                          isValidToolName(tool.name) ? "border-border" : "border-red-500/60"
                        )}
                      />
                      <button
                        type="button"
                        title={tool.enabled ? "Enabled" : "Disabled"}
                        onClick={() => {
                          const tools = [...(local.byob?.customTools || [])];
                          tools[idx] = { ...tool, enabled: !tool.enabled };
                          setLocal({
                            ...local,
                            byob: {
                              ...local.byob,
                              schema: local.byob?.schema ?? null,
                              customTools: tools,
                            },
                          });
                        }}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded border",
                          tool.enabled
                            ? "border-emerald/40 text-emerald bg-emerald/10"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {tool.enabled ? "ON" : "OFF"}
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-muted-foreground hover:text-red-400"
                        onClick={() => {
                          const tools = (local.byob?.customTools || []).filter(
                            (_, i) => i !== idx
                          );
                          setLocal({
                            ...local,
                            byob: {
                              ...local.byob,
                              schema: local.byob?.schema ?? null,
                              customTools: tools,
                            },
                          });
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      value={tool.description}
                      onChange={(e) => {
                        const tools = [...(local.byob?.customTools || [])];
                        tools[idx] = { ...tool, description: e.target.value };
                        setLocal({
                          ...local,
                          byob: {
                            ...local.byob,
                            schema: local.byob?.schema ?? null,
                            customTools: tools,
                          },
                        });
                      }}
                      placeholder="Description for the agent"
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-ring"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Parameters
                        </span>
                        <button
                          type="button"
                          className="text-[10px] text-orange-400 hover:underline"
                          onClick={() => {
                            const tools = [...(local.byob?.customTools || [])];
                            const params = [
                              ...tool.parameters,
                              {
                                name: "arg",
                                type: "string" as CustomToolParamType,
                                required: true,
                              },
                            ];
                            tools[idx] = { ...tool, parameters: params };
                            setLocal({
                              ...local,
                              byob: {
                                ...local.byob,
                                schema: local.byob?.schema ?? null,
                                customTools: tools,
                              },
                            });
                          }}
                        >
                          + param
                        </button>
                      </div>
                      {tool.parameters.map((p, pi) => (
                        <div key={pi} className="flex gap-1 items-center">
                          <input
                            value={p.name}
                            onChange={(e) => {
                              const tools = [...(local.byob?.customTools || [])];
                              const parameters = [...tool.parameters];
                              parameters[pi] = { ...p, name: e.target.value };
                              tools[idx] = { ...tool, parameters };
                              setLocal({
                                ...local,
                                byob: {
                                  ...local.byob,
                                  schema: local.byob?.schema ?? null,
                                  customTools: tools,
                                },
                              });
                            }}
                            className="flex-1 bg-background border border-border rounded px-1.5 py-1 text-[10px] font-mono"
                            placeholder="name"
                          />
                          <select
                            value={p.type}
                            onChange={(e) => {
                              const tools = [...(local.byob?.customTools || [])];
                              const parameters = [...tool.parameters];
                              parameters[pi] = {
                                ...p,
                                type: e.target.value as CustomToolParamType,
                              };
                              tools[idx] = { ...tool, parameters };
                              setLocal({
                                ...local,
                                byob: {
                                  ...local.byob,
                                  schema: local.byob?.schema ?? null,
                                  customTools: tools,
                                },
                              });
                            }}
                            className="bg-background border border-border rounded px-1 py-1 text-[10px]"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                          </select>
                          <label className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <input
                              type="checkbox"
                              checked={p.required}
                              onChange={(e) => {
                                const tools = [...(local.byob?.customTools || [])];
                                const parameters = [...tool.parameters];
                                parameters[pi] = { ...p, required: e.target.checked };
                                tools[idx] = { ...tool, parameters };
                                setLocal({
                                  ...local,
                                  byob: {
                                    ...local.byob,
                                    schema: local.byob?.schema ?? null,
                                    customTools: tools,
                                  },
                                });
                              }}
                            />
                            req
                          </label>
                        </div>
                      ))}
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Execute body (receives <code className="text-foreground/70">args</code>)
                      </span>
                      <textarea
                        value={tool.executeBody}
                        onChange={(e) => {
                          const tools = [...(local.byob?.customTools || [])];
                          tools[idx] = { ...tool, executeBody: e.target.value };
                          setLocal({
                            ...local,
                            byob: {
                              ...local.byob,
                              schema: local.byob?.schema ?? null,
                              customTools: tools,
                            },
                          });
                        }}
                        rows={4}
                        className="mt-1 w-full bg-background border border-border rounded-lg px-2 py-1.5 text-[10px] font-mono outline-none focus:border-ring resize-y"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSettingsChange(local);
              onClose();
            }}
          >
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
