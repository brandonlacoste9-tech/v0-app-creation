import type { StoreCatalog } from "./types";

/** Default catalog compiled into every Agent-ready store eject. */
export const DEFAULT_CATALOG: StoreCatalog = {
  merchant: "Northline Supply",
  brand: "Northline",
  description:
    "Field goods for people who still write things down. One catalog, human storefront and agent profile.",
  policies: {
    privacy: "/policies/privacy",
    refund: "/policies/refund",
    shipping: "/policies/shipping",
  },
  products: [
    {
      id: "field-notebook",
      sku: "NL-NB-01",
      title: "Field notebook",
      description:
        "A5 cloth-bound notebook, 120gsm cream paper, numbered pages. Made to be thrown in a bag.",
      images: ["/products/field-notebook.svg"],
      price: 2800,
      currency: "usd",
      inventory: 48,
      gtin: "0199999000011",
      brand: "Northline",
    },
    {
      id: "camp-blanket",
      sku: "NL-BL-02",
      title: "Camp blanket",
      description:
        "Heavy wool throw, charcoal herringbone. Camp, sofa, or the back of a chair that never stays empty.",
      images: ["/products/camp-blanket.svg"],
      price: 12000,
      currency: "usd",
      inventory: 18,
      gtin: "0199999000028",
      brand: "Northline",
    },
    {
      id: "brass-lamp",
      sku: "NL-LP-03",
      title: "Brass desk lamp",
      description:
        "Weighted brass base, linen shade, dimmable LED. Built to sit on a real desk, not a render.",
      images: ["/products/brass-lamp.svg"],
      price: 8600,
      currency: "usd",
      inventory: 12,
      gtin: "0199999000035",
      brand: "Northline",
    },
    {
      id: "canvas-tote",
      sku: "NL-TT-04",
      title: "Canvas tote",
      description:
        "16oz canvas, bar-tack handles, one interior pocket. Holds a notebook, a laptop, and the day.",
      images: ["/products/canvas-tote.svg"],
      price: 4200,
      currency: "usd",
      inventory: 64,
      gtin: "0199999000042",
      brand: "Northline",
    },
  ],
};

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
