import type { Locale } from "./messages";

const KEY = "Shipboard.locale";

export function loadLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "fr" || v === "en") return v;
  } catch {
    /* ignore */
  }
  // Browser preference
  try {
    const nav = navigator.language?.toLowerCase() || "";
    if (nav.startsWith("fr")) return "fr";
  } catch {
    /* ignore */
  }
  return "en";
}

export function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    /* ignore */
  }
}
