"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Copy,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Layers,
  ZoomIn,
  ZoomOut,
  Terminal,
  X,
} from "lucide-react"

interface CodeVersion {
  id: string
  code: string
  title: string
  timestamp: string
}

interface PreviewPanelProps {
  versions: CodeVersion[]
  activeVersionIndex: number
  onVersionChange: (index: number) => void
  isGenerating: boolean
}

type Tab = "preview" | "code"
type DeviceMode = "desktop" | "tablet" | "mobile"

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
}

const DEVICE_ICONS = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
}

function tokenize(code: string): React.ReactNode[] {
  const lines = code.split("\n")
  return lines.map((line, lineIdx) => {
    const tokens: React.ReactNode[] = []
    let remaining = line
    let keyIdx = 0

    const patterns: [RegExp, string][] = [
      [/^(import|export|default|from|const|let|var|function|return|if|else|for|while|class|extends|new|typeof|instanceof|void|null|undefined|true|false|async|await|type|interface|enum)\b/, "keyword"],
      [/^(\/\/.*)/, "comment"],
      [/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/, "string"],
      [/^(<\/?[A-Z][A-Za-z]*|<\/[a-z]+>|<[a-z]+)/, "tag"],
      [/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/, "function"],
      [/^([A-Za-z_$][A-Za-z0-9_$]*)/, "identifier"],
      [/^([^A-Za-z_$"'`/\n]+)/, "other"],
      [/^(.)/, "other"],
    ]

    while (remaining.length > 0) {
      let matched = false
      for (const [pattern, type] of patterns) {
        const m = remaining.match(pattern)
        if (m) {
          const colorMap: Record<string, string> = {
            keyword: "text-violet-400",
            comment: "text-zinc-500",
            string: "text-emerald-400",
            tag: "text-sky-400",
            function: "text-amber-300",
            identifier: "text-foreground",
            other: "text-muted-foreground",
          }
          const text = type === "function" ? m[1] : m[0]
          tokens.push(
            <span key={keyIdx++} className={colorMap[type] ?? "text-foreground"}>
              {text}
            </span>
          )
          if (type === "function") {
            tokens.push(
              <span key={keyIdx++} className="text-foreground">(</span>
            )
          }
          remaining = remaining.slice(m[0].length)
          matched = true
          break
        }
      }
      if (!matched) break
    }

    return (
      <div key={lineIdx} className="flex">
        <span className="select-none w-10 shrink-0 text-right pr-4 text-muted-foreground/40 text-xs leading-5 font-mono">
          {lineIdx + 1}
        </span>
        <span className="flex-1 leading-5 text-xs font-mono">{tokens}</span>
      </div>
    )
  })
}

function buildIframeContent(code: string): string {
  const cleaned = code
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '#0a0a0a',
            foreground: '#f2f2f2',
            card: '#141414',
            border: '#2a2a2a',
            muted: '#222222',
            'muted-foreground': '#6b6b6b',
            primary: '#f2f2f2',
            secondary: '#1e1e1e',
            accent: '#1e1e1e',
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0a0a0a; color: #f2f2f2; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 16px; min-height: 100vh; }
    * { box-sizing: border-box; }
  </style>
</head>
<body class="dark">
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback } = React;
    ${cleaned}
    const ComponentToRender = typeof Component !== 'undefined' ? Component :
      (typeof App !== 'undefined' ? App :
      (() => <div style={{color:'#f2f2f2',padding:'2rem',textAlign:'center'}}>Component rendered</div>));
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ComponentToRender));
  </script>
</body>
</html>`
}

export function PreviewPanel({
  versions,
  activeVersionIndex,
  onVersionChange,
  isGenerating,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("preview")
  const [copied, setCopied] = useState(false)
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")
  const [zoom, setZoom] = useState(100)
  const [showConsole, setShowConsole] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: string; message: string }>>([])

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 25, 200)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 25, 50)), [])
  const handleResetZoom = useCallback(() => setZoom(100), [])

  const activeVersion = versions[activeVersionIndex]

  const handleCopy = useCallback(async () => {
    if (!activeVersion) return
    await navigator.clipboard.writeText(activeVersion.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeVersion])

  if (versions.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background border-l border-border">
        <div className="text-center px-8">
          <div className="w-16 h-16 rounded-2xl border border-border bg-card flex items-center justify-center mx-auto mb-4">
            <Layers className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-medium mb-2">No preview yet</h3>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-[260px] mx-auto mb-4">
            Ask v0 to build something and the live preview will appear here.
          </p>
          <div className="flex flex-col gap-1.5">
            {["Build a login form", "Create a hero section", "Design a nav bar"].map((s) => (
              <div
                key={s}
                className="text-xs text-muted-foreground bg-card border border-border rounded-md px-3 py-1.5"
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
        {/* Tab switcher */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {(["preview", "code"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors",
                activeTab === tab
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "preview" ? (
                <Monitor className="w-3.5 h-3.5" />
              ) : (
                <Code2 className="w-3.5 h-3.5" />
              )}
              {tab === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>

        {/* Version navigation */}
        {versions.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
              disabled={activeVersionIndex === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums">
              v{activeVersionIndex + 1}/{versions.length}
            </span>
            <button
              onClick={() => onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))}
              disabled={activeVersionIndex === versions.length - 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Device modes (preview tab only) */}
        {activeTab === "preview" && (
          <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
            {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => {
              const Icon = DEVICE_ICONS[mode]
              return (
                <button
                  key={mode}
                  onClick={() => setDeviceMode(mode)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    deviceMode === mode
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              )
            })}
            </div>
          )}

          {/* Zoom controls (preview tab only) */}
          {activeTab === "preview" && (
            <div className="flex items-center gap-1 bg-muted rounded-lg px-1 py-0.5">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-0.5 text-xs font-mono tabular-nums hover:bg-accent rounded transition-colors min-w-[3rem] text-center"
                title="Reset zoom"
              >
                {zoom}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-1 ml-auto">
          {activeTab === "code" && (
            <button
              onClick={handleCopy}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Copy code"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={() => onVersionChange(activeVersionIndex)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Refresh preview"
          >
<RotateCcw className="w-3.5 h-3.5" />
              </button>
              {activeTab === "preview" && (
                <button
                  onClick={() => setShowConsole(!showConsole)}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-md transition-colors",
                    showConsole
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  title="Toggle console"
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

      {/* Version title bar */}
      {activeVersion && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground font-mono truncate max-w-60">
              {activeVersion.title}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground/50">
            {activeVersion.timestamp}
          </span>
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
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-foreground animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm">Generating preview...</p>
                </div>
              </div>
            ) : activeVersion ? (
              <div
                className="transition-transform duration-200 origin-top"
                style={{ transform: `scale(${zoom / 100})` }}
              >
                <iframe
                  key={activeVersion.id}
                  srcDoc={buildIframeContent(activeVersion.code)}
                  className="border border-border rounded-xl bg-background transition-[width] duration-200"
                  style={{ width: DEVICE_WIDTHS[deviceMode], minHeight: "500px", maxWidth: "100%" }}
                  sandbox="allow-scripts"
                  title="Component Preview"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="h-full overflow-auto bg-card p-4">
            {activeVersion && (
            <pre className="m-0 font-mono whitespace-pre">{tokenize(activeVersion.code)}</pre>
          )}
          </div>
        )}
        </div>

        {/* Console panel */}
        {showConsole && activeTab === "preview" && (
          <div className="h-40 border-t border-border bg-card shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Console</span>
                {consoleLogs.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded text-muted-foreground">
                    {consoleLogs.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setConsoleLogs([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-xs">
              {consoleLogs.length === 0 ? (
                <div className="text-muted-foreground/60 text-center py-4">
                  Console output will appear here
                </div>
              ) : (
                consoleLogs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      "py-0.5 px-1 rounded",
                      log.type === "error" && "text-red-400 bg-red-500/10",
                      log.type === "warn" && "text-amber-400 bg-amber-500/10",
                      log.type === "log" && "text-foreground"
                    )}
                  >
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
