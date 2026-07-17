"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decodeSharePayload } from "@/lib/share";
import { stashRemixPayload } from "@/lib/remix";
import { wrapCodeForPreview } from "@/lib/preview-html";
import { PREVIEW_THEMES } from "@/lib/types";
import {
  Zap,
  ArrowLeft,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  Code2,
} from "lucide-react";

export default function SharePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<ReturnType<typeof decodeSharePayload>>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(window.location.search);
    const encoded = hash || params.get("c") || params.get("code") || "";
    setPayload(decodeSharePayload(encoded));
    setReady(true);
  }, []);

  const theme =
    PREVIEW_THEMES.find((t) => t.id === payload?.theme) ?? PREVIEW_THEMES[0];

  const srcDoc = useMemo(() => {
    if (!payload?.code) return "";
    return wrapCodeForPreview(payload.code, theme);
  }, [payload, theme]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleRemix = () => {
    if (!payload) return;
    stashRemixPayload(payload);
    router.push("/studio?remix=1");
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading shared preview…
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-semibold text-foreground">Invalid or expired share link</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          This preview link is missing data or could not be decoded. Ask the author to copy a new
          share link.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" />
          Open Shipboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-foreground hover:opacity-80">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-tighter">Shipboard</span>
          </Link>
          <div className="h-3 w-px bg-border" />
          <span className="truncate text-sm font-medium text-foreground">
            {payload.title || "Shared preview"}
          </span>
          <span className="hidden rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            Read-only share
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCode((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Toggle source"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{showCode ? "Preview" : "Code"}</span>
          </button>
          <button
            onClick={handleCopyLink}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Copy share link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
          </button>
          <button
            type="button"
            onClick={handleRemix}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Remix in Shipboard
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 bg-zinc-900">
        {showCode ? (
          <pre className="h-full overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-300">
            {payload.code}
          </pre>
        ) : (
          <iframe
            title={payload.title || "Shared preview"}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="h-full w-full border-0 bg-white"
          />
        )}
      </main>
    </div>
  );
}
