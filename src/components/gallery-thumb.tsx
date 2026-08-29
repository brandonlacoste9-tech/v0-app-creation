import { cn } from "@/lib/utils";

type Kind =
  | "admin"
  | "kanban"
  | "auth"
  | "pricing"
  | "dash"
  | "waitlist"
  | "portfolio"
  | "landing";

function kindOf(id: string, title: string): Kind {
  const s = `${id} ${title}`.toLowerCase();
  if (/admin|users/.test(s)) return "admin";
  if (/kanban|board/.test(s)) return "kanban";
  if (/auth|sign.?in|login/.test(s)) return "auth";
  if (/pricing|price/.test(s)) return "pricing";
  if (/dashboard|ops/.test(s)) return "dash";
  if (/waitlist/.test(s)) return "waitlist";
  if (/portfolio|atelier|brutal/.test(s)) return "portfolio";
  return "landing";
}

export function GalleryThumb({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const kind = kindOf(id, title);
  return (
    <div
      className={cn(
        "relative h-36 overflow-hidden bg-zinc-950",
        className
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.16),_transparent_55%)]" />
      <div className="absolute inset-3 rounded-lg border border-white/10 bg-zinc-900/80 p-2 shadow-inner">
        {kind === "admin" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-2 w-10 rounded bg-orange-400/70" />
              <div className="h-3 w-8 rounded bg-orange-500" />
            </div>
            {["w-full", "w-5/6", "w-4/5"].map((w) => (
              <div key={w} className="flex gap-1">
                <div className={cn("h-2 rounded bg-white/20", w)} />
              </div>
            ))}
          </div>
        )}
        {kind === "kanban" && (
          <div className="grid h-full grid-cols-3 gap-1">
            {[3, 2, 1].map((n, i) => (
              <div key={i} className="space-y-1 rounded bg-white/5 p-1">
                {Array.from({ length: n }).map((_, j) => (
                  <div key={j} className="h-4 rounded bg-white/10" />
                ))}
              </div>
            ))}
          </div>
        )}
        {kind === "auth" && (
          <div className="mx-auto mt-2 w-2/3 space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="h-2 w-12 rounded bg-orange-400/70" />
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-orange-500" />
          </div>
        )}
        {kind === "pricing" && (
          <div className="grid h-full grid-cols-3 gap-1 pt-1">
            {[false, true, false].map((hot, i) => (
              <div
                key={i}
                className={cn(
                  "rounded border p-1.5",
                  hot ? "border-orange-500/50 bg-orange-500/10" : "border-white/10"
                )}
              >
                <div className="h-2 w-8 rounded bg-white/30" />
                <div className="mt-2 h-3 w-10 rounded bg-white/50" />
                <div className="mt-2 h-2 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}
        {kind === "dash" && (
          <div className="flex h-full gap-1">
            <div className="w-6 rounded bg-white/5" />
            <div className="grid flex-1 grid-cols-2 gap-1">
              <div className="rounded bg-orange-500/20" />
              <div className="rounded bg-white/10" />
              <div className="col-span-2 rounded bg-white/5" />
            </div>
          </div>
        )}
        {kind === "waitlist" && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <div className="h-2 w-16 rounded bg-orange-400/80" />
            <div className="h-3 w-24 rounded bg-white/40" />
            <div className="mt-1 flex w-full gap-1">
              <div className="h-4 flex-1 rounded bg-white/10" />
              <div className="h-4 w-8 rounded bg-orange-500" />
            </div>
          </div>
        )}
        {kind === "portfolio" && (
          <div className="grid h-full grid-cols-2 gap-1">
            <div className="rounded bg-white/15" />
            <div className="space-y-1">
              <div className="h-2 w-10 rounded bg-white/50" />
              <div className="h-2 w-full rounded bg-white/10" />
              <div className="h-2 w-4/5 rounded bg-white/10" />
            </div>
          </div>
        )}
        {kind === "landing" && (
          <div className="space-y-1.5 pt-1 text-center">
            <div className="mx-auto h-2 w-14 rounded bg-orange-400/80" />
            <div className="mx-auto h-3 w-28 rounded bg-white/50" />
            <div className="mx-auto h-2 w-20 rounded bg-white/20" />
            <div className="mx-auto mt-2 flex justify-center gap-1">
              <div className="h-3 w-10 rounded bg-orange-500" />
              <div className="h-3 w-10 rounded border border-white/20" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
