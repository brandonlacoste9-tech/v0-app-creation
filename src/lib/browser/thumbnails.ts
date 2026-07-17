/**
 * Client-side version thumbnails (data URLs).
 * Stored in localStorage — no DB migration required.
 */

const PREFIX = "adgen-thumb:";
const MAX_BYTES = 180_000; // keep storage small
const MAX_ENTRIES = 80;

export function thumbKey(versionId: string): string {
  return `${PREFIX}${versionId}`;
}

export function getVersionThumbnail(versionId: string): string | null {
  if (typeof window === "undefined" || !versionId) return null;
  try {
    return localStorage.getItem(thumbKey(versionId));
  } catch {
    return null;
  }
}

export function setVersionThumbnail(versionId: string, dataUrl: string): void {
  if (typeof window === "undefined" || !versionId || !dataUrl) return;
  try {
    if (dataUrl.length > MAX_BYTES) {
      // Too big — skip rather than blow storage
      return;
    }
    localStorage.setItem(thumbKey(versionId), dataUrl);
    pruneThumbs();
  } catch {
    // Quota exceeded — prune and retry once
    try {
      pruneThumbs(true);
      localStorage.setItem(thumbKey(versionId), dataUrl);
    } catch {
      /* ignore */
    }
  }
}

function pruneThumbs(aggressive = false) {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  const limit = aggressive ? Math.floor(MAX_ENTRIES / 2) : MAX_ENTRIES;
  if (keys.length <= limit) return;
  // Drop oldest-ish (alphabetical by key is fine enough)
  keys.sort();
  const drop = keys.length - limit;
  for (let i = 0; i < drop; i++) {
    localStorage.removeItem(keys[i]);
  }
}

export function clearVersionThumbnail(versionId: string): void {
  try {
    localStorage.removeItem(thumbKey(versionId));
  } catch {
    /* ignore */
  }
}
