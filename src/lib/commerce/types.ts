/** Typed catalog + order records for the agent-ready store eject. */

export type OrderChannel = "chatgpt" | "gemini" | "copilot" | "human";

export const ORDER_CHANNELS: OrderChannel[] = [
  "chatgpt",
  "gemini",
  "copilot",
  "human",
];

export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  images: string[];
  /** Minor units (cents). */
  price: number;
  currency: "usd" | "cad";
  inventory: number;
  gtin: string;
  brand: string;
  sku: string;
}

export interface StorePolicyUrls {
  privacy: string;
  refund: string;
  shipping: string;
}

export interface StoreCatalog {
  merchant: string;
  brand: string;
  description: string;
  products: StoreProduct[];
  policies: StorePolicyUrls;
}

export interface StoreOrder {
  id: string;
  createdAt: string;
  channel: OrderChannel;
  sku: string;
  title: string;
  quantity: number;
  amount: number;
  currency: string;
  status: "open" | "paid" | "stub";
  agent?: string;
  /** Shared Payment Token — logged, not captured (v0). */
  spt?: string;
}

export const UCP_VERSION = "2026-01-23";
