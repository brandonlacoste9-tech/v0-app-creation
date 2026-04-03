"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { CodeVersion } from "@/lib/types";
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
  Sun,
  Moon,
  Pencil,
  Eye,
  Rocket,
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
}

function buildIframeContent(code: string, darkMode: boolean): string {
  const cleaned = code
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  const bg = darkMode ? "#0a0a0a" : "#ffffff";
  const fg = darkMode ? "#f2f2f2" : "#0a0a0a";
  const darkClass = darkMode ? "dark" : "";

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
            background: '${bg}',
            foreground: '${fg}',
            card: '${darkMode ? "#141414" : "#f5f5f5"}',
            border: '${darkMode ? "#2a2a2a" : "#e5e5e5"}',
            muted: '${darkMode ? "#222222" : "#f0f0f0"}',
            'muted-foreground': '${darkMode ? "#6b6b6b" : "#737373"}',
            primary: '${fg}',
            secondary: '${darkMode ? "#1e1e1e" : "#f0f0f0"}',
            accent: '${darkMode ? "#1e1e1e" : "#f0f0f0"}',
          }
        }
      }
    }
  <\/script>
  <style>
    body { background: ${bg}; color: ${fg}; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 16px; min-height: 100vh; }
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
        (() => React.createElement('div', {style:{color:'${fg}',padding:'2rem',textAlign:'center'}}, 'Component rendered')));
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
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [zoom, setZoom] = useState(100);
  const [iframeKey, setIframeKey] = useState(0);
  const [previewDark, setPreviewDark] = useState(true);
  const [editCode, setEditCode] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

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
      <div className="flex flex-col h-full items-center justify-center bg-background border-l border-border">
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
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
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

        {/* Device mode (preview only) */}
        {activeTab === "preview" && (
          <>
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
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

            {/* Zoom */}
            <div className="flex items-center gap-1 bg-muted rounded-lg px-1 py-0.5">
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

            {/* Preview theme toggle */}
            <button
              onClick={() => { setPreviewDark(!previewDark); setIframeKey((k) => k + 1); }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={previewDark ? "Light preview" : "Dark preview"}
            >
              {previewDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
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
            <button onClick={onDownloadHtml} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download HTML">
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
            <button onClick={onDeploy} className="h-7 flex items-center gap-1.5 px-2.5 rounded-md bg-emerald text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity" title="Deploy to Vercel">
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Deploy</span>
            </button>
          )}
          <button onClick={handleRefresh} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Refresh">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
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
                  key={`${activeVersion.id}-${iframeKey}-${previewDark}`}
                  srcDoc={buildIframeContent(activeVersion.code, previewDark)}
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
              <pre className="m-0 font-mono whitespace-pre">{tokenize(activeVersion.code)}</pre>
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
