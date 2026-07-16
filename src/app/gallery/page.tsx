"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Heart, Sparkles, ArrowLeft, Loader2, LayoutGrid } from "lucide-react";

type GalleryCard = {
  id: string;
  title: string;
  description: string;
  theme: string;
  author: string;
  likes: number;
  createdAt: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else setError(data.error || "Failed to load");
      })
      .catch(() => setError("Failed to load gallery"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 hover:opacity-80">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-tighter">adgenai</span>
            </Link>
            <div className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <LayoutGrid className="h-3.5 w-3.5 text-orange-400" />
              Showcase
            </span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Build your own
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Community{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
              showcase
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            UI generated with AdGenAI. Open any project to preview, then remix it into your studio.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading showcase…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a UI, then click <strong>Publish</strong> in the preview toolbar.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-orange-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to studio
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/gallery/${item.id}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5"
            >
              <div className="mb-3 flex h-28 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-zinc-900 to-zinc-950">
                <div className="text-center">
                  <div className="text-2xl opacity-80">✦</div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.theme}</p>
                </div>
              </div>
              <h2 className="truncate text-sm font-semibold text-foreground group-hover:text-orange-300">
                {item.title}
              </h2>
              {item.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground/60">No description</p>
              )}
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate">@{item.author}</span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {item.likes}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
