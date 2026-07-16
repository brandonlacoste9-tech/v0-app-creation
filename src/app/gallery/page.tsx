"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Heart, Sparkles, ArrowLeft, Loader2, LayoutGrid, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type GalleryCard = {
  id: string;
  title: string;
  description: string;
  theme: string;
  author: string;
  likes: number;
  createdAt: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

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
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 transition-opacity hover:opacity-80">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-tighter">adgenai</span>
            </Link>
            <div className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <LayoutGrid className="h-3.5 w-3.5 text-orange-400" />
              Showcase
            </span>
          </div>
          <Button asChild size="sm">
            <Link href="/studio">
              <Sparkles className="h-3.5 w-3.5" />
              Open studio
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-10 max-w-2xl">
          <Badge variant="accent" className="mb-3">
            Community
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Community{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
              showcase
            </span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            UI generated with AdGenAI. Open any project to preview, then remix it into your studio.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10">
              <LayoutGrid className="h-6 w-6 text-orange-400/80" />
            </div>
            <p className="font-medium text-foreground">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a UI, then click <strong className="text-foreground">Publish</strong> in the preview toolbar.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href="/studio">
                <ArrowLeft className="h-3.5 w-3.5" />
                Open studio
              </Link>
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/gallery/${item.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10"
            >
              <div className="relative flex h-32 items-center justify-center overflow-hidden border-b border-border bg-zinc-950">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.14),_transparent_55%)]" />
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald/10 blur-2xl" />
                <div className="relative z-10 text-center">
                  <div className="text-2xl opacity-90 transition-transform group-hover:scale-110">✦</div>
                  <Badge variant="secondary" className="mt-2 normal-case tracking-normal">
                    {item.theme || "default"}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-orange-300">
                  {item.title}
                </h2>
                {item.description ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground/50">No description</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-4 text-[11px] text-muted-foreground">
                  <span className="truncate">@{item.author || "anon"}</span>
                  <div className="flex items-center gap-2.5">
                    {item.createdAt && (
                      <span className="hidden sm:inline">{formatDate(item.createdAt)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {item.likes ?? 0}
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
