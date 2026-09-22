/**
 * Guided "Start a store" brief. Serializes merchant products into a
 * PRODUCTS = [...] literal that extractProductsArrayLiteral already parses.
 */
import type { StoreProduct } from "./types";

export const STORE_AUTOGEN_KEY = "shipboard.store.autogen";

export const STORE_VIBES = [
  { id: "minimal", label: "Minimal Swiss", designStyle: "minimal" as const },
  { id: "bold", label: "Bold", designStyle: "brutal" as const },
  { id: "playful", label: "Playful", designStyle: "playful" as const },
] as const;

export type StoreVibeId = (typeof STORE_VIBES)[number]["id"];
export type StoreDesignStyle = (typeof STORE_VIBES)[number]["designStyle"];

export interface StoreBriefProduct {
  name: string;
  priceCents: number;
  description: string;
}

export interface StoreBrief {
  storeName: string;
  tagline: string;
  vibe: StoreVibeId;
  designStyle: StoreDesignStyle;
  products: StoreBriefProduct[];
}

export interface StoreAutogenPayload {
  sessionId: string;
  prompt: string;
  designStyle: StoreDesignStyle;
  storeBrief: StoreBrief;
}

export class StoreBriefError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "StoreBriefError";
    this.fields = fields;
  }
}

export function parsePriceToCents(raw: unknown): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) {
      throw new StoreBriefError("Price must be a number greater than 0");
    }
    if (Number.isInteger(raw) && raw >= 1000) return raw;
    return Math.round(raw * 100);
  }
  if (typeof raw === "string") {
    const s = raw.trim().replace(/^\$/, "").replace(/,/g, "");
    if (!s) throw new StoreBriefError("Price is required");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      throw new StoreBriefError("Price must be a number greater than 0");
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) {
      throw new StoreBriefError("Price must be a number greater than 0");
    }
    if (!s.includes(".") && Number.isInteger(n) && n >= 1000) return n;
    return Math.round(n * 100);
  }
  throw new StoreBriefError("Price must be a number greater than 0");
}

export function slugifySku(name: string, used: Set<string>): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 12) || "ITEM";
  let sku = base;
  let n = 2;
  while (used.has(sku)) {
    const suffix = `-${n++}`;
    sku = `${base.slice(0, Math.max(1, 12 - suffix.length))}${suffix}`;
  }
  used.add(sku);
  return sku;
}

export function slugifyId(name: string, used: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "product";
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n++}`;
  }
  used.add(id);
  return id;
}

function fakeGtin(sku: string): string {
  let h = 2166136261;
  for (let i = 0; i < sku.length; i++) {
    h ^= sku.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = Math.abs(h) % 1_000_000_000_000;
  return `2${String(n).padStart(12, "0")}`;
}

export function vibeToDesignStyle(vibe: string | undefined): StoreDesignStyle {
  const row = STORE_VIBES.find((v) => v.id === vibe);
  return row?.designStyle ?? "minimal";
}

export function parseStoreVibe(raw: unknown): StoreVibeId {
  const s = String(raw || "minimal").toLowerCase();
  if (s === "bold" || s === "brutal") return "bold";
  if (s === "playful") return "playful";
  return "minimal";
}

export function catalogProductsFromBrief(brief: StoreBrief): StoreProduct[] {
  const skus = new Set<string>();
  const ids = new Set<string>();
  return brief.products.map((p) => {
    const sku = slugifySku(p.name, skus);
    return {
      id: slugifyId(p.name, ids),
      sku,
      title: p.name,
      description: p.description || p.name,
      images: [],
      price: p.priceCents,
      currency: "usd",
      inventory: 24,
      gtin: fakeGtin(sku),
      brand: brief.storeName,
    };
  });
}

export function productsLiteral(brief: StoreBrief): string {
  return JSON.stringify(catalogProductsFromBrief(brief), null, 2);
}

export function buildStoreBrief(input: {
  storeName?: unknown;
  tagline?: unknown;
  vibe?: unknown;
  products?: unknown;
}): StoreBrief {
  const fields: Record<string, string> = {};
  const storeName = String(input.storeName ?? "").trim();
  if (!storeName) fields.storeName = "Store name is required";

  const tagline = String(input.tagline ?? "").trim();
  const vibe = parseStoreVibe(input.vibe);

  const rawProducts = Array.isArray(input.products) ? input.products : [];
  const products: StoreBriefProduct[] = [];
  rawProducts.forEach((row, i) => {
    const rec = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const name = String(rec.name ?? rec.title ?? "").trim();
    const description = String(rec.description ?? "").trim();
    const priceRaw = rec.priceCents ?? rec.price;
    if (!name && (priceRaw === undefined || priceRaw === "" || priceRaw === null)) {
      return;
    }
    if (!name) {
      fields[`products.${i}.name`] = "Product name is required";
      return;
    }
    try {
      const priceCents = parsePriceToCents(priceRaw);
      products.push({ name, priceCents, description });
    } catch (err) {
      fields[`products.${i}.price`] =
        err instanceof StoreBriefError ? err.message : "Price must be a number greater than 0";
    }
  });

  if (products.length < 1) {
    fields.products = "Add at least one product with a name and price";
  }

  if (Object.keys(fields).length) {
    throw new StoreBriefError(Object.values(fields)[0], fields);
  }

  return {
    storeName,
    tagline,
    vibe,
    designStyle: vibeToDesignStyle(vibe),
    products,
  };
}

export function buildStoreUserPrompt(brief: StoreBrief): string {
  const literal = productsLiteral(brief);
  const tag = brief.tagline ? `\nTagline: ${brief.tagline}` : "";
  return `Build a human storefront for ${brief.storeName} that fills the viewport on first paint.${tag}

Emit this catalog ONCE (src/Component.tsx or a sibling src/ file). Exact names and prices. No extra SKUs:

const PRODUCTS = ${literal};

Must include:
1. Sticky header: merchant mark "${brief.storeName}", Shop, Catalog, Admin orders link (/admin/orders).
2. Hero with an <h1> using the store name${brief.tagline ? ` and tagline "${brief.tagline}"` : ""}. No fake testimonials.
3. Product grid of PRODUCTS (inline SVG, title, display price via formatMoney, inventory). Clicking a card opens a detail panel (title, description, GTIN, brand, quantity stepper, Buy). Do not render a <Product /> component unless you also emit function Product().
4. Buy calls createCheckoutSession({ sku, quantity, channel: "human" }). If url is returned, assign window.location; if preview returns null/preview, show "Checkout attaches on eject".
5. Query ?channel=chatgpt|gemini|copilot|human is passed through to checkout.
6. Footer links to /policies/privacy, /policies/refund, /policies/shipping.

Do not use /products/*.svg placeholder images. Inline SVG only. Multi-file: Header, ProductGrid, ProductDetail, Footer, Component. function Component(). No lorem.`;
}
