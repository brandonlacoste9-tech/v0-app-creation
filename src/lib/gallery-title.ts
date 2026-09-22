/**
 * Gallery / session titles must be short product names, not truncated prompts.
 * Community cards were cutting mid-word because we stored the first 50–120
 * chars of the chat prompt (e.g. "Create a ChatGPT-style app shell: left chat histor...").
 */
import { PROMPT_TEMPLATES } from "./types";

const MAX_TITLE = 48;

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function clampAtWord(s: string, max: number): string {
  if (s.length <= max) return s.replace(/[.,;:]+$/, "").trim();
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  const base = (sp > 16 ? cut.slice(0, sp) : cut).replace(/[.,;:]+$/, "").trim();
  return base || s.slice(0, max).trim();
}

/** True when the string looks like a raw prompt or a mid-word ellipsis cut. */
export function looksLikePromptTitle(raw: string): boolean {
  const t = collapseWs(raw);
  if (!t) return false;
  if (t.endsWith("...") || t.endsWith("…")) return true;
  if (t.length > MAX_TITLE + 4) return true;
  if (
    /^(create|build|make|generate|polished|project|dark|full|operations|3-step)\b/i.test(
      t
    )
  ) {
    return t.length > 28;
  }
  return false;
}

/**
 * Derive a gallery/session title from a prompt or existing title.
 * Known golden-path templates map to their labels (e.g. AI Chat UI).
 */
export function deriveShortTitle(raw: string, max = MAX_TITLE): string {
  const t = collapseWs(raw).replace(/[.…]+$/, "").trim();
  if (!t) return "Untitled";

  for (const tmpl of PROMPT_TEMPLATES) {
    const p = collapseWs(tmpl.prompt);
    if (!p) continue;
    const prefix = p.slice(0, 32);
    if (
      t === tmpl.label ||
      t === p ||
      t.startsWith(prefix) ||
      p.startsWith(t.slice(0, Math.min(t.length, 32)))
    ) {
      return tmpl.label;
    }
  }

  const stripped = t.replace(
    /^(create|build|make|generate)\s+(a|an|the)\s+/i,
    ""
  );
  const source =
    stripped.length > 8 && stripped.length < t.length ? stripped : t;
  const firstSentence = source.split(/[.\n]/)[0] || source;
  return clampAtWord(firstSentence, max) || "Untitled";
}

/** Display-side cleanup for already-stored community titles. */
export function displayGalleryTitle(raw: string): string {
  const t = collapseWs(raw);
  if (!t) return "Untitled";
  if (looksLikePromptTitle(t)) return deriveShortTitle(t);
  return t.length > MAX_TITLE ? clampAtWord(t, MAX_TITLE) : t;
}
