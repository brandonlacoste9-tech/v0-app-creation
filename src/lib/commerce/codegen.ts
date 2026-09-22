/**
 * Deterministic Agent-ready store ship files.
 * Reuses the existing Ready-to-ship gate — these files are appended on eject.
 */
import { DEFAULT_CATALOG } from "./catalog";
import { UCP_VERSION, type StoreCatalog } from "./types";

export type ProjectFile = { path: string; content: string };

function file(path: string, content: string): ProjectFile {
  return { path, content: content.endsWith("\n") ? content : content + "\n" };
}

export function commercePackageDependencies(): Record<string, string> {
  return { stripe: "^18.0.0", pg: "^8.16.3" };
}

export function commerceEnvExample(): string {
  return `# Agent-ready store
# DATABASE_URL=postgresql://user:password@host/db?sslmode=require
# STRIPE_SECRET_KEY=sk_test_...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# NEXT_PUBLIC_STORE_URL=https://your-store.netlify.app
# Without DATABASE_URL, orders live in memory and vanish on cold start.
# ACP stub logs the Shared Payment Token — it does not capture the charge.
`;
}

function catalogJsonWithProducts(
  catalog: StoreCatalog,
  productsLiteral?: string | null
): string {
  const lit = productsLiteral?.trim();
  if (!lit || !lit.startsWith("[")) return JSON.stringify(catalog, null, 2);
  const json = JSON.stringify({ ...catalog, products: [] }, null, 2);
  return json.replace('"products": []', `"products": ${lit}`);
}

const STORE_ORDERS_DDL = `create table if not exists store_orders (
  id text primary key,
  created_at timestamptz not null default now(),
  channel text not null,
  sku text not null,
  title text not null,
  quantity integer not null,
  amount integer not null,
  currency text not null,
  status text not null,
  agent text,
  spt text
);
create index if not exists store_orders_created_at_idx on store_orders (created_at desc);`;

function ordersModuleSource(): string {
  return `import { randomUUID } from "node:crypto";
import type { OrderChannel, StoreOrder } from "./commerce-types";

const DDL = ${JSON.stringify(STORE_ORDERS_DDL)};

type G = typeof globalThis & {
  __storeOrders?: StoreOrder[];
  __storePool?: import("pg").Pool;
  __storeReady?: Promise<void>;
};
const g = globalThis as G;
if (!g.__storeOrders) g.__storeOrders = [];

function databaseUrl(): string {
  return (process.env.DATABASE_URL || "").trim();
}

async function getPool(): Promise<import("pg").Pool | null> {
  const url = databaseUrl();
  if (!url) return null;
  if (!g.__storePool) {
    const { Pool } = await import("pg");
    g.__storePool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return g.__storePool;
}

async function ensureTable(): Promise<import("pg").Pool | null> {
  const pool = await getPool();
  if (!pool) return null;
  if (!g.__storeReady) {
    g.__storeReady = pool.query(DDL).then(() => undefined);
  }
  await g.__storeReady;
  return pool;
}

function toOrder(row: {
  id: string;
  created_at: string | Date;
  channel: OrderChannel;
  sku: string;
  title: string;
  quantity: number;
  amount: number;
  currency: string;
  status: StoreOrder["status"];
  agent: string | null;
  spt: string | null;
}): StoreOrder {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at);
  return {
    id: row.id,
    createdAt,
    channel: row.channel,
    sku: row.sku,
    title: row.title,
    quantity: Number(row.quantity),
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    agent: row.agent || undefined,
    spt: row.spt || undefined,
  };
}

export async function listOrders(limit = 20): Promise<StoreOrder[]> {
  const cap = Math.max(1, Math.min(100, Number(limit) || 20));
  const pool = await ensureTable();
  if (!pool) return (g.__storeOrders || []).slice(0, cap);
  const res = await pool.query(
    "select id, created_at, channel, sku, title, quantity, amount, currency, status, agent, spt from store_orders order by created_at desc limit $1",
    [cap]
  );
  return res.rows.map(toOrder);
}

export async function getOrder(id: string): Promise<StoreOrder | null> {
  const pool = await ensureTable();
  if (!pool) {
    return (g.__storeOrders || []).find((o) => o.id === id) || null;
  }
  const res = await pool.query(
    "select id, created_at, channel, sku, title, quantity, amount, currency, status, agent, spt from store_orders where id = $1 limit 1",
    [id]
  );
  return res.rows[0] ? toOrder(res.rows[0]) : null;
}

export async function createOrder(input: {
  channel: OrderChannel;
  sku: string;
  title: string;
  quantity: number;
  amount: number;
  currency: string;
  status?: StoreOrder["status"];
  agent?: string;
  spt?: string;
}): Promise<StoreOrder> {
  const order: StoreOrder = {
    id: "ord_" + randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    channel: input.channel,
    sku: input.sku,
    title: input.title,
    quantity: input.quantity,
    amount: input.amount,
    currency: input.currency,
    status: input.status || "open",
    agent: input.agent,
    spt: input.spt,
  };
  const pool = await ensureTable();
  if (!pool) {
    g.__storeOrders = [order, ...(g.__storeOrders || [])].slice(0, 100);
    return order;
  }
  await pool.query(
    "insert into store_orders (id, created_at, channel, sku, title, quantity, amount, currency, status, agent, spt) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      order.id,
      order.createdAt,
      order.channel,
      order.sku,
      order.title,
      order.quantity,
      order.amount,
      order.currency,
      order.status,
      order.agent ?? null,
      order.spt ?? null,
    ]
  );
  return order;
}
`;
}

export function buildCommerceShipFiles(opts?: {
  catalog?: StoreCatalog | null;
  title?: string;
  /** Merchant PRODUCTS array literal — overrides DEFAULT_CATALOG.products */
  productsLiteral?: string | null;
}): ProjectFile[] {
  const base = opts?.catalog || DEFAULT_CATALOG;
  const catalog: StoreCatalog = {
    ...base,
    merchant: opts?.title?.trim() || base.merchant,
    brand: opts?.title?.trim() || base.brand,
  };
  const catalogJson = catalogJsonWithProducts(catalog, opts?.productsLiteral);
  const merchant = catalog.merchant;

  return [
    file(
      "lib/catalog.ts",
      `import type { StoreCatalog, StoreProduct } from "./commerce-types";

export const CATALOG: StoreCatalog = ${catalogJson} as StoreCatalog;

export const PRODUCTS: StoreProduct[] = CATALOG.products;

export function getProduct(id: string): StoreProduct | null {
  const key = String(id || "").toLowerCase();
  return (
    PRODUCTS.find(
      (p) =>
        p.id === id ||
        p.sku.toLowerCase() === key ||
        p.gtin === id
    ) || null
  );
}

export function searchProducts(query?: string): StoreProduct[] {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return PRODUCTS;
  return PRODUCTS.filter((p) =>
    [p.title, p.description, p.brand, p.sku, p.id].join(" ").toLowerCase().includes(q)
  );
}

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
`
    ),
    file(
      "lib/commerce-types.ts",
      `export type OrderChannel = "chatgpt" | "gemini" | "copilot" | "human";

export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  images: string[];
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
  spt?: string;
}

export const UCP_VERSION = ${JSON.stringify(UCP_VERSION)};
`
    ),
    file(
      "lib/channel.ts",
      `import type { OrderChannel } from "./commerce-types";

const CHANNELS: OrderChannel[] = ["chatgpt", "gemini", "copilot", "human"];

function asChannel(raw: string | null | undefined): OrderChannel | null {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "openai" || v === "chat.openai.com" || v === "chatgpt.com") return "chatgpt";
  if (v === "google" || v === "bard") return "gemini";
  if (v === "microsoft" || v === "bing") return "copilot";
  return (CHANNELS as string[]).includes(v) ? (v as OrderChannel) : null;
}

export function detectChannel(req: Request, body?: Record<string, unknown> | null): OrderChannel {
  const url = new URL(req.url);
  const q =
    asChannel(url.searchParams.get("channel")) ||
    asChannel(url.searchParams.get("utm_source"));
  if (q) return q;

  const bodyCh = asChannel(
    body && typeof body.channel === "string" ? body.channel : undefined
  );
  if (bodyCh) return bodyCh;

  const agent = req.headers.get("ucp-agent") || req.headers.get("x-ucp-agent") || "";
  const agentLower = agent.toLowerCase();
  if (agentLower.includes("chatgpt") || agentLower.includes("openai")) return "chatgpt";
  if (agentLower.includes("gemini") || agentLower.includes("google")) return "gemini";
  if (agentLower.includes("copilot") || agentLower.includes("microsoft")) return "copilot";

  const ref = (req.headers.get("referer") || "").toLowerCase();
  if (ref.includes("chatgpt.com") || ref.includes("chat.openai.com")) return "chatgpt";
  if (ref.includes("gemini.google.com")) return "gemini";
  if (ref.includes("copilot.microsoft.com")) return "copilot";

  return "human";
}
`
    ),
    file("lib/orders.ts", ordersModuleSource()),
    file(
      "lib/checkout.ts",
      `import { getProduct } from "./catalog";
import { createOrder } from "./orders";
import type { OrderChannel } from "./commerce-types";

export async function createCheckoutSession(input: {
  sku: string;
  quantity?: number;
  channel?: OrderChannel;
  origin?: string;
}): Promise<{ id: string; url: string; orderId: string; stub: boolean }> {
  const product = getProduct(input.sku);
  if (!product) throw new Error("Unknown product");
  const quantity = Math.max(1, Math.min(99, Number(input.quantity) || 1));
  const amount = product.price * quantity;
  const origin = (input.origin || process.env.NEXT_PUBLIC_STORE_URL || "").replace(/\\/$/, "");
  const secret = process.env.STRIPE_SECRET_KEY?.trim();

  if (secret) {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: product.currency,
            unit_amount: product.price,
            product_data: { name: product.title, images: product.images.slice(0, 1) },
          },
        },
      ],
      success_url: origin + "/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/",
      metadata: {
        sku: product.sku,
        channel: input.channel || "human",
      },
    });
    const order = await createOrder({
      channel: input.channel || "human",
      sku: product.sku,
      title: product.title,
      quantity,
      amount,
      currency: product.currency,
      status: "open",
    });
    return { id: session.id, url: session.url || "/checkout/success", orderId: order.id, stub: false };
  }

  const order = await createOrder({
    channel: input.channel || "human",
    sku: product.sku,
    title: product.title,
    quantity,
    amount,
    currency: product.currency,
    status: "stub",
  });
  const url =
    (origin || "") +
    "/checkout/success?order=" +
    order.id +
    "&channel=" +
    (input.channel || "human");
  return { id: "cs_stub_" + order.id, url, orderId: order.id, stub: true };
}
`
    ),
    file(
      "lib/ucp.ts",
      `import { CATALOG, PRODUCTS, formatMoney } from "./catalog";
import { UCP_VERSION } from "./commerce-types";

export function buildUcpProfile(origin: string) {
  const base = origin.replace(/\\/$/, "");
  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        "dev.ucp.shopping": [
          {
            version: UCP_VERSION,
            spec: "https://ucp.dev/specification/overview",
            transport: "rest",
            endpoint: base + "/ucp/v1",
            schema: "https://ucp.dev/" + UCP_VERSION + "/services/shopping/openapi.json",
          },
          {
            version: UCP_VERSION,
            spec: "https://ucp.dev/specification/overview",
            transport: "mcp",
            endpoint: base + "/mcp",
            schema: "https://ucp.dev/" + UCP_VERSION + "/services/shopping/mcp.json",
          },
        ],
      },
      capabilities: {
        "dev.ucp.shopping.checkout": [
          {
            version: UCP_VERSION,
            spec: "https://ucp.dev/specification/checkout",
            schema: "https://ucp.dev/" + UCP_VERSION + "/schemas/shopping/checkout.json",
          },
        ],
        "dev.ucp.shopping.order": [
          {
            version: UCP_VERSION,
            spec: "https://ucp.dev/specification/order",
            schema: "https://ucp.dev/" + UCP_VERSION + "/schemas/shopping/order.json",
          },
        ],
      },
      payment_handlers: {
        "com.stripe": [
          {
            id: "stripe",
            version: UCP_VERSION,
            spec: "https://docs.stripe.com/agentic-commerce",
            schema: "https://docs.stripe.com/agentic-commerce/schema.json",
            config: {
              environment: process.env.STRIPE_SECRET_KEY ? "production" : "sandbox",
              checkout: base + "/api/checkout",
              acp_checkout_sessions: base + "/api/acp/checkout-sessions",
            },
          },
        ],
      },
    },
    merchant: {
      name: CATALOG.merchant,
      brand: CATALOG.brand,
      description: CATALOG.description,
      policies: CATALOG.policies,
    },
    products: PRODUCTS.map((p) => ({
      id: p.id,
      sku: p.sku,
      title: p.title,
      description: p.description,
      price: p.price,
      currency: p.currency,
      display_price: formatMoney(p.price, p.currency),
      inventory: p.inventory,
      gtin: p.gtin,
      brand: p.brand,
      images: p.images.map((src) => (src.startsWith("http") ? src : base + src)),
      url: base + "/?sku=" + p.id,
      checkout: base + "/api/checkout?sku=" + encodeURIComponent(p.sku),
    })),
    checkout: {
      rest: base + "/api/checkout",
      acp: base + "/api/acp/checkout-sessions",
      mcp: base + "/mcp",
    },
  };
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, UCP-Agent, Authorization",
  "Cache-Control": "public, max-age=60",
};
`
    ),
    file(
      "app/.well-known/ucp/route.ts",
      `import { NextResponse } from "next/server";
import { buildUcpProfile, CORS } from "@/lib/ucp";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(buildUcpProfile(origin), { headers: CORS });
}
`
    ),
    file(
      "app/ucp/v1/products/route.ts",
      `import { NextResponse } from "next/server";
import { searchProducts, formatMoney } from "@/lib/catalog";
import { CORS } from "@/lib/ucp";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || url.searchParams.get("query") || "";
  const origin = url.origin;
  const products = searchProducts(q).map((p) => ({
    ...p,
    display_price: formatMoney(p.price, p.currency),
    url: origin + "/?sku=" + p.id,
    checkout: origin + "/api/checkout?sku=" + encodeURIComponent(p.sku),
  }));
  return NextResponse.json({ products }, { headers: CORS });
}
`
    ),
    file(
      "app/api/checkout/route.ts",
      `import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/checkout";
import { detectChannel } from "@/lib/channel";
import { CORS } from "@/lib/ucp";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const sku = String(body.sku || body.id || new URL(req.url).searchParams.get("sku") || "");
  const quantity = Number(body.quantity || 1);
  const channel = detectChannel(req, body);
  try {
    const session = await createCheckoutSession({
      sku,
      quantity,
      channel,
      origin: new URL(req.url).origin,
    });
    return NextResponse.json(session, { headers: CORS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku") || "";
  const quantity = Number(url.searchParams.get("quantity") || 1);
  const channel = detectChannel(req, { sku });
  try {
    const session = await createCheckoutSession({
      sku,
      quantity,
      channel,
      origin: url.origin,
    });
    return NextResponse.redirect(session.url, { headers: CORS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS });
  }
}
`
    ),
    file(
      "app/api/acp/checkout-sessions/route.ts",
      `import { NextResponse } from "next/server";
import { getProduct } from "@/lib/catalog";
import { createOrder, getOrder } from "@/lib/orders";
import { detectChannel } from "@/lib/channel";
import { CORS } from "@/lib/ucp";

/**
 * Agentic Commerce Protocol stub.
 * Logs the Shared Payment Token. v0 does not capture the charge.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const order = id ? await getOrder(id) : null;
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  return NextResponse.json({ checkout_session: order }, { headers: CORS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const payment = (body.payment || body.payment_method || {}) as Record<string, unknown>;
  const spt = String(
    payment.shared_payment_token ||
      payment.token ||
      body.shared_payment_token ||
      ""
  );
  const items = Array.isArray(body.line_items) ? body.line_items : [body];
  const first = items[0] || {};
  const sku = String(first.sku || first.id || body.sku || "");
  const quantity = Math.max(1, Number(first.quantity || body.quantity || 1));
  const product = getProduct(sku);
  if (!product) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400, headers: CORS });
  }
  const channel = detectChannel(req, body);
  if (spt) {
    console.info("[ACP] Shared Payment Token received (not captured)", {
      spt: spt.slice(0, 12) + "…",
      sku: product.sku,
      channel,
    });
  } else {
    console.info("[ACP] checkout-session without SPT", { sku: product.sku, channel });
  }
  const order = await createOrder({
    channel,
    sku: product.sku,
    title: product.title,
    quantity,
    amount: product.price * quantity,
    currency: product.currency,
    status: "stub",
    agent: channel === "human" ? undefined : channel,
    spt: spt ? spt.slice(0, 24) : undefined,
  });
  return NextResponse.json(
    {
      id: order.id,
      status: "requires_confirmation",
      payment_status: spt ? "token_logged_not_captured" : "unpaid",
      checkout_session: order,
      note: "v0 ACP stub — SPT logged, charge not captured.",
    },
    { headers: CORS }
  );
}
`
    ),
    file(
      "app/mcp/route.ts",
      `import { NextResponse } from "next/server";
import { searchProducts, getProduct, formatMoney } from "@/lib/catalog";
import { createCheckoutSession } from "@/lib/checkout";
import { getOrder } from "@/lib/orders";
import { detectChannel } from "@/lib/channel";
import { CORS } from "@/lib/ucp";

const TOOLS = [
  {
    name: "search_products",
    description: "Search the merchant catalog by free-text query.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "get_product",
    description: "Get one product by id, sku, or GTIN.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "create_checkout_session",
    description:
      "Open a checkout session for a sku. Humans get Stripe Checkout; agents may pass channel=chatgpt|gemini|copilot.",
    inputSchema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        quantity: { type: "number" },
        channel: { type: "string", enum: ["chatgpt", "gemini", "copilot", "human"] },
      },
      required: ["sku"],
    },
  },
  {
    name: "get_order",
    description: "Fetch an order by id, including channel attribution.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json(
    { protocol: "mcp", tools: TOOLS.map((t) => t.name) },
    { headers: CORS }
  );
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  req: Request
) {
  if (name === "search_products") {
    const rows = searchProducts(String(args.query || ""));
    return rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      title: p.title,
      price: formatMoney(p.price, p.currency),
      gtin: p.gtin,
      inventory: p.inventory,
    }));
  }
  if (name === "get_product") {
    const p = getProduct(String(args.id || args.sku || ""));
    if (!p) throw new Error("Product not found");
    return p;
  }
  if (name === "create_checkout_session") {
    const channel = detectChannel(req, args);
    return createCheckoutSession({
      sku: String(args.sku || args.id || ""),
      quantity: Number(args.quantity || 1),
      channel,
      origin: new URL(req.url).origin,
    });
  }
  if (name === "get_order") {
    const order = await getOrder(String(args.id || ""));
    if (!order) throw new Error("Order not found");
    return order;
  }
  throw new Error("Unknown tool: " + name);
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const method = String(body.method || "");
  const id = body.id ?? 1;

  if (method === "initialize" || method === "notifications/initialized") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: ${JSON.stringify(merchant)}, version: "0.1.0" },
          capabilities: { tools: {} },
        },
      },
      { headers: CORS }
    );
  }

  if (method === "tools/list" || method === "list_tools") {
    return NextResponse.json(
      { jsonrpc: "2.0", id, result: { tools: TOOLS } },
      { headers: CORS }
    );
  }

  if (method === "tools/call" || method === "call_tool") {
    const params = (body.params || {}) as Record<string, unknown>;
    const name = String(params.name || "");
    const args = (params.arguments || params.args || {}) as Record<string, unknown>;
    try {
      const result = await callTool(name, args, req);
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result) }] },
        },
        { headers: CORS }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tool failed";
      return NextResponse.json(
        { jsonrpc: "2.0", id, error: { code: -32000, message: msg } },
        { headers: CORS }
      );
    }
  }

  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } },
    { status: 400, headers: CORS }
  );
}
`
    ),
    file(
      "app/admin/orders/page.tsx",
      `import { listOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await listOrders(20);
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Last 20 orders</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Channel is written at checkout from query, UCP-Agent, or referrer.
        ChatGPT click-out → channel=chatgpt.
      </p>
      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-zinc-500" colSpan={5}>
                  No orders yet. Open /.well-known/ucp and POST /api/checkout.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 tabular-nums text-zinc-600">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium">{o.channel}</td>
                  <td className="px-3 py-2">
                    {o.sku}
                    <span className="mt-0.5 block text-[11px] text-zinc-500">{o.title}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{o.quantity}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoney(o.amount, o.currency)}
                    <span className="mt-0.5 block text-[11px] text-zinc-500">{o.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
`
    ),
    file(
      "app/checkout/success/page.tsx",
      `export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        ${merchant.replace(/`/g, "")}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Order received</h1>
      <p className="mt-3 text-sm text-zinc-600">
        If this was a ChatGPT click-out, the order row is tagged channel=chatgpt.
        Stripe charges only run when STRIPE_SECRET_KEY is set; the ACP stub never captures.
      </p>
      <p className="mt-8 text-sm">
        <a className="underline" href="/admin/orders">
          View orders
        </a>
      </p>
    </main>
  );
}
`
    ),
    file(
      "app/policies/privacy/page.tsx",
      policyPage("Privacy", "We keep orders so we can fulfill them. The catalog is public. Payment tokens are logged, not stored as card numbers.")
    ),
    file(
      "app/policies/refund/page.tsx",
      policyPage("Refunds", "Unused goods in original condition, 30 days. Contact the merchant from the order receipt.")
    ),
    file(
      "app/policies/shipping/page.tsx",
      policyPage("Shipping", "Ships from the workshop in 2–5 business days. Agents and humans get the same rates.")
    ),
    file("public/products/field-notebook.svg", svgRect("#c4b7a6", "NB")),
    file("public/products/camp-blanket.svg", svgRect("#3f3a36", "BL")),
    file("public/products/brass-lamp.svg", svgRect("#b08d57", "LP")),
    file("public/products/canvas-tote.svg", svgRect("#8a7a62", "TT")),
  ];
}

function policyPage(title: string, body: string): string {
  return `export default function Page() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">${title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600">${body}</p>
    </main>
  );
}
`;
}

function svgRect(fill: string, mark: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
  <rect width="640" height="800" fill="${fill}"/>
  <rect x="48" y="48" width="544" height="704" fill="none" stroke="#f4efe8" stroke-width="2" opacity="0.4"/>
  <text x="320" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#f4efe8">${mark}</text>
</svg>
`;
}
