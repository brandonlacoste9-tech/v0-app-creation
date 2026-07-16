/**
 * AdGenAI paid tiers (CAD monthly in Stripe).
 * Map env price IDs → checkout; all paid tiers unlock plan "pro" in the app today.
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
    blurb: "Solid models + included credits. Top up as you go.",
    features: [
      "Included monthly generations",
      "Fast / standard models",
      "Unlimited projects",
      "GitHub push + ZIP",
      "Pay-as-you-go overages",
    ],
    envKey: "STRIPE_PRICE_ID_BUILDER",
    fallbackEnvKeys: ["STRIPE_PRICE_ID"],
  },
  {
    id: "pro",
    name: "Pro",
    priceCad: 25,
    blurb: "Better models and higher limits — the default paid plan.",
    features: [
      "Higher generation allowance",
      "Better default models",
      "All AI providers",
      "Priority queue",
      "Brand kit + multi-file",
    ],
    popular: true,
    envKey: "STRIPE_PRICE_ID_PRO",
  },
  {
    id: "max",
    name: "Max",
    priceCad: 45,
    blurb: "Best models and highest caps for shipping hard.",
    features: [
      "Highest generation caps",
      "Best-tier models",
      "All Pro features",
      "Priority support path",
      "Commercial use ready",
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
