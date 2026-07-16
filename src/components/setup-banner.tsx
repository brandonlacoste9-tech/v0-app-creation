"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";

type Health = {
  ok: boolean;
  config?: {
    aiReady?: boolean;
    database?: string;
    githubOAuth?: boolean;
    stripe?: boolean;
    aiServerKeys?: Record<string, boolean>;
  };
  hint?: string;
};

/**
 * Shows once when no server AI keys are configured (BYOK/Ollama still work).
 */
export function SetupBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("adgen_setup_dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: Health) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  if (dismissed || !health || health.config?.aiReady) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-50">AI keys not set on the server</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              {health.hint || "Add GROQ_API_KEY or XAI_API_KEY to .env.local, or paste a key in Settings."}{" "}
              Free plan: <strong>Groq</strong>, <strong>xAI Grok</strong>, or{" "}
              <strong>Ollama</strong> locally.
            </p>
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-300 hover:underline"
            >
              Get free Groq key <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-amber-200/70 hover:bg-amber-500/20 hover:text-amber-50"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            try {
              sessionStorage.setItem("adgen_setup_dismissed", "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
