import LZString from "lz-string";

export interface SharePayload {
  code: string;
  title?: string;
  theme?: string;
}

/** Compress a preview payload for URL hash transport. */
export function encodeSharePayload(payload: SharePayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

/** Decode a share hash/query payload. Returns null if invalid. */
export function decodeSharePayload(encoded: string): SharePayload | null {
  if (!encoded) return null;
  try {
    const raw = LZString.decompressFromEncodedURIComponent(encoded);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SharePayload;
    if (!parsed?.code || typeof parsed.code !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Build a full shareable URL (hash-based, no server storage). */
export function buildShareUrl(payload: SharePayload, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share#${encodeSharePayload(payload)}`;
}
