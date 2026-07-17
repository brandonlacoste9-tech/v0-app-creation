"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Sparkles,
  Loader2,
  LayoutGrid,
  ArrowRight,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShipboardLogo } from "@/components/shipboard-logo";

type GalleryCard = {
  id: string;
  title: string;
  description: string;
  theme: string;
  author: string;
  likes: number;
  createdAt: string;
  seeded?: boolean;
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

function Card({ item }: { item: GalleryCard }) {
  const official = item.seeded || item.id.startsWith("seed-");
  return (
    <Link
      href={`/gallery/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10"
    >
      <div className="relative flex h-36 items-center justify-center overflow-hidden border-b border-border bg-zinc-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.16),_transparent_55%)]" />
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald/10 blur-2xl" />
        <div className="relative z-10 px-4 text-center">
          <div className="text-2xl opacity-90 transition-transform group-hover:scale-110">
            ✦
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {official && (
              <Badge className="border-orange-500/40 bg-orange-500/15 text-[10px] normal-case tracking-normal text-orange-500">
                <Star className="mr-0.5 h-2.5 w-2.5" />
                Official
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="normal-case tracking-normal text-[10px]"
            >
              {item.theme || "default"}
            </Badge>
          </div>
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
  );
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

  const { official, community } = useMemo(() => {
    const o: GalleryCard[] = [];
    const c: GalleryCard[] = [];
    for (const i of items) {
      if (i.seeded || i.id.startsWith("seed-")) o.push(i);
      else c.push(i);
    }
    return { official: o, community: c };
  }, [items]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            >
              <ShipboardLogo size="xs" withWordmark />
            </Link>
            <div className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <LayoutGrid className="h-3.5 w-3.5 text-orange-400" />
              Showcase
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/#pricing">Pricing</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/studio">
                <Sparkles className="h-3.5 w-3.5" />
                Open studio
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-10 max-w-2xl">
          <Badge variant="accent" className="mb-3">
            Community + official
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Shipboard{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
              showcase
            </span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Production-dialect React + Tailwind UIs from Shipboard. Preview live,
            remix into studio, eject real Next.js — no dual-path preview code.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border px-2.5 py-1">
              Golden path · Admin · Auth · Kanban
            </span>
            <span className="rounded-full border border-border px-2.5 py-1">
              Remix → Studio
            </span>
            <span className="rounded-full border border-border px-2.5 py-1">
              Ship → GitHub / Vercel
            </span>
          </div>
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
              Generate a UI, then click{" "}
              <strong className="text-foreground">Publish</strong> in the preview
              toolbar.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href="/studio">Open studio</Link>
            </Button>
          </div>
        )}

        {!loading && !error && official.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Official starters
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Seeded examples — remix and iterate in studio
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {official.map((item) => (
                <Card key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {!loading && !error && community.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Community
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Published from studio · like and remix
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {community.map((item) => (
                <Card key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {!loading && !error && items.length > 0 && (
          <p className="mt-12 text-center text-xs text-muted-foreground">
            Built with{" "}
            <Link href="/" className="text-orange-400 hover:underline">
              Shipboard
            </Link>
            . Production dialect in, real Next.js out.
          </p>
        )}
      </main>
    </div>
  );
}
