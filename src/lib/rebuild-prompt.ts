export function rebuildPromptFromUrl(url: string): string {
  const trimmed = url.trim();
  return `Rebuild this live public website as a production marketing UI.

URL: ${trimmed}

Use printed facts only — no invented emails, phones, hours, prices, or testimonials.
If a fact is missing, omit it. Phone/email CTAs: tel: and mailto: only.
Optional generated hero still is illustrated, not a real staff photo.`;
}

export function readRebuildUrlFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get("rebuild") || params.get("url");
    if (!raw) return null;
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
