/**
 * Promo codes that unlock Pro (120 gens/day, all providers, brand kit).
 *
 * Production: only codes listed in PROMO_CODES env (comma-separated).
 * Dev / ALLOW_BUILTIN_PROMO_CODES=1: also accepts founder builtins below.
 */

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
  // Allow underscore/hyphen variants
  if (codes.has(normalized.replace(/-/g, "_"))) return true;
  if (codes.has(normalized.replace(/_/g, "-"))) return true;
  return false;
}
