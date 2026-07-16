import type { SharePayload } from "./share";

export const REMIX_STORAGE_KEY = "adgen_remix_payload";

export function stashRemixPayload(payload: SharePayload): void {
  try {
    sessionStorage.setItem(REMIX_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function takeRemixPayload(): SharePayload | null {
  try {
    const raw = sessionStorage.getItem(REMIX_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(REMIX_STORAGE_KEY);
    const parsed = JSON.parse(raw) as SharePayload;
    if (!parsed?.code || typeof parsed.code !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
