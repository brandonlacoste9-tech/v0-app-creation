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
      prompt: `Build a polished dark SaaS landing page based on: "${seed}". Include navbar, hero with dual CTAs, 3 feature cards, social proof, and footer. Interactive mobile menu.`,
    },
    {
      id: "dashboard",
      label: "Admin dashboard",
      prompt: `Create a dark admin dashboard inspired by: "${seed}". Top bar, sidebar, 4 KPI cards, chart area, and a data table with status badges.`,
    },
    {
      id: "component",
      label: "Single component",
      prompt: `Design one focused, production-quality React component for: "${seed}". Self-contained with clear props-like UI state, polished Tailwind, and interactive controls.`,
    },
    {
      id: "auth",
      label: "Auth screens",
      prompt: `Build login + signup toggle UI related to: "${seed}". Email/password, OAuth buttons, validation states, and a marketing panel.`,
    },
  ];
}
