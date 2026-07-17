/**
 * Base free-tier constants. Full entitlements: see plans.ts.
 */

export const FREE_GENERATIONS_PER_DAY = 5;
export const FREE_PROJECT_LIMIT = 3;

/**
 * Providers available on Free / Builder (server key or BYOK / local).
 * Includes openai so Netlify hosts that only configure OPENAI_API_KEY still work.
 */
export const FREE_PROVIDERS = ["groq", "xai", "ollama", "openai"] as const;

/** All providers (Pro / Max). */
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
