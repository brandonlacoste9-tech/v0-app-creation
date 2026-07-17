"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { wrapCodeForPreview } from "@/lib/preview-html";
import { PREVIEW_THEMES } from "@/lib/types";
import { stashRemixPayload } from "@/lib/remix";
import {
  Zap,
  Heart,
  Sparkles,
  ArrowLeft,
  Loader2,
  Code2,
} from "lucide-react";

type GalleryItem = {
  id: string;
  title: string;
  description: string;
  code: string;
  theme: string;
  author: string;
  likes: number;
  createdAt: string;
};

export default function GalleryItemPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [item, setItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [likes, setLikes] = useState(0);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/gallery/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setItem(data);
          setLikes(data.likes ?? 0);
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  const theme =
    PREVIEW_THEMES.find((t) => t.id === item?.theme) ?? PREVIEW_THEMES[0];

  const srcDoc = useMemo(() => {
    if (!item?.code) return "";
    return wrapCodeForPreview(item.code, theme);
  }, [item, theme]);

  const handleRemix = () => {
    if (!item) return;
    stashRemixPayload({
      code: item.code,
      title: item.title,
      theme: item.theme,
    });
    router.push("/studio?remix=1");
  };

  const handleLike = async () => {
    if (liking || !id) return;
    setLiking(true);
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "like" }),
      });
      const data = await res.json();
      if (typeof data.likes === "number") setLikes(data.likes);
    } finally {
      setLiking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading project…
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-foreground">{error || "Not found"}</p>
        <Link href="/gallery" className="text-sm text-orange-400 hover:underline">
          ← Back to showcase
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/gallery" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden text-xs sm:inline">Showcase</span>
          </Link>
          <div className="h-3 w-px bg-border" />
          <Link href="/" className="flex items-center gap-1.5 hover:opacity-80">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-tighter">Shipboard</span>
          </Link>
          <div className="h-3 w-px bg-border" />
          <span className="truncate text-sm font-medium">{item.title}</span>
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            by @{item.author}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Heart className="h-3.5 w-3.5" />
            {likes}
          </button>
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showCode ? "Preview" : "Code"}
          </button>
          <button
            type="button"
            onClick={handleRemix}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald px-3 text-xs font-bold text-zinc-950 hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Remix
          </button>
        </div>
      </header>

      {item.description && (
        <p className="border-b border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground">
          {item.description}
        </p>
      )}

      <main className="min-h-0 flex-1 bg-zinc-900">
        {showCode ? (
          <pre className="h-full overflow-auto p-4 font-mono text-xs text-zinc-300">
            {item.code.startsWith("{")
              ? JSON.stringify(JSON.parse(item.code), null, 2)
              : item.code}
          </pre>
        ) : (
          <iframe
            title={item.title}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="h-full w-full border-0 bg-white"
          />
        )}
      </main>
    </div>
  );
}
