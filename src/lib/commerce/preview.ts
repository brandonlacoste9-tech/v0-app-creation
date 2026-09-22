/**
 * Preview intercept for @/lib/catalog and @/lib/checkout so studio iframe
 * can mount the agent-ready store without a dual-path LLM dialect.
 *
 * Golden-path models often emit `PRODUCTS` without an import (or without the
 * catalog file). That used to crash first paint ("PRODUCTS is not defined").
 * We inject the catalog whenever the identifier is used and not defined.
 */
import { DEFAULT_CATALOG } from "./catalog";

const CATALOG_FROM =
  /import\s+[^;]+from\s+['"](?:@\/)?(?:\.\/|\.\.\/)*lib\/(?:catalog|checkout|commerce-types)['"];?\n?/g;

const INTERCEPT_MARK = "Shipboard Preview Intercept: catalog + checkout";

export function sourceReferencesCatalog(source: string): boolean {
  if (!source) return false;
  if (/@\/lib\/catalog|@\/lib\/checkout/.test(source)) return true;
  if (/\bcreateCheckoutSession\b/.test(source)) return true;
  if (/\bPRODUCTS\b/.test(source)) return true;
  if (/agent-ready store/i.test(source)) return true;
  return false;
}

export function catalogIsDefined(source: string): boolean {
  if (!source) return false;
  if (source.includes(INTERCEPT_MARK)) return true;
  return (
    /\b(?:const|let|var|function)\s+PRODUCTS\b/.test(source) ||
    /\bexport\s+const\s+PRODUCTS\b/.test(source)
  );
}

export function catalogPreviewSource(): string {
  const products = JSON.stringify(DEFAULT_CATALOG.products);
  const catalog = JSON.stringify({
    merchant: DEFAULT_CATALOG.merchant,
    brand: DEFAULT_CATALOG.brand,
    description: DEFAULT_CATALOG.description,
    policies: DEFAULT_CATALOG.policies,
  });
  return `/* ── ${INTERCEPT_MARK} ── */
var CATALOG = Object.assign(${catalog}, { products: ${products} });
var PRODUCTS = CATALOG.products;
function getProduct(id) {
  var key = String(id || "").toLowerCase();
  for (var i = 0; i < PRODUCTS.length; i++) {
    var p = PRODUCTS[i];
    if (p.id === id || String(p.sku).toLowerCase() === key || p.gtin === id) return p;
  }
  return null;
}
function searchProducts(query) {
  var q = String(query || "").trim().toLowerCase();
  if (!q) return PRODUCTS.slice();
  return PRODUCTS.filter(function (p) {
    return [p.title, p.description, p.brand, p.sku, p.id].join(" ").toLowerCase().indexOf(q) !== -1;
  });
}
function formatMoney(cents, currency) {
  currency = currency || "usd";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency).toUpperCase() }).format((cents || 0) / 100);
}
async function createCheckoutSession(input) {
  input = input || {};
  return {
    ok: true,
    preview: true,
    id: "cs_preview",
    url: null,
    message: "Stripe Checkout and /.well-known/ucp are attached on eject — same Ready-to-ship gate."
  };
}
`;
}

export function applyCatalogPreviewIntercept(source: string): {
  code: string;
  applied: boolean;
} {
  if (!sourceReferencesCatalog(source)) {
    return { code: source, applied: false };
  }
  const stripped = source.replace(CATALOG_FROM, "");
  if (catalogIsDefined(stripped)) {
    return { code: stripped, applied: true };
  }
  return { code: catalogPreviewSource() + "\n" + stripped, applied: true };
}
