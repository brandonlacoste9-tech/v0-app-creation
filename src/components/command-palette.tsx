"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Command,
  FileCode,
  Download,
  Rocket,
  Settings,
  Share2,
  Sparkles,
  Plus,
  Eye,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type CommandAction =
  | "new-project"
  | "settings"
  | "push-github"
  | "deploy"
  | "download-zip"
  | "share"
  | "publish"
  | "gallery"
  | "fullscreen"
  | "focus-chat";

interface CommandItem {
  id: CommandAction;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: CommandAction) => void;
  hasCode: boolean;
  githubConnected: boolean;
}

export function CommandPalette({
  open,
  onClose,
  onAction,
  hasCode,
  githubConnected,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: "new-project",
        label: "New project",
        hint: "⌘N",
        icon: Plus,
        group: "Project",
      },
      {
        id: "focus-chat",
        label: "Focus chat",
        hint: "Describe your UI",
        icon: Sparkles,
        group: "Project",
      },
      {
        id: "settings",
        label: "Open settings",
        hint: "⌘,",
        icon: Settings,
        group: "Project",
      },
      {
        id: "push-github",
        label: githubConnected ? "Push to GitHub" : "Connect & push to GitHub",
        hint: "Full Vite project",
        icon: GithubIcon,
        disabled: !hasCode,
        group: "Ship",
      },
      {
        id: "deploy",
        label: "Ship to Vercel",
        hint: "GitHub + import",
        icon: Rocket,
        disabled: !hasCode,
        group: "Ship",
      },
      {
        id: "download-zip",
        label: "Download ZIP",
        hint: "Vite scaffold",
        icon: Download,
        disabled: !hasCode,
        group: "Ship",
      },
      {
        id: "share",
        label: "Copy share link",
        hint: "Read-only preview",
        icon: Share2,
        disabled: !hasCode,
        group: "Ship",
      },
      {
        id: "publish",
        label: "Publish to showcase",
        hint: "Community gallery",
        icon: Sparkles,
        disabled: !hasCode,
        group: "Ship",
      },
      {
        id: "gallery",
        label: "Open showcase",
        hint: "/gallery",
        icon: Eye,
        group: "View",
      },
      {
        id: "fullscreen",
        label: "Toggle fullscreen preview",
        hint: "F",
        icon: Eye,
        disabled: !hasCode,
        group: "View",
      },
    ];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.hint.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [query, hasCode, githubConnected]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items[active] && !items[active].disabled) {
        e.preventDefault();
        onAction(items[active].id);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, active, onAction, onClose]);

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Command className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ship, push, share, settings…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <Badge variant="secondary" className="shrink-0 normal-case tracking-normal">
            esc
          </Badge>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">No commands match</p>
          ) : (
            groups.map((group) => {
              const groupItems = items.filter((i) => i.group === group);
              if (!groupItems.length) return null;
              return (
                <div key={group} className="mb-2">
                  <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const idx = items.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={item.disabled}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => {
                          if (item.disabled) return;
                          onAction(item.id);
                          onClose();
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors",
                          idx === active && !item.disabled && "bg-accent text-foreground shadow-sm",
                          item.disabled
                            ? "cursor-not-allowed text-muted-foreground/45"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40",
                            idx === active && !item.disabled && "border-orange-500/30 bg-orange-500/10"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 font-medium">{item.label}</span>
                        <span className="font-mono text-[10px] opacity-70">{item.hint}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileCode className="h-3 w-3" />
            Shipboard commands
          </span>
          <span>↑↓ navigate · ↵ run</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
