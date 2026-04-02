"use client"

import { useState, useCallback } from "react"
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
            keyword: "oklch(0.72 0.15 260)",
            comment: "oklch(0.48 0 0)",
            string: "oklch(0.72 0.15 145)",
            tag: "oklch(0.72 0.15 200)",
            function: "oklch(0.80 0.12 50)",
            identifier: "var(--foreground)",
            other: "var(--muted-foreground)",
          }
          const text = type === "function" ? m[1] : m[0]
          tokens.push(
            <span key={keyIdx++} style={{ color: colorMap[type] ?? "var(--foreground)" }}>
              {text}
            </span>
          )
          if (type === "function") {
            tokens.push(
              <span key={keyIdx++} style={{ color: "var(--foreground)" }}>(</span>
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
      <div key={lineIdx} style={{ display: "flex" }}>
        <span
          style={{
            userSelect: "none",
            width: "40px",
            flexShrink: 0,
            textAlign: "right",
            paddingRight: "16px",
            color: "var(--muted-foreground)",
            opacity: 0.4,
            fontSize: "12px",
            lineHeight: "20px",
            fontFamily: "monospace",
          }}
        >
          {lineIdx + 1}
        </span>
        <span style={{ flex: 1, lineHeight: "20px", fontSize: "12px", fontFamily: "monospace" }}>
          {tokens}
        </span>
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

  const activeVersion = versions[activeVersionIndex]

  const handleCopy = useCallback(async () => {
    if (!activeVersion) return
    await navigator.clipboard.writeText(activeVersion.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeVersion])

  if (versions.length === 0 && !isGenerating) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              background: "var(--card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Layers style={{ width: "28px", height: "28px", color: "var(--muted-foreground)" }} />
          </div>
          <h3 style={{ color: "var(--foreground)", fontWeight: 500, marginBottom: "8px" }}>
            No preview yet
          </h3>
          <p
            style={{
              color: "var(--muted-foreground)",
              fontSize: "14px",
              lineHeight: 1.6,
              maxWidth: "260px",
              margin: "0 auto 16px",
            }}
          >
            Ask v0 to build something and the live preview will appear here.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {["Build a login form", "Create a hero section", "Design a nav bar"].map((s) => (
              <div
                key={s}
                style={{
                  fontSize: "12px",
                  color: "var(--muted-foreground)",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "6px 12px",
                }}
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--background)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--muted)",
            borderRadius: "8px",
            padding: "2px",
            gap: "2px",
          }}
        >
          {(["preview", "code"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                textTransform: "capitalize",
                background: activeTab === tab ? "var(--background)" : "transparent",
                color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                transition: "background 150ms, color 150ms",
              }}
            >
              {tab === "preview"
                ? <Monitor style={{ width: "14px", height: "14px" }} />
                : <Code2 style={{ width: "14px", height: "14px" }} />
              }
              {tab === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>

        {/* Version navigation */}
        {versions.length > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              color: "var(--muted-foreground)",
            }}
          >
            <button
              onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
              disabled={activeVersionIndex === 0}
              style={{
                padding: "4px",
                borderRadius: "4px",
                border: "none",
                background: "none",
                cursor: activeVersionIndex === 0 ? "not-allowed" : "pointer",
                color: "var(--muted-foreground)",
                opacity: activeVersionIndex === 0 ? 0.3 : 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronDown style={{ width: "14px", height: "14px" }} />
            </button>
            <span style={{ fontFamily: "monospace", tabularNums: true } as React.CSSProperties}>
              v{activeVersionIndex + 1}/{versions.length}
            </span>
            <button
              onClick={() => onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))}
              disabled={activeVersionIndex === versions.length - 1}
              style={{
                padding: "4px",
                borderRadius: "4px",
                border: "none",
                background: "none",
                cursor: activeVersionIndex === versions.length - 1 ? "not-allowed" : "pointer",
                color: "var(--muted-foreground)",
                opacity: activeVersionIndex === versions.length - 1 ? 0.3 : 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronUp style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
        )}

        {/* Device modes (preview tab only) */}
        {activeTab === "preview" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--muted)",
              borderRadius: "8px",
              padding: "2px",
              gap: "2px",
            }}
          >
            {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDeviceMode(mode)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  background: deviceMode === mode ? "var(--background)" : "transparent",
                  color: deviceMode === mode ? "var(--foreground)" : "var(--muted-foreground)",
                  transition: "background 150ms, color 150ms",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
          {activeTab === "code" && (
            <button
              onClick={handleCopy}
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--muted-foreground)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent)"
                e.currentTarget.style.color = "var(--foreground)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none"
                e.currentTarget.style.color = "var(--muted-foreground)"
              }}
            >
              {copied
                ? <Check style={{ width: "14px", height: "14px", color: "#22c55e" }} />
                : <Copy style={{ width: "14px", height: "14px" }} />
              }
            </button>
          )}
          <button
            onClick={() => onVersionChange(activeVersionIndex)}
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)"
              e.currentTarget.style.color = "var(--foreground)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none"
              e.currentTarget.style.color = "var(--muted-foreground)"
            }}
          >
            <RotateCcw style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </div>

      {/* Version title bar */}
      {activeVersion && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--card)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted-foreground)",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "240px",
              }}
            >
              {activeVersion.title}
            </span>
          </div>
          <span
            style={{
              fontSize: "11px",
              color: "var(--muted-foreground)",
              opacity: 0.5,
            }}
          >
            {activeVersion.timestamp}
          </span>
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "preview" ? (
          <div
            style={{
              height: "100%",
              background: "#111111",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              overflow: "auto",
              padding: "16px",
            }}
          >
            {isGenerating && !activeVersion ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  width: "100%",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "12px" }}
                  >
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--foreground)",
                          animation: "bounce 1s infinite",
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>
                    Generating preview...
                  </p>
                </div>
              </div>
            ) : activeVersion ? (
              <iframe
                key={activeVersion.id}
                srcDoc={buildIframeContent(activeVersion.code)}
                style={{
                  width: DEVICE_WIDTHS[deviceMode],
                  minHeight: "500px",
                  maxWidth: "100%",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "var(--background)",
                  transition: "width 200ms",
                }}
                sandbox="allow-scripts"
                title="Component Preview"
              />
            ) : null}
          </div>
        ) : (
          <div
            style={{
              height: "100%",
              overflow: "auto",
              background: "var(--card)",
              padding: "16px",
            }}
          >
            {activeVersion && (
              <pre style={{ margin: 0, fontFamily: "monospace", whiteSpace: "pre" }}>
                {tokenize(activeVersion.code)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
