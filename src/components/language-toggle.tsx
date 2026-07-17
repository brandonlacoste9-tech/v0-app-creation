"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5",
        className
      )}
      role="group"
      aria-label={t("lang.toggle")}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide transition-colors",
          locale === "en"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        title={t("lang.en")}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("fr")}
        className={cn(
          "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide transition-colors",
          locale === "fr"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        title={t("lang.fr")}
      >
        FR
      </button>
    </div>
  );
}
