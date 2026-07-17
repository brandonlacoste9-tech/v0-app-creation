/**
 * Promo codes that unlock Pro (120 gens/day, all providers, brand kit).
 * - Hardcoded founder codes always work
 * - Plus any codes in PROMO_CODES env (comma-separated)
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

export function getValidProCodes(): Set<string> {
  const codes = new Set<string>(BUILTIN_PRO_CODES.map((c) => c.toUpperCase()));
  const fromEnv = process.env.PROMO_CODES || "";
  for (const raw of fromEnv.split(",")) {
    const c = raw.trim().toUpperCase();
    if (c) codes.add(c);
  }
  return codes;
}

export function isValidProCode(code: string): boolean {
  const normalized = (code || "").toUpperCase().trim().replace(/\s+/g, "-");
  const codes = getValidProCodes();
  if (codes.has(normalized)) return true;
  // Allow underscore/hyphen variants
  if (codes.has(normalized.replace(/-/g, "_"))) return true;
  if (codes.has(normalized.replace(/_/g, "-"))) return true;
  return false;
}
