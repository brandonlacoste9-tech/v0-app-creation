/**
 * AdGenAI plan entitlements — single source of truth for limits & access.
 * Stripe tiers: free | builder ($15) | pro ($25) | max ($45).
 */
import {
  ALL_PROVIDERS,
  FREE_GENERATIONS_PER_DAY,
  FREE_PROJECT_LIMIT,
  FREE_PROVIDERS,
} from "./limits";
import {
  getStripePriceIdForPlan,
  isPaidPlanId,
  type PaidPlanId,
  PAID_PLANS,
} from "./pricing";

/** Stored on user / anon cookie / API responses */
export type PlanId = "free" | "builder" | "pro" | "max";

export interface PlanEntitlements {
  id: PlanId;
  name: string;
  /** Daily generation cap; null = unlimited */
  generationsPerDay: number | null;
  /** Concurrent projects; null = unlimited */
  projectLimit: number | null;
  providers: readonly string[];
  brandKit: boolean;
  /** Side-by-side version compare (paid+) */
  versionCompare: boolean;
  /** Live preview browser QA + capture (all plans; agent scrape = pro+) */
  browserQa: boolean;
  /** Open-web inspiration scrape via agent worker (pro+) */
  browserAgent: boolean;
  isPaid: boolean;
}

const ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  free: {
    id: "free",
    name: "Free",
    generationsPerDay: FREE_GENERATIONS_PER_DAY,
    projectLimit: FREE_PROJECT_LIMIT,
    providers: FREE_PROVIDERS,
    brandKit: false,
    versionCompare: false,
    browserQa: true,
    browserAgent: false,
    isPaid: false,
  },
  builder: {
    id: "builder",
    name: "Builder",
    generationsPerDay: 40,
    projectLimit: null,
    providers: FREE_PROVIDERS,
    brandKit: false,
    versionCompare: false,
    browserQa: true,
    browserAgent: false,
    isPaid: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    generationsPerDay: 120,
    projectLimit: null,
    providers: ALL_PROVIDERS,
    brandKit: true,
    versionCompare: true,
    browserQa: true,
    browserAgent: true,
    isPaid: true,
  },
  max: {
    id: "max",
    name: "Max",
    generationsPerDay: null,
    projectLimit: null,
    providers: ALL_PROVIDERS,
    brandKit: true,
    versionCompare: true,
    browserQa: true,
    browserAgent: true,
    isPaid: true,
  },
};

/** Normalize legacy / unknown values. Promo unlocks map to Pro. */
export function normalizePlan(plan: string | null | undefined): PlanId {
  if (!plan) return "free";
  const p = plan.toLowerCase().trim();
  if (p === "free" || p === "builder" || p === "pro" || p === "max") return p;
  // Legacy / mistakes
  if (p === "premium" || p === "paid" || p === "unlimited") return "pro";
  return "free";
}

export function getPlanEntitlements(plan: string | null | undefined): PlanEntitlements {
  return ENTITLEMENTS[normalizePlan(plan)];
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  return getPlanEntitlements(plan).isPaid;
}

export function planAllowsProvider(
  plan: string | null | undefined,
  provider: string
): boolean {
  return getPlanEntitlements(plan).providers.includes(provider);
}

export function generationsLimitFor(plan: string | null | undefined): number | null {
  return getPlanEntitlements(plan).generationsPerDay;
}

export function projectLimitFor(plan: string | null | undefined): number | null {
  return getPlanEntitlements(plan).projectLimit;
}

/** Reverse Stripe price ID → paid plan (for webhooks / portal). */
export function planFromStripePriceId(priceId: string | null | undefined): PaidPlanId | null {
  if (!priceId?.trim()) return null;
  for (const def of PAID_PLANS) {
    const id = getStripePriceIdForPlan(def.id);
    if (id && id === priceId.trim()) return def.id;
  }
  return null;
}

export function planFromMetadata(
  metadata?: Record<string, string> | null
): PlanId | null {
  if (!metadata) return null;
  const raw = metadata.plan_tier || metadata.plan || metadata.tier;
  if (isPaidPlanId(raw)) return raw;
  if (raw === "free") return "free";
  return null;
}

/** Human label for UI badges */
export function planDisplayName(plan: string | null | undefined): string {
  return getPlanEntitlements(plan).name;
}

/** Rank for upgrade UI (higher = more capable). */
export function planRank(plan: string | null | undefined): number {
  const ranks: Record<PlanId, number> = {
    free: 0,
    builder: 1,
    pro: 2,
    max: 3,
  };
  return ranks[normalizePlan(plan)];
}

/** Honest feature bullets for free tier UI. */
export function freePlanFeatureBullets(): string[] {
  const e = ENTITLEMENTS.free;
  return [
    `${e.generationsPerDay} generations / day`,
    `${e.projectLimit} projects`,
    "Grok, Groq, Ollama, OpenAI",
    "Live preview + ZIP export",
  ];
}
