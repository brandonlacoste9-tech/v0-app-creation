/**
 * Persist studio AppSettings in localStorage (client-only).
 * API keys stay local; never sent to our storage layer here.
 */
import type { AppSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "adgenai.studio.settings.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Deep-merge saved JSON onto defaults so new fields always exist. */
export function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  if (!partial || typeof partial !== "object") {
    return { ...DEFAULT_SETTINGS, brandKit: { ...DEFAULT_SETTINGS.brandKit } };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    brandKit: {
      ...DEFAULT_SETTINGS.brandKit,
      ...(partial.brandKit || {}),
    },
  };
}

export function loadSettings(): AppSettings {
  if (!isBrowser()) {
    return mergeSettings(null);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergeSettings(null);
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return mergeSettings(parsed);
  } catch {
    return mergeSettings(null);
  }
}

export function saveSettings(settings: AppSettings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota / private mode — ignore
  }
}
