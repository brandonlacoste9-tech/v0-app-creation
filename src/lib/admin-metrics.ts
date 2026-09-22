/**
 * Owner aggregates. Stripe secret is read only inside server functions.
 * Never pass the key, price ids, or raw Stripe objects to a client component.
 */
import { PAID_PLANS, type PaidPlanId } from "./pricing";
import { storage } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;
const STRIPE_BUDGET_MS = 1200;

export interface UserMetrics {
  total: number;
  last7d: number;
  last30d: number;
}

export interface GenerationDay {
  date: string;
  success: number;
  failed: number;
}

export interface GenerationMetrics {
  total: number;
  success: number;
  failed: number;
  /** YYYY-MM-DD of the first logged row, or null when the table is empty. */
  since: string | null;
  days: GenerationDay[];
}

export interface RevenueMetrics {
  configured: boolean;
  mrrCad: number | null;
  active: { builder: number; pro: number; max: number; other: number };
  newLast30d: number | null;
  canceledLast30d: number | null;
}

export interface AdminMetrics {
  users: UserMetrics;
  generations: GenerationMetrics;
  revenue: RevenueMetrics;
}

export function countUsersByCreatedAt(createdAts: string[], now: Date): UserMetrics {
  const t = now.getTime();
  const d7 = t - 7 * DAY_MS;
  const d30 = t - 30 * DAY_MS;
  let last7d = 0;
  let last30d = 0;
  for (const iso of createdAts) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) continue;
    if (ms >= d7) last7d += 1;
    if (ms >= d30) last30d += 1;
  }
  return { total: createdAts.length, last7d, last30d };
}

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Thirty UTC days ending today. Missing days are zeros. */
export function bucketGenerationDays(
  rows: { day: string; status: string; n: number }[],
  now: Date
): GenerationDay[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days: GenerationDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    days.push({ date: utcDayKey(d), success: 0, failed: 0 });
  }
  const index = new Map(days.map((day, i) => [day.date, i]));
  for (const row of rows) {
    const i = index.get(row.day);
    if (i == null) continue;
    const n = Number(row.n) || 0;
    if (row.status === "success") days[i].success += n;
    else if (row.status === "failed") days[i].failed += n;
  }
  return days;
}

export function sinceLabel(since: string | null): string {
  if (!since) return "No generations logged yet";
  return `since ${since}`;
}

type StripePrice = {
  id?: string;
  unit_amount?: number | null;
  currency?: string | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
};

export type StripeSubLike = {
  id?: string;
  status?: string;
  created?: number;
  canceled_at?: number | null;
  discount?: {
    coupon?: {
      percent_off?: number | null;
      amount_off?: number | null;
    } | null;
  } | null;
  items?: {
    data?: Array<{
      quantity?: number | null;
      price?: StripePrice | string | null;
    }>;
  };
};

export interface RevenueAggregates {
  mrrCad: number;
  active: { builder: number; pro: number; max: number; other: number };
  newLast30d: number;
  canceledLast30d: number;
}

function tierPrices(): Record<PaidPlanId, { id: string; cad: number }> {
  const out = {} as Record<PaidPlanId, { id: string; cad: number }>;
  for (const plan of PAID_PLANS) {
    const keys = [plan.envKey, ...(plan.fallbackEnvKeys || [])];
    let id = "";
    for (const key of keys) {
      const value = process.env[key]?.trim();
      if (value) {
        id = value;
        break;
      }
    }
    out[plan.id] = { id, cad: plan.priceCad };
  }
  return out;
}

function monthlyCad(
  price: StripePrice | string | null | undefined,
  quantity: number,
  discount: StripeSubLike["discount"],
  tiers: Record<PaidPlanId, { id: string; cad: number }>
): { tier: PaidPlanId | "other"; mrr: number } | null {
  const qty = quantity > 0 ? quantity : 1;
  const id = typeof price === "string" ? price : price?.id || "";
  const matched = (Object.keys(tiers) as PaidPlanId[]).find((tier) => tiers[tier].id && tiers[tier].id === id);
  if (typeof price === "string" || !price) {
    if (!matched) return null;
    return { tier: matched, mrr: roundCad(tiers[matched].cad * qty) };
  }

  const currency = (price.currency || "").toLowerCase();
  const interval = price.recurring?.interval || "month";
  const intervalCount = price.recurring?.interval_count || 1;
  let cents = price.unit_amount;
  if (cents == null) {
    if (!matched) return null;
    if (currency && currency !== "cad") return null;
    return { tier: matched, mrr: roundCad(tiers[matched].cad * qty) };
  }
  if (currency && currency !== "cad") return null;
  if (interval === "year") cents = cents / (12 * intervalCount);
  else if (interval === "week") cents = (cents * 52) / (12 * intervalCount);
  else if (interval === "day") cents = (cents * 365) / (12 * intervalCount);
  else cents = cents / intervalCount;
  cents *= qty;
  const percent = discount?.coupon?.percent_off;
  if (percent) cents *= 1 - percent / 100;
  const amountOff = discount?.coupon?.amount_off;
  if (amountOff) cents -= interval === "year" ? amountOff / 12 : amountOff;
  if (cents < 0) cents = 0;
  const mrr = roundCad(cents / 100);
  if (matched) return { tier: matched, mrr };
  const byAmount = (Object.keys(tiers) as PaidPlanId[]).find((tier) => Math.abs(tiers[tier].cad - mrr) < 0.01);
  return { tier: byAmount || "other", mrr };
}

function roundCad(value: number): number {
  return Math.round(value * 100) / 100;
}

export function summarizeRevenue(
  input: {
    active: StripeSubLike[];
    createdInWindow: StripeSubLike[];
    canceled: StripeSubLike[];
    now: Date;
  },
  tiers = tierPrices()
): RevenueAggregates {
  const active = { builder: 0, pro: 0, max: 0, other: 0 };
  let mrrCad = 0;
  for (const sub of input.active) {
    if (sub.status && sub.status !== "active") continue;
    const item = sub.items?.data?.[0];
    const priced = monthlyCad(item?.price, item?.quantity || 1, sub.discount, tiers);
    if (!priced) continue;
    active[priced.tier] += 1;
    mrrCad += priced.mrr;
  }
  const cutoff = Math.floor((input.now.getTime() - 30 * DAY_MS) / 1000);
  const newLast30d = input.createdInWindow.filter((sub) => (sub.created || 0) >= cutoff).length;
  const canceledLast30d = input.canceled.filter((sub) => (sub.canceled_at || 0) >= cutoff).length;
  return { mrrCad: roundCad(mrrCad), active, newLast30d, canceledLast30d };
}

const emptyRevenue = (): RevenueMetrics => ({
  configured: false,
  mrrCad: null,
  active: { builder: 0, pro: 0, max: 0, other: 0 },
  newLast30d: null,
  canceledLast30d: null,
});

async function stripeList(
  key: string,
  params: Record<string, string>,
  signal: AbortSignal
): Promise<StripeSubLike[]> {
  const out: StripeSubLike[] = [];
  let startingAfter = "";
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ limit: "100", ...params });
    if (startingAfter) query.set("starting_after", startingAfter);
    const res = await fetch(`https://api.stripe.com/v1/subscriptions?${query}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
      signal,
    });
    if (!res.ok) throw new Error(`stripe ${res.status}`);
    const data = (await res.json()) as {
      data?: StripeSubLike[];
      has_more?: boolean;
    };
    const rows = data.data || [];
    out.push(...rows);
    if (!data.has_more || rows.length === 0) break;
    startingAfter = rows[rows.length - 1]?.id || "";
    if (!startingAfter) break;
  }
  return out;
}

export async function fetchRevenue(now = new Date()): Promise<RevenueMetrics> {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!key) return emptyRevenue();
  const cutoff = Math.floor((now.getTime() - 30 * DAY_MS) / 1000);
  const signal = AbortSignal.timeout(STRIPE_BUDGET_MS);
  try {
    const [active, createdInWindow, canceled] = await Promise.all([
      stripeList(key, { status: "active" }, signal),
      stripeList(key, { "created[gte]": String(cutoff), status: "all" }, signal),
      stripeList(key, { status: "canceled" }, signal),
    ]);
    const summary = summarizeRevenue({ active, createdInWindow, canceled, now });
    return { configured: true, ...summary };
  } catch {
    return {
      configured: true,
      mrrCad: null,
      active: { builder: 0, pro: 0, max: 0, other: 0 },
      newLast30d: null,
      canceledLast30d: null,
    };
  }
}

export async function loadAdminMetrics(now = new Date()): Promise<AdminMetrics> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  since.setUTCDate(since.getUTCDate() - 29);
  const [users, generations, revenue] = await Promise.all([
    storage.countUsers(now),
    storage.generationSummary(since.toISOString()),
    fetchRevenue(now),
  ]);
  return {
    users,
    generations: {
      total: generations.total,
      success: generations.success,
      failed: generations.failed,
      since: generations.firstAt ? generations.firstAt.slice(0, 10) : null,
      days: bucketGenerationDays(generations.rows, now),
    },
    revenue,
  };
}
