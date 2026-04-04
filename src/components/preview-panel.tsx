"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Box,
  Split,
  Terminal as TerminalIcon,
  Hash,
  Columns,
  Command,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { TerminalLogs } from "@/components/terminal-logs";
import { LayoutPanelLeft } from "lucide-react";

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
  onShareToCodeSandbox?: () => void;
  previewTheme: string;
  onPreviewThemeChange: (themeId: string) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  userInfo?: UserInfo | null;
  onUpgrade?: () => void;
  initialTab?: "preview" | "code";
}

function wrapCode(code: string, theme: PreviewTheme, mockData: string = '{}'): string {
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
    body { background: ${theme.bg}; color: ${theme.fg}; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 0; min-height: 100vh; }
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
    const MOCK_DATA = ${mockData};
    try {
      ${cleaned}
      const ComponentToRender = typeof Component !== 'undefined' ? Component :
        (typeof App !== 'undefined' ? App :
        (() => React.createElement('div', {style:{color:'${theme.fg}',padding:'2rem',textAlign:'center'}}, 'Component rendered')));
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ComponentToRender, MOCK_DATA));
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
  onShareToCodeSandbox,
  previewTheme,
  onPreviewThemeChange,
  fullscreen = false,
  onToggleFullscreen,
  userInfo,
  onUpgrade,
  initialTab,
}: PreviewPanelProps) {
  const [isDuelView, setIsDuelView] = useState(false);
  const nextVersionCode = useMemo(() => {
    if (isGenerating) return "Generating evolution...";
    if (versions.length > 1) return versions[versions.length - 2].code;
    return null;
  }, [isGenerating, versions]);

  const activeVersion = versions[activeVersionIndex];
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "preview");
  const [copied, setCopied] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [zoom, setZoom] = useState(100);
  const [iframeKey, setIframeKey] = useState(0);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [editCode, setEditCode] = useState(activeVersion?.code || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isDevCenterOpen, setIsDevCenterOpen] = useState(false);
  const [mockProps, setMockProps] = useState('{\n  "title": "Welcome to AdGenAI",\n  "status": "Online"\n}');
  
  const [prevVersionId, setPrevVersionId] = useState(activeVersion?.id);
  if (activeVersion?.id !== prevVersionId) {
    setPrevVersionId(activeVersion?.id);
    if (!isEditing) {
      setEditCode(activeVersion?.code || "");
    }
  }

  const editRef = useRef<HTMLTextAreaElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

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

  const currentTheme = PREVIEW_THEMES.find((t) => t.id === previewTheme) ?? PREVIEW_THEMES[0];

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 25, 200)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 25, 50)), []);
  const handleResetZoom = useCallback(() => setZoom(100), []);

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
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap", fullscreen && "bg-background/90 backdrop-blur-sm")}>
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
          <div className="w-px h-4 bg-border/50 mx-0.5" />
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
              showTerminal
                ? "bg-emerald text-primary-foreground shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            )}
            title="Toggle Engine Terminal"
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Terminal
          </button>

          <button
            onClick={() => userInfo?.plan === 'pro' ? setIsDevCenterOpen(!isDevCenterOpen) : onUpgrade?.()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all relative",
              isDevCenterOpen
                ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            )}
            title="Developer Control Center"
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" />
            Dev Center
            {userInfo?.plan !== 'pro' && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </button>
        </div>

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
            <div className="w-px h-4 bg-border/50 mx-1" />
            <button
              onClick={() => setIsCompareMode(!isCompareMode)}
              disabled={versions.length < 2}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                isCompareMode
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
              )}
              title="Compare with previous version"
            >
              <Split className="w-3 h-3" />
              UI Duel
            </button>
          </div>
        )}

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

            <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg px-1 py-0.5">
              <button onClick={handleZoomOut} disabled={zoom <= 50} className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleResetZoom} className="px-2 py-0.5 text-xs font-mono tabular-nums hover:bg-accent rounded transition-colors min-w-12 text-center">
                {zoom}%
              </button>
              <button onClick={handleZoomIn} disabled={zoom >= 200} className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

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
          {activeVersion && onShareToCodeSandbox && (
            <button
              onClick={userInfo?.plan === "free" && userInfo?.connected ? onUpgrade : onShareToCodeSandbox}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium"
              title={userInfo?.plan === "free" && userInfo?.connected ? "Pro feature — click to upgrade" : "Open in CodeSandbox"}
            >
              <Box className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sandbox</span>
              {userInfo?.plan === "free" && userInfo?.connected && (
                <span className="text-[9px] bg-emerald/20 text-emerald px-1 rounded ml-0.5">PRO</span>
              )}
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
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1 bg-accent/50 rounded-md px-1 py-0.5">
            <button onClick={handleZoomOut} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors" title="Zoom Out"><ZoomOut className="w-3 h-3" /></button>
            <button onClick={handleResetZoom} className="px-1.5 min-w-[32px] text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors text-center">{zoom}%</button>
            <button onClick={handleZoomIn} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors" title="Zoom In"><ZoomIn className="w-3 h-3" /></button>
          </div>
          <div className="w-px h-4 bg-border mx-1" />
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

       {activeVersion && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isGenerating ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            )} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {isGenerating ? "Synthesizing" : activeVersionIndex === versions.length - 1 ? "Stable Branch" : "Legacy Version"}
            </span>
            <div className="w-px h-3 bg-border mx-1" />
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

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative">
        {activeTab === "preview" ? (
          <div className="h-full bg-zinc-900 flex items-start justify-center overflow-hidden">
            {isGenerating && !activeVersion ? (
              <div className="flex items-center justify-center h-full w-full bg-background">
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
                <div className="relative w-full h-full group/preview transition-all duration-300 flex gap-4">
                  <div className={cn(
                    "relative flex-1 transition-all duration-500 ease-in-out",
                    isCompareMode ? "flex-[0.5]" : "flex-1"
                  )}>
                    {isCompareMode && (
                      <div className="absolute -top-6 left-0 text-[10px] font-bold text-emerald uppercase tracking-widest bg-emerald/10 px-2 py-0.5 rounded border border-emerald/20 z-20">
                        Current (v{activeVersionIndex + 1})
                      </div>
                    )}
                      <iframe
                        key={`${activeVersion.id}-${iframeKey}-${previewTheme}-${mockProps}`}
                        srcDoc={wrapCode(activeVersion.code, currentTheme, mockProps)}
                        className="w-full h-full border border-border rounded-xl bg-background shadow-2xl transition-all duration-300"
                        style={{ 
                          width: isCompareMode ? "100%" : DEVICE_WIDTHS[deviceMode], 
                          height: deviceMode === "desktop" ? "100%" : "calc(100vh - 120px)",
                          minHeight: deviceMode === "desktop" ? "100%" : "800px",
                          maxWidth: "100%" 
                        }}
                        sandbox="allow-scripts"
                        title="Component Preview A"
                      />
                    </div>
  
                    {isCompareMode && versions[activeVersionIndex - 1] && (
                      <div className="relative flex-[0.5] transition-all duration-500 ease-in-out">
                        <div className="absolute -top-6 left-0 text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 z-20">
                          Previous (v{activeVersionIndex})
                        </div>
                        <iframe
                          key={`${versions[activeVersionIndex - 1].id}-${iframeKey}-${previewTheme}-${mockProps}`}
                          srcDoc={wrapCode(versions[activeVersionIndex - 1].code, currentTheme, mockProps)}

                        className="w-full h-full border border-border/50 rounded-xl bg-background/80 shadow-2xl opacity-80"
                        style={{ width: "100%", height: "100%" }}
                        sandbox="allow-scripts"
                        title="Component Preview B"
                      />
                    </div>
                  )}

                  {!isCompareMode && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/preview:opacity-100 transition-all duration-300 flex items-center gap-1 p-1 bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl pointer-events-auto hover:scale-105 active:scale-100">
                      <button 
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied" : "Copy TSX"}
                      </button>
                      <div className="flex items-center gap-1.5 ml-auto border-l border-border pl-3">
                        <button
                          onClick={() => {
                            if (userInfo?.plan === 'pro') {
                              setIsDuelView(!isDuelView);
                            } else {
                              onUpgrade?.();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all group relative",
                            isDuelView 
                              ? "bg-emerald/10 text-emerald border border-emerald/20" 
                              : "text-muted-foreground hover:bg-accent border border-transparent"
                          )}
                        >
                          <Columns className="w-3.5 h-3.5" />
                          {userInfo?.plan !== 'pro' && (
                            <span className="ml-1 px-1 py-0.5 rounded-[4px] bg-emerald text-[8px] font-bold text-emerald-foreground leading-none">PRO</span>
                          )}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-popover border border-border text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl font-mono uppercase tracking-tighter">
                            Compare Versions Side-by-Side
                          </div>
                        </button>
                      </div>
                      <div className="w-px h-4 bg-border mx-1" />
                      {onDownloadHtml && (
                        <button 
                          onClick={onDownloadHtml}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          HTML
                        </button>
                      )}
                      {onDownloadZip && (
                        <button 
                          onClick={onDownloadZip}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          ZIP
                        </button>
                      )}
                    </div>
                  )}
                </div>
            ) : null}
            
            {/* Visual Duel Overlay (PRO Feature) */}
            {isDuelView && nextVersionCode && (
              <div className="flex flex-col border-l border-border bg-black/40 backdrop-blur-3xl animate-in slide-in-from-right-full duration-500 overflow-hidden w-full lg:w-1/2">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald font-mono">Comparing Generation</span>
                  </div>
                  <button onClick={() => setIsDuelView(false)} className="text-muted-foreground hover:text-foreground">
                    <Hash className="w-3 h-3 hover:rotate-90 transition-transform" />
                  </button>
                </div>
                <div className="flex-1 p-2 bg-[#080808]">
                  <div className="h-full rounded-xl border border-white/5 overflow-hidden shadow-2xl relative group bg-white/5">
                    <iframe
                      srcDoc={wrapCode(nextVersionCode, currentTheme, mockProps)}
                      className="w-full h-full border-0 pointer-events-none"
                      title="Duel Preview"
                    />
                    <div className="absolute inset-0 bg-transparent" />
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono border border-white/10 uppercase">v{activeVersionIndex > 0 ? activeVersionIndex : "P"} - 1</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Developer Control Center (PRO Feature) */}
            {isDevCenterOpen && (
              <div className="flex flex-col border-l border-border bg-[#0a0a0a] animate-in slide-in-from-right-full duration-500 overflow-hidden w-full lg:w-1/3">
                <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Command className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white">Dev Center</span>
                  </div>
                  <button onClick={() => setIsDevCenterOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <Hash className="w-4 h-4 hover:rotate-90 transition-transform" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* CLI Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">CLI Quick-Pull</h4>
                      <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">STABLE</span>
                    </div>
                    <div className="bg-black rounded-lg border border-white/5 p-3 relative group">
                      <code className="text-[10px] text-zinc-400 font-mono">
                        npx adgen pull {activeVersion?.id.slice(0, 8) || "latest"}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`npx adgen pull ${activeVersion?.id.slice(0, 8) || "latest"}`);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-zinc-500">Pull this component directly into your local Next.js project with styling preserved.</p>
                  </div>

                  {/* Prop Section */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Mock State (Live)</h4>
                    <div className="bg-black rounded-lg border border-emerald-500/10 overflow-hidden shadow-inner">
                       <textarea 
                          value={mockProps}
                          onChange={(e) => setMockProps(e.target.value)}
                          className="w-full h-40 bg-transparent p-3 text-[10px] font-mono text-emerald-500/80 outline-none resize-none selection:bg-emerald-500/20"
                       />
                    </div>
                    <p className="text-[9px] text-zinc-500 italic">Component will re-render in real-time with these props injected.</p>
                  </div>

                  {/* Context Section */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Environment Meta</h4>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">Framework</span>
                          <span className="text-[10px] text-zinc-300">Next.js 15.0</span>
                       </div>
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">CSS Engine</span>
                          <span className="text-[10px] text-zinc-300">Tailwind 4.0</span>
                       </div>
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">Runtime</span>
                          <span className="text-[10px] text-zinc-300">Node v20</span>
                       </div>
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">IDX Sync</span>
                          <span className="text-[10px] text-emerald-500">Active</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              onChange={(e) => {
                setEditCode(e.target.value);
                setIsEditing(true);
              }}
              onBlur={() => setIsEditing(false)}
              className="flex-1 w-full bg-card p-4 text-xs font-mono text-foreground outline-none resize-none leading-5"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>

    {/* Terminal Overlay (Bottom) */}
    {showTerminal && (
      <div className="h-[200px] border-t border-border shrink-0 animate-in slide-in-from-bottom duration-300">
        <TerminalLogs isGenerating={isGenerating} />
      </div>
    )}
  </div>
);
}
