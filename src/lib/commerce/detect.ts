/** Detect agent-ready store ship from generated source / title / explicit flag. */

export function wantsCommerceShip(opts: {
  code?: string | null;
  title?: string | null;
  commerce?: boolean | null;
}): boolean {
  if (opts.commerce) return true;
  const blob = `${opts.title || ""}\n${opts.code || ""}`;
  if (!blob.trim()) return false;
  if (/@\/lib\/catalog\b/.test(blob)) return true;
  if (/@\/lib\/commerce\b/.test(blob)) return true;
  if (/well-known\/ucp|dev\.ucp\.shopping/i.test(blob)) return true;
  if (/agent-ready store/i.test(blob)) return true;
  if (/\bsearch_products\b/.test(blob) && /\bcreate_checkout_session\b/.test(blob)) {
    return true;
  }
  return false;
}
