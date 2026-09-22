import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAdminMetrics, sinceLabel, type GenerationDay } from "@/lib/admin-metrics";
import { getCurrentUser } from "@/lib/get-user";
import { isOwnerUser } from "@/lib/owner-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function money(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}

function GenerationChart({ days, since }: { days: GenerationDay[]; since: string | null }) {
  const peak = Math.max(1, ...days.map((day) => day.success + day.failed));
  return (
    <figure>
      <figcaption className="text-xs text-zinc-500">{sinceLabel(since)}</figcaption>
      <div
        className="mt-3 flex h-28 items-end gap-px"
        role="img"
        aria-label={`Generations by day, ${sinceLabel(since)}`}
      >
        {days.map((day) => {
          const ok = (day.success / peak) * 100;
          const bad = (day.failed / peak) * 100;
          return (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${day.date}: ${day.success} succeeded, ${day.failed} failed`}
            >
              {bad > 0 ? (
                <div className="w-full bg-red-400/80" style={{ height: `${bad}%` }} />
              ) : null}
              <div className="w-full bg-orange-400" style={{ height: `${ok}%` }} />
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isOwnerUser(user?.id)) notFound();

  const metrics = await loadAdminMetrics();
  const { users, generations, revenue } = metrics;
  const tiers = [
    ["Builder", "$15", revenue.active.builder],
    ["Pro", "$25", revenue.active.pro],
    ["Max", "$45", revenue.active.max],
  ] as const;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 text-zinc-100">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-400">
        Owner
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Shipboard</h1>
      <p className="mt-2 text-sm text-zinc-500">Users, generations, and revenue.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Users</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{users.total}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {users.last7d} new in 7 days
            <span className="mx-1 text-zinc-600">·</span>
            {users.last30d} new in 30 days
          </p>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Generations
          </h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{generations.total}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {generations.success} succeeded
            <span className="mx-1 text-zinc-600">·</span>
            {generations.failed} failed
          </p>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Revenue
          </h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{money(revenue.mrrCad)}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {revenue.configured ? "MRR, CAD monthly" : "Stripe is not configured"}
            {revenue.configured && revenue.mrrCad == null ? " · unavailable" : ""}
          </p>
        </article>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-medium">Generations, last 30 days</h2>
        <div className="mt-4">
          <GenerationChart days={generations.days} since={generations.since} />
        </div>
        <p className="mt-3 flex gap-4 text-[11px] uppercase tracking-wider text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 bg-orange-400" /> Succeeded
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 bg-red-400/80" /> Failed
          </span>
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-medium">Active subscriptions</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {tiers.map(([name, price, count]) => (
            <div key={name}>
              <dt className="text-xs text-zinc-500">
                {name} {price}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {revenue.configured && revenue.mrrCad == null ? "—" : count}
              </dd>
            </div>
          ))}
        </dl>
        {revenue.active.other > 0 ? (
          <p className="mt-3 text-sm text-zinc-400">{revenue.active.other} other active</p>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500">Active CAD subscriptions. Other currencies are omitted.</p>
        <p className="mt-3 text-sm text-zinc-400">
          {revenue.newLast30d == null ? "—" : revenue.newLast30d} new in 30 days
          <span className="mx-1 text-zinc-600">·</span>
          {revenue.canceledLast30d == null ? "—" : revenue.canceledLast30d} canceled in 30 days
        </p>
      </section>
    </main>
  );
}
