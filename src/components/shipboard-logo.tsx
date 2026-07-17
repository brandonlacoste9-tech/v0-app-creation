"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; px: number }> = {
  xs: { box: "h-5 w-5", px: 20 },
  sm: { box: "h-6 w-6", px: 24 },
  md: { box: "h-8 w-8", px: 32 },
  lg: { box: "h-10 w-10", px: 40 },
};

interface ShipboardLogoProps {
  size?: Size;
  className?: string;
  /** Show wordmark next to mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  priority?: boolean;
}

/**
 * Official Shipboard mark — concept A (geometric ship).
 */
export function ShipboardLogo({
  size = "sm",
  className,
  withWordmark = false,
  wordmarkClassName,
  priority = false,
}: ShipboardLogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-md ring-1 ring-orange-500/25",
          s.box
        )}
      >
        <Image
          src="/shipboard-logo.jpg"
          alt="Shipboard"
          width={s.px}
          height={s.px}
          className="h-full w-full object-cover"
          priority={priority}
        />
      </span>
      {withWordmark && (
        <span
          className={cn(
            "text-sm font-bold uppercase tracking-tighter text-foreground",
            wordmarkClassName
          )}
        >
          Shipboard
        </span>
      )}
    </span>
  );
}
