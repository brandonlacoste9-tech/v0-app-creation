"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, ExternalLink, Check } from "lucide-react";

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
 * Shows setup status when AI or GitHub OAuth still needs configuration.
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

  if (dismissed || !health) return null;

  const aiReady = Boolean(health.config?.aiReady);
  const githubReady = Boolean(health.config?.githubOAuth);

  // Hide when fully ready
  if (aiReady && githubReady) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="font-medium text-amber-50">Setup checklist</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <StatusChip ok={aiReady} label="AI keys" />
              <StatusChip ok={githubReady} label="GitHub OAuth" />
              <StatusChip
                ok={health.config?.database === "postgres"}
                label={health.config?.database === "postgres" ? "Postgres" : "Memory DB"}
              />
            </div>
            {!aiReady && (
              <p className="mt-1.5 text-xs text-amber-100/80">
                {health.hint || "Add GROQ_API_KEY or XAI_API_KEY for cloud generation."}{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-amber-300 hover:underline"
                >
                  Groq <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            )}
            {aiReady && !githubReady && (
              <p className="mt-1.5 text-xs text-amber-100/80">
                Set <code className="rounded bg-black/20 px-1 font-mono">GITHUB_CLIENT_ID</code> +{" "}
                <code className="rounded bg-black/20 px-1 font-mono">GITHUB_CLIENT_SECRET</code>{" "}
                and match GitHub OAuth callback to{" "}
                <code className="rounded bg-black/20 px-1 font-mono text-[10px]">
                  {"{NEXT_PUBLIC_APP_URL}/api/github/callback"}
                </code>{" "}
                (exact host: www vs apex).
              </p>
            )}
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

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
        (ok
          ? "border-emerald/40 bg-emerald/15 text-emerald-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-100")
      }
    >
      {ok ? (
        <Check className="h-3 w-3" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      {label}
    </span>
  );
}
