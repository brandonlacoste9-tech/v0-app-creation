/**
 * Wizard catalog is the single source of truth for attach, preview, and assets.
 * No silent fallback to the Northline placeholder set.
 */
import {
  catalogProductsFromBrief,
  productsLiteral,
  STORE_AUTOGEN_KEY,
  type StoreAutogenPayload,
  type StoreBrief,
} from "./store-brief";
import type { StoreProduct } from "./types";

export const STORE_BRIEF_KEY = "shipboard.store.brief";

export class MissingMerchantCatalogError extends Error {
  constructor(
    message = "Wizard products are required — refusing the default/placeholder catalog"
  ) {
    super(message);
    this.name = "MissingMerchantCatalogError";
  }
}

let memoryBrief: StoreBrief | null = null;

export function setWizardStoreBrief(brief: StoreBrief | null): void {
  memoryBrief = brief;
  if (typeof sessionStorage === "undefined") return;
  try {
    if (brief && brief.products.length) {
      sessionStorage.setItem(STORE_BRIEF_KEY, JSON.stringify(brief));
    }
  } catch {
    /* private mode */
  }
}

export function readWizardStoreBrief(): StoreBrief | null {
  if (memoryBrief?.products?.length) return memoryBrief;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const direct = sessionStorage.getItem(STORE_BRIEF_KEY);
    if (direct) {
      const parsed = JSON.parse(direct) as StoreBrief;
      if (parsed?.products?.length) {
        memoryBrief = parsed;
        return parsed;
      }
    }
    const wrapped = sessionStorage.getItem(STORE_AUTOGEN_KEY);
    if (wrapped) {
      const payload = JSON.parse(wrapped) as StoreAutogenPayload;
      if (payload?.storeBrief?.products?.length) {
        memoryBrief = payload.storeBrief;
        return payload.storeBrief;
      }
    }
  } catch {
    return memoryBrief;
  }
  return memoryBrief;
}

export function requireWizardProducts(brief: StoreBrief): StoreBrief {
  if (!brief.products.length) throw new MissingMerchantCatalogError();
  return brief;
}

const FILLS = ["#8a7a62", "#c4b7a6", "#5c6b73", "#b08d57", "#3f3a36", "#6e7f6b"];

export function svgProductAsset(fill: string, mark: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
  <rect width="640" height="800" fill="${fill}"/>
  <rect x="48" y="48" width="544" height="704" fill="none" stroke="#f4efe8" stroke-width="2" opacity="0.4"/>
  <text x="320" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#f4efe8">${mark}</text>
</svg>
`;
}

export function productAssetFiles(
  products: Array<{ id: string; title?: string }>
): Array<{ path: string; content: string }> {
  return products.map((p, i) => {
    const mark =
      (p.title || p.id || "P").replace(/[^A-Za-z0-9]+/g, "").slice(0, 2).toUpperCase() ||
      "P";
    return {
      path: `public/products/${p.id}.svg`,
      content: svgProductAsset(FILLS[i % FILLS.length], mark),
    };
  });
}

export function catalogAssetIds(
  files: Array<{ path: string }>
): string[] {
  return files
    .filter((f) => f.path.startsWith("public/products/") && f.path.endsWith(".svg"))
    .map((f) => f.path.slice("public/products/".length, -".svg".length))
    .sort();
}

export function wizardProductsLiteral(brief: StoreBrief): string {
  const products = catalogProductsFromBrief(brief).map((p) => ({
    ...p,
    images: p.images?.length ? p.images : [`/products/${p.id}.svg`],
  }));
  return JSON.stringify(products, null, 2);
}

export function resolveAttachBrief(
  explicit?: StoreBrief | null
): StoreBrief | null {
  if (explicit?.products?.length) return explicit;
  if (explicit && explicit.products.length === 0) {
    throw new MissingMerchantCatalogError();
  }
  return readWizardStoreBrief();
}

export function productsFromBrief(brief: StoreBrief): StoreProduct[] {
  return catalogProductsFromBrief(requireWizardProducts(brief)).map((p) => ({
    ...p,
    images: p.images?.length ? p.images : [`/products/${p.id}.svg`],
  }));
}

export { productsLiteral };
