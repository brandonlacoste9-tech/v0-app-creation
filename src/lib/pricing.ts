/**
 * AdGenAI paid tiers (CAD monthly in Stripe).
 * Feature bullets must stay aligned with entitlements in plans.ts.
 */

export type PaidPlanId = "builder" | "pro" | "max";

export interface PaidPlan {
  id: PaidPlanId;
  name: string;
  priceCad: number;
  blurb: string;
  features: string[];
  popular?: boolean;
  /** Env var that holds Stripe Price ID */
  envKey: string;
  fallbackEnvKeys?: string[];
}

export const PAID_PLANS: PaidPlan[] = [
  {
    id: "builder",
    name: "Builder",
    priceCad: 15,
    blurb: "More gens + unlimited projects — solid for side projects.",
    features: [
      "40 generations / day",
      "Unlimited projects",
      "Grok, Groq, Ollama, OpenAI",
      "GitHub push + ZIP + Ship",
    ],
    envKey: "STRIPE_PRICE_ID_BUILDER",
    fallbackEnvKeys: ["STRIPE_PRICE_ID"],
  },
  {
    id: "pro",
    name: "Pro",
    priceCad: 25,
    blurb: "Higher limits, all providers, brand kit — default paid plan.",
    features: [
      "120 generations / day",
      "Unlimited projects",
      "All AI providers",
      "Brand kit + version compare",
    ],
    popular: true,
    envKey: "STRIPE_PRICE_ID_PRO",
  },
  {
    id: "max",
    name: "Max",
    priceCad: 45,
    blurb: "Unlimited generations and full access for heavy shippers.",
    features: [
      "Unlimited generations",
      "Unlimited projects",
      "All AI providers",
      "Brand kit + version compare",
      "Priority support path",
    ],
    envKey: "STRIPE_PRICE_ID_MAX",
  },
];

export function isPaidPlanId(v: unknown): v is PaidPlanId {
  return v === "builder" || v === "pro" || v === "max";
}

export function getStripePriceIdForPlan(plan: PaidPlanId): string {
  const def = PAID_PLANS.find((p) => p.id === plan);
  if (!def) return "";
  const keys = [def.envKey, ...(def.fallbackEnvKeys || [])];
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return "";
}

export function anyStripePriceConfigured(): boolean {
  return (
    Boolean(process.env.STRIPE_PRICE_ID?.trim()) ||
    Boolean(process.env.STRIPE_PRICE_ID_BUILDER?.trim()) ||
    Boolean(process.env.STRIPE_PRICE_ID_PRO?.trim()) ||
    Boolean(process.env.STRIPE_PRICE_ID_MAX?.trim())
  );
}
