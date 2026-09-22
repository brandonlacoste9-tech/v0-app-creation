/**
 * Promo codes that unlock Pro (120 gens/day, all providers, brand kit).
 *
 * Production: only codes listed in PROMO_CODES env (comma-separated).
 * Dev / ALLOW_BUILTIN_PROMO_CODES=1: also accepts founder builtins below.
 *
 * QA / probe bypass: QA_UNLOCK_CODE (or SHIPBOARD_QA_CODE) — not listed here,
 * not shown in the UI. Grants Max (unlimited gens + projects) without sign-in.
 * Unset the env var to disable. Must be ≥16 chars.
 */
import { timingSafeEqual } from "node:crypto";
import type { PlanId } from "./plans";

const BUILTIN_PRO_CODES = [
  "ADGEN-FOUNDER",
  "ADGEN_FOUNDER",
  "ADGEN_SAAS_PRO",
  "ANTIGRAVITY_FREE",
  "NORTH-PRO",
  "NORTH_PRO",
  "KEEP-BUILDING",
  "KEEP_BUILDING",
] as const;

/** Probe header — same secret as QA_UNLOCK_CODE. Not advertised on marketing pages. */
export const QA_UNLOCK_HEADER = "x-shipboard-qa";

function allowBuiltinCodes(): boolean {
  if (process.env.ALLOW_BUILTIN_PROMO_CODES === "1") return true;
  if (process.env.ALLOW_BUILTIN_PROMO_CODES === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function getValidProCodes(): Set<string> {
  const codes = new Set<string>();
  const fromEnv = process.env.PROMO_CODES || "";
  for (const raw of fromEnv.split(",")) {
    const c = raw.trim().toUpperCase();
    if (c) codes.add(c);
  }
  if (allowBuiltinCodes()) {
    for (const c of BUILTIN_PRO_CODES) {
      codes.add(c.toUpperCase());
    }
  }
  return codes;
}

export function isValidProCode(code: string): boolean {
  const normalized = (code || "").toUpperCase().trim().replace(/\s+/g, "-");
  if (!normalized) return false;
  const codes = getValidProCodes();
  if (codes.size === 0) return false;
  if (codes.has(normalized)) return true;
  if (codes.has(normalized.replace(/-/g, "_"))) return true;
  if (codes.has(normalized.replace(/_/g, "-"))) return true;
  return false;
}

export function getQaUnlockSecret(): string {
  return (
    process.env.QA_UNLOCK_CODE?.trim() ||
    process.env.SHIPBOARD_QA_CODE?.trim() ||
    ""
  );
}

export function isQaUnlockEnabled(): boolean {
  return getQaUnlockSecret().length >= 16;
}

export function isQaUnlockCode(code: string): boolean {
  const expected = getQaUnlockSecret();
  if (expected.length < 16) return false;
  const a = Buffer.from((code || "").trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function qaUnlockFromRequest(req: Request): boolean {
  return isQaUnlockCode(req.headers.get(QA_UNLOCK_HEADER) || "");
}

export type PromoGrant = {
  plan: Extract<PlanId, "pro" | "max">;
  kind: "pro" | "qa";
};

/** Resolve a pasted / header code to a plan grant. QA wins over Pro list. */
export function resolvePromoGrant(code: string): PromoGrant | null {
  if (isQaUnlockCode(code)) return { plan: "max", kind: "qa" };
  if (isValidProCode(code)) return { plan: "pro", kind: "pro" };
  return null;
}
