"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { CodeVersion, PreviewTheme, UserInfo } from "@/lib/types";
import { PREVIEW_THEMES } from "@/lib/types";
import {
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Copy,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  ZoomIn,
  ZoomOut,
  Download,
  FileCode,
  Pencil,
  Eye,
  Rocket,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";

type Tab = "preview" | "code" | "edit";
type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

interface PreviewPanelProps {
  versions: CodeVersion[];
  activeVersionIndex: number;
  onVersionChange: (index: number) => void;
  isGenerating: boolean;
  onPushToGitHub?: () => void;
  onDeploy?: () => void;
  onDownloadZip?: () => void;
  onDownloadHtml?: () => void;
  onCodeEdit?: (versionId: string, code: string) => void;
  onRestoreVersion?: (index: number) => void;
  previewTheme: string;
  onPreviewThemeChange: (themeId: string) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  userInfo?: UserInfo | null;
  onUpgrade?: () => void;
  initialTab?: "preview" | "code";
}

function buildIframeContent(code: string, theme: PreviewTheme): string {
  const cleaned = code
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  const darkClass = theme.mode === "dark" ? "dark" : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '${theme.bg}',
            foreground: '${theme.fg}',
            card: '${theme.card}',
            border: '${theme.cardBorder}',
            muted: '${theme.muted}',
            'muted-foreground': '${theme.mutedFg}',
            primary: '${theme.accent}',
            secondary: '${theme.muted}',
            accent: '${theme.muted}',
          }
        }
      }
    }
  <\/script>
  <style>
    body { background: ${theme.bg}; color: ${theme.fg}; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 16px; min-height: 100vh; }
    * { box-sizing: border-box; }
  </style>
</head>
<body class="${darkClass}">
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, createContext, useContext } = React;
    try {
      ${cleaned}
      const ComponentToRender = typeof Component !== 'undefined' ? Component :
        (typeof App !== 'undefined' ? App :
        (() => React.createElement('div', {style:{color:'${theme.fg}',padding:'2rem',textAlign:'center'}}, 'Component rendered')));
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ComponentToRender));
    } catch(e) {
      document.getElementById('root').innerHTML = '<pre style="color:#ef4444;padding:1rem;font-size:12px;white-space:pre-wrap;">Error: ' + e.message + '</pre>';
    }
  <\/script>
</body>
</html>`;
}

function tokenize(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, lineIdx) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let keyIdx = 0;

    const patterns: [RegExp, string][] = [
      [/^(import|export|default|from|const|let|var|function|return|if|else|for|while|class|extends|new|typeof|instanceof|void|null|undefined|true|false|async|await|type|interface|enum)\b/, "token-keyword"],
      [/^(\/\/.*)/, "token-comment"],
      [/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/, "token-string"],
      [/^(<\/?[A-Z][A-Za-z]*|<\/[a-z]+>|<[a-z]+)/, "token-tag"],
      [/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/, "token-function"],
      [/^(\d+\.?\d*)/, "token-number"],
      [/^([A-Za-z_$][A-Za-z0-9_$]*)/, "text-foreground"],
      [/^([^A-Za-z_$"'`/\n\d]+)/, "text-muted-foreground"],
      [/^(.)/, "text-muted-foreground"],
    ];

    while (remaining.length > 0) {
      let matched = false;
      for (const [pattern, cls] of patterns) {
        const m = remaining.match(pattern);
        if (m) {
          const text = cls === "token-function" ? m[1] : m[0];
          tokens.push(<span key={keyIdx++} className={cls}>{text}</span>);
          if (cls === "token-function") {
            tokens.push(<span key={keyIdx++} className="text-foreground">(</span>);
          }
          remaining = remaining.slice(m[0].length);
          matched = true;
          break;
        }
      }
      if (!matched) break;
    }

    return (
      <div key={lineIdx} className="flex">
        <span className="select-none w-10 shrink-0 text-right pr-4 text-muted-foreground/40 text-xs leading-5 font-mono">
          {lineIdx + 1}
        </span>
        <span className="flex-1 leading-5 text-xs font-mono">{tokens}</span>
      </div>
    );
  });
}

export function PreviewPanel({
  versions,
  activeVersionIndex,
  onVersionChange,
  isGenerating,
  onPushToGitHub,
  onDeploy,
  onDownloadZip,
  onDownloadHtml,
  onCodeEdit,
  onRestoreVersion,
  previewTheme,
  onPreviewThemeChange,
  fullscreen = false,
  onToggleFullscreen,
  userInfo,
  onUpgrade,
  initialTab,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "preview");
  const [copied, setCopied] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [zoom, setZoom] = useState(100);
  const [iframeKey, setIframeKey] = useState(0);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [editCode, setEditCode] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Sync tab from parent (mobile tab switching)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const currentTheme = PREVIEW_THEMES.find((t) => t.id === previewTheme) ?? PREVIEW_THEMES[0];

  // Close theme dropdown on outside click
  useEffect(() => {
    if (!themeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [themeDropdownOpen]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 25, 200)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 25, 50)), []);
  const handleResetZoom = useCallback(() => setZoom(100), []);

  const activeVersion = versions[activeVersionIndex];

  // Sync edit code when version changes
  useEffect(() => {
    if (activeVersion) setEditCode(activeVersion.code);
  }, [activeVersion?.id]);

  const handleCopy = useCallback(async () => {
    if (!activeVersion) return;
    await navigator.clipboard.writeText(activeVersion.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeVersion]);

  const handleRefresh = useCallback(() => setIframeKey((k) => k + 1), []);

  const handleApplyEdit = useCallback(() => {
    if (activeVersion && onCodeEdit && editCode !== activeVersion.code) {
      onCodeEdit(activeVersion.id, editCode);
      setIframeKey((k) => k + 1);
    }
    setActiveTab("preview");
  }, [activeVersion, editCode, onCodeEdit]);

  if (versions.length === 0 && !isGenerating) {
    return (
      <div className={cn("flex flex-col h-full items-center justify-center bg-background", !fullscreen && "border-l border-border")}>
        <div className="text-center px-8">
          <div className="w-16 h-16 rounded-2xl border border-border bg-card flex items-center justify-center mx-auto mb-4">
            <Layers className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-medium mb-2">No preview yet</h3>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-[260px] mx-auto">
            Ask AdGenAI to build something and the live preview will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-background", fullscreen ? "h-screen" : "h-full border-l border-border")}>
      {/* Toolbar */}
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap", fullscreen && "bg-background/90 backdrop-blur-sm")}>
        {/* Tab switcher */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {([
            { key: "preview" as Tab, icon: Eye, label: "Preview" },
            { key: "code" as Tab, icon: Code2, label: activeVersion ? `Code (${activeVersion.code.split("\n").length} lines)` : "Code" },
            { key: "edit" as Tab, icon: Pencil, label: "Edit" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeTab === key
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Version selector */}
        {versions.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
              disabled={activeVersionIndex === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums">
              v{activeVersionIndex + 1}/{versions.length}
            </span>
            <button
              onClick={() => onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))}
              disabled={activeVersionIndex === versions.length - 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Device mode (preview only, hidden on mobile) */}
        {activeTab === "preview" && (
          <>
            <div className="hidden md:flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              {([
                { mode: "desktop" as DeviceMode, icon: Monitor },
                { mode: "tablet" as DeviceMode, icon: Tablet },
                { mode: "mobile" as DeviceMode, icon: Smartphone },
              ]).map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setDeviceMode(mode)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    deviceMode === mode ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={mode}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            {/* Zoom (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg px-1 py-0.5">
              <button onClick={handleZoomOut} disabled={zoom <= 50} className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleResetZoom} className="px-2 py-0.5 text-xs font-mono tabular-nums hover:bg-accent rounded transition-colors min-w-[3rem] text-center">
                {zoom}%
              </button>
              <button onClick={handleZoomIn} disabled={zoom >= 200} className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Preview theme selector */}
            <div className="relative" ref={themeDropdownRef}>
              <button
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs"
                title="Preview theme"
              >
                <span
                  className="w-3 h-3 rounded-full border border-border shrink-0"
                  style={{ background: currentTheme.bg }}
                />
                <span className="hidden sm:inline">{currentTheme.name}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {themeDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10 py-1 overflow-hidden">
                  {PREVIEW_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onPreviewThemeChange(t.id);
                        setIframeKey((k) => k + 1);
                        setThemeDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors text-left",
                        t.id === previewTheme
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-border shrink-0"
                        style={{ background: t.bg }}
                      />
                      <span className="flex-1">{t.name}</span>
                      {t.id === previewTheme && <Check className="w-3 h-3 text-foreground" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          {activeTab === "code" && (
            <button onClick={handleCopy} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Copy code">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {activeTab === "edit" && (
            <button onClick={handleApplyEdit} className="h-7 flex items-center gap-1.5 px-2.5 rounded-md bg-emerald text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <Check className="w-3.5 h-3.5" />
              Apply
            </button>
          )}
          {activeVersion && onDownloadHtml && (
            <button onClick={onDownloadHtml} className="hidden md:flex w-7 h-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download HTML">
              <FileCode className="w-3.5 h-3.5" />
            </button>
          )}
          {activeVersion && onDownloadZip && (
            <button onClick={onDownloadZip} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download ZIP">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {activeVersion && onPushToGitHub && (
            <button onClick={onPushToGitHub} className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium" title="Push to GitHub">
              <GithubIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Push</span>
            </button>
          )}
          {activeVersion && onDeploy && (
            <button
              onClick={userInfo?.plan === "free" && userInfo?.connected ? onUpgrade : onDeploy}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md bg-emerald text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              title={userInfo?.plan === "free" && userInfo?.connected ? "Pro feature — click to upgrade" : "Deploy to Vercel"}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Deploy</span>
              {userInfo?.plan === "free" && userInfo?.connected && (
                <span className="text-[9px] bg-primary-foreground/20 px-1 rounded">PRO</span>
              )}
            </button>
          )}
          <button onClick={handleRefresh} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Refresh">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Version title bar */}
      {activeVersion && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
            <span className="text-xs text-muted-foreground font-mono truncate max-w-60">
              {activeVersion.title}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(activeVersion.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {onRestoreVersion && activeVersionIndex < versions.length - 1 && (
            <button
              onClick={() => onRestoreVersion(activeVersionIndex)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restore
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" ? (
          <div className="h-full bg-zinc-900 flex items-start justify-center overflow-auto p-4">
            {isGenerating && !activeVersion ? (
              <div className="flex items-center justify-center h-full w-full">
                <div className="text-center">
                  <div className="flex gap-1.5 justify-center mb-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm">Generating preview...</p>
                </div>
              </div>
            ) : activeVersion ? (
              <div className="transition-transform duration-200 origin-top" style={{ transform: `scale(${zoom / 100})` }}>
                <iframe
                  key={`${activeVersion.id}-${iframeKey}-${previewTheme}`}
                  srcDoc={buildIframeContent(activeVersion.code, currentTheme)}
                  className="border border-border rounded-xl bg-background transition-[width] duration-200"
                  style={{ width: DEVICE_WIDTHS[deviceMode], minHeight: "500px", maxWidth: "100%" }}
                  sandbox="allow-scripts"
                  title="Component Preview"
                />
              </div>
            ) : null}
          </div>
        ) : activeTab === "code" ? (
          <div className="h-full overflow-auto bg-card p-4">
            {activeVersion && (
              <pre className="m-0 font-mono whitespace-pre overflow-x-auto">{tokenize(activeVersion.code)}</pre>
            )}
          </div>
        ) : (
          /* Edit tab */
          <div className="h-full flex flex-col">
            <textarea
              ref={editRef}
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              className="flex-1 w-full bg-card p-4 text-xs font-mono text-foreground outline-none resize-none leading-5"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
