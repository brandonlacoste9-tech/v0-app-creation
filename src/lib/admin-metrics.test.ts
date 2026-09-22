/**
 * Run: npx tsx src/lib/admin-metrics.test.ts
 */
import {
  bucketGenerationDays,
  countUsersByCreatedAt,
  sinceLabel,
  summarizeRevenue,
  type StripeSubLike,
} from "./admin-metrics";
import { isOwnerUser } from "./owner-access";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-09-22T15:00:00.000Z");
const tiers = {
  builder: { id: "price_builder", cad: 15 },
  pro: { id: "price_pro", cad: 25 },
  max: { id: "price_max", cad: 45 },
};

{
  const prev = process.env.OWNER_USER_IDS;
  process.env.OWNER_USER_IDS = " owner-a , owner-b ";
  assert(isOwnerUser("owner-a"), "owner a");
  assert(isOwnerUser("owner-b"), "owner b");
  assert(!isOwnerUser("someone-else"), "non-owner");
  assert(!isOwnerUser(null), "signed out");
  assert(!isOwnerUser(""), "empty id");
  process.env.OWNER_USER_IDS = "";
  assert(!isOwnerUser("owner-a"), "empty allowlist is nobody");
  process.env.OWNER_USER_IDS = prev;
}

{
  const counts = countUsersByCreatedAt(
    [
      "2026-09-22T12:00:00.000Z",
      "2026-09-18T12:00:00.000Z",
      "2026-08-30T12:00:00.000Z",
      "2026-01-01T12:00:00.000Z",
    ],
    now
  );
  assert(counts.total === 4, "total users");
  assert(counts.last7d === 2, "users in 7d");
  assert(counts.last30d === 3, "users in 30d");
}

{
  const days = bucketGenerationDays(
    [
      { day: "2026-09-22", status: "success", n: 2 },
      { day: "2026-09-22", status: "failed", n: 1 },
      { day: "2026-08-01", status: "success", n: 9 },
    ],
    now
  );
  assert(days.length === 30, "30 day chart");
  assert(days[0].date === "2026-08-24", "chart starts 29 days back");
  assert(days[29].date === "2026-09-22", "chart ends today");
  assert(days[29].success === 2 && days[29].failed === 1, "today buckets");
  assert(days.every((day) => day.date !== "2026-08-01"), "old day is outside the window");
  assert(sinceLabel(null) === "No generations logged yet", "empty label");
  assert(sinceLabel("2026-09-22") === "since 2026-09-22", "since label");
}

{
  const active: StripeSubLike[] = [
    {
      status: "active",
      items: {
        data: [
          {
            quantity: 1,
            price: {
              id: "price_builder",
              unit_amount: 1500,
              currency: "cad",
              recurring: { interval: "month" },
            },
          },
        ],
      },
      discount: { coupon: { percent_off: 10 } },
    },
    {
      status: "active",
      items: {
        data: [
          {
            quantity: 1,
            price: {
              id: "price_pro",
              unit_amount: 2500,
              currency: "cad",
              recurring: { interval: "month" },
            },
          },
        ],
      },
    },
    {
      status: "active",
      items: {
        data: [
          {
            quantity: 1,
            price: {
              id: "price_max",
              unit_amount: 4500,
              currency: "cad",
              recurring: { interval: "month" },
            },
          },
        ],
      },
    },
  ];
  const recent = Math.floor((now.getTime() - 10 * 24 * 60 * 60 * 1000) / 1000);
  const old = Math.floor((now.getTime() - 40 * 24 * 60 * 60 * 1000) / 1000);
  const summary = summarizeRevenue(
    {
      active,
      createdInWindow: [{ created: recent }, { created: old }],
      canceled: [{ canceled_at: recent }, { canceled_at: old }],
      now,
    },
    tiers
  );
  assert(summary.active.builder === 1, "builder");
  assert(summary.active.pro === 1, "pro");
  assert(summary.active.max === 1, "max");
  assert(summary.mrrCad === 13.5 + 25 + 45, "mrr after 10% builder discount");
  assert(summary.newLast30d === 1, "new sub inside the window");
  assert(summary.canceledLast30d === 1, "canceled inside the window");
  const serialized = JSON.stringify(summary);
  assert(!serialized.includes("sk_"), "aggregates do not carry a stripe key");
  assert(!serialized.includes("price_"), "aggregates do not carry price ids");
}

console.log("admin-metrics tests: all passed");
