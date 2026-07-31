/**
 * Lightweight "clarify before expensive build" heuristics.
 * Inspired by agent clarify tools — not a full agent loop.
 */

export interface ClarifyChoice {
  id: string;
  label: string;
  /** Appended / used as the concrete build brief */
  prompt: string;
}

/** True when the prompt is too thin for a multi-file UI build. */
export function shouldClarify(prompt: string, hasExistingCode: boolean): boolean {
  if (hasExistingCode) return false;
  const p = prompt.trim();
  if (!p) return false;
  if (p.length >= 100) return false;
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length >= 14) return false;

  // Explicit structured requests skip clarify
  if (
    /\b(landing|dashboard|pricing|auth|login|signup|kanban|calendar|portfolio|checkout|navbar|hero|footer)\b/i.test(
      p
    ) &&
    words.length >= 6
  ) {
    return false;
  }

  // Short / vague
  if (words.length <= 5) return true;
  if (p.length < 40) return true;
  if (/^(make|build|create|design|i want|need|help|do)\b/i.test(p) && words.length < 10) {
    return true;
  }
  return false;
}

export function getClarifyChoices(originalPrompt: string): ClarifyChoice[] {
  const seed = originalPrompt.trim() || "app";
  return [
    {
      id: "landing",
      label: "SaaS landing",
      prompt: `Build a polished dark SaaS landing page for "${seed}" (name the product from the idea if clear, else invent a short product name). Must include: sticky navbar + mobile menu, hero with dual CTAs and strong first-viewport hierarchy, 3 concrete feature cards, social proof or metrics, waitlist or CTA form with useState success state, footer. Multi-file. No lorem.`,
    },
    {
      id: "dashboard",
      label: "Admin dashboard",
      prompt: `Create a dense dark admin dashboard for "${seed}". First paint: collapsible sidebar, page title, 4 KPI cards, chart or activity panel, and a data table with status badges + filter. Loading/empty states. Multi-file. No empty single-card shells.`,
    },
    {
      id: "component",
      label: "Single component",
      prompt: `Design one focused, production-quality React component for: "${seed}". Self-contained with polished Tailwind, clear hierarchy, and at least one interactive control (useState). No sparse empty cards.`,
    },
    {
      id: "auth",
      label: "Auth screens",
      prompt: `Build login + signup toggle UI for "${seed}". Email/password, OAuth buttons, loading/success/error states (no dead forms), and a marketing panel on md+. Multi-file. Dark glass.`,
    },
  ];
}
