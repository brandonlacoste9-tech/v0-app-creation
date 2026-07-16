"use client";

import { useState } from "react";
import { Check, Copy, FileCode, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeArtifactProps {
  code: string;
  language?: string;
  fileName?: string;
  defaultCollapsed?: boolean;
}

/** In-chat code card: filename, lang, copy, collapsible body. */
export function CodeArtifact({
  code,
  language = "tsx",
  fileName,
  defaultCollapsed = false,
}: CodeArtifactProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const lines = code.split("\n").length;
  const displayLang = language.replace(/^file=.*/, "tsx") || "tsx";
  // Parse ```tsx file="src/Hero.tsx" style header if embedded in language string
  const fileMatch = language.match(/file=["']([^"']+)["']/i);
  const name = fileName || fileMatch?.[1] || (displayLang ? `snippet.${displayLang}` : "code");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <FileCode className="h-3.5 w-3.5 shrink-0 text-orange-400/90" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-foreground">
          {name}
        </span>
        <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
          {displayLang.split(/\s/)[0] || "code"}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
          {lines} lines
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "rounded p-1 transition-colors",
            copied ? "text-emerald" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed">
          <code className="font-mono text-foreground/90">{code}</code>
        </pre>
      )}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-full px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          Show {lines} lines…
        </button>
      )}
    </div>
  );
}
