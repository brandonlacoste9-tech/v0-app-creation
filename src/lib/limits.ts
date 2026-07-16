/** Free / Pro product limits (single source of truth). */

export const FREE_GENERATIONS_PER_DAY = 5;
export const FREE_PROJECT_LIMIT = 3;

/**
 * Providers available without Pro (server key or BYOK / local).
 * Includes openai so Netlify (and similar) hosts that only configure OPENAI_API_KEY
 * still work for free builders — default product path is xAI/Groq when those keys exist.
 */
export const FREE_PROVIDERS = ["groq", "xai", "ollama", "openai"] as const;

/** All providers. */
export const ALL_PROVIDERS = [
  "groq",
  "xai",
  "ollama",
  "deepseek",
  "openai",
  "anthropic",
] as const;

export type FreeProvider = (typeof FREE_PROVIDERS)[number];

export function isFreeProvider(provider: string): boolean {
  return (FREE_PROVIDERS as readonly string[]).includes(provider);
}
