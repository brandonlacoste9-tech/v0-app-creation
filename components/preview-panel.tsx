"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Monitor,
  Code2,
  Copy,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Layers,
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
            keyword: "text-[oklch(0.72_0.15_260)]",
            comment: "text-[oklch(0.48_0_0)]",
            string: "text-[oklch(0.72_0.15_145)]",
            tag: "text-[oklch(0.72_0.15_200)]",
            function: "text-[oklch(0.80_0.12_50)]",
            identifier: "text-[var(--foreground)]",
            other: "text-[var(--muted-foreground)]",
          }
          tokens.push(
            <span key={keyIdx++} className={colorMap[type] ?? "text-[var(--foreground)]"}>
              {type === "function" ? m[1] : m[0]}
            </span>
          )
          if (type === "function") {
            tokens.push(<span key={keyIdx++} className="text-[var(--foreground)]">(</span>)
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
        <span className="select-none w-10 shrink-0 text-right pr-4 text-[var(--muted-foreground)] opacity-40 text-xs leading-5">
          {lineIdx + 1}
        </span>
        <span className="flex-1 leading-5 text-xs">{tokens}</span>
      </div>
    )
  })
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

  const activeVersion = versions[activeVersionIndex]

  const handleCopy = useCallback(async () => {
    if (!activeVersion) return
    await navigator.clipboard.writeText(activeVersion.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeVersion])

  const buildIframeContent = (code: string): string => {
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

  if (versions.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[var(--background)] border-l border-[var(--border)]">
        <div className="text-center space-y-3 px-8">
          <div className="w-16 h-16 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-[var(--foreground)] font-medium">No preview yet</h3>
          <p className="text-[var(--muted-foreground)] text-sm text-pretty leading-relaxed max-w-xs">
            Ask v0 to build something and the preview will appear here.
          </p>
          <div className="pt-2 space-y-1.5">
            {["Build a login form", "Create a hero section", "Design a nav bar"].map((s) => (
              <div key={s} className="text-xs text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-1.5">
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--background)] border-l border-[var(--border)]">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0 gap-2 flex-wrap">
        {/* Tab switcher */}
        <div className="flex items-center bg-[var(--muted)] rounded-lg p-0.5 gap-0.5">
          {(["preview", "code"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                activeTab === tab
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {tab === "preview" ? <Monitor className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
              {tab === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>

        {/* Version selector */}
        {versions.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <button
              onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
              disabled={activeVersionIndex === 0}
              className="p-1 rounded hover:bg-[var(--accent)] disabled:opacity-30"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums">
              v{activeVersionIndex + 1}/{versions.length}
            </span>
            <button
              onClick={() => onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))}
              disabled={activeVersionIndex === versions.length - 1}
              className="p-1 rounded hover:bg-[var(--accent)] disabled:opacity-30"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Device mode (preview only) */}
        {activeTab === "preview" && (
          <div className="flex items-center bg-[var(--muted)] rounded-lg p-0.5 gap-0.5">
            {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDeviceMode(mode)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs transition-colors capitalize",
                  deviceMode === mode
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          {activeTab === "code" && (
            <button
              onClick={handleCopy}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-green-500" />
                : <Copy className="w-3.5 h-3.5" />
              }
            </button>
          )}
          <button
            onClick={() => onVersionChange(activeVersionIndex)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Version title bar */}
      {activeVersion && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-[var(--muted-foreground)] font-mono truncate max-w-xs">
              {activeVersion.title}
            </span>
          </div>
          <span className="text-xs text-[var(--muted-foreground)] opacity-50">{activeVersion.timestamp}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" ? (
          <div className="h-full bg-[#111] flex items-start justify-center overflow-auto p-4">
            {isGenerating && !activeVersion ? (
              <div className="flex items-center justify-center h-full w-full">
                <div className="text-center space-y-3">
                  <div className="flex gap-1.5 justify-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-[var(--foreground)] animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-[var(--muted-foreground)] text-sm">Generating preview...</p>
                </div>
              </div>
            ) : activeVersion ? (
              <iframe
                key={activeVersion.id}
                srcDoc={buildIframeContent(activeVersion.code)}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl transition-all duration-200"
                style={{
                  width: DEVICE_WIDTHS[deviceMode],
                  minHeight: "500px",
                  maxWidth: "100%",
                }}
                sandbox="allow-scripts"
                title="Component Preview"
              />
            ) : null}
          </div>
        ) : (
          <div className="h-full overflow-auto bg-[var(--card)] p-4">
            {activeVersion && (
              <pre className="font-mono text-xs leading-5 whitespace-pre">
                {tokenize(activeVersion.code)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
