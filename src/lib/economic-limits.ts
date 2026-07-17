/**
 * Economic security — hard per-tenant budgets so runaway agents can't bankrupt the platform.
 * Application-enforced (with optional Neon ledger). Pair with multi-tenant auth.
 */
import { neon } from "@neondatabase/serverless";
import { normalizePlan, type PlanId } from "./plans";

export type EconomicMeter =
  | "telemetry_events"
  | "sync_ops"
  | "agent_preview"
  | "tokens"
  | "estimated_cost_usd";

export interface EconomicQuotas {
  /** Telemetry ingest events / day (tools + runs) */
  telemetryEventsPerDay: number | null;
  /** CLI sync pull+push ops / day */
  syncOpsPerDay: number | null;
  /** Studio agent tool dry-runs / day */
  agentPreviewPerDay: number | null;
  /** Sum of run_finish totalTokens / day */
  tokensPerDay: number | null;
  /** Soft ceiling on estimated USD from run_finish / day */
  estimatedCostUsdPerDay: number | null;
  /** Burst: telemetry events per rolling minute */
  telemetryBurstPerMinute: number;
  /** Burst: sync ops per rolling minute */
  syncBurstPerMinute: number;
}

const QUOTAS: Record<PlanId, EconomicQuotas> = {
  free: {
    telemetryEventsPerDay: 200,
    syncOpsPerDay: 80,
    agentPreviewPerDay: 40,
    tokensPerDay: 50_000,
    estimatedCostUsdPerDay: 1,
    telemetryBurstPerMinute: 20,
    syncBurstPerMinute: 15,
  },
  builder: {
    telemetryEventsPerDay: 2_000,
    syncOpsPerDay: 400,
    agentPreviewPerDay: 200,
    tokensPerDay: 400_000,
    estimatedCostUsdPerDay: 8,
    telemetryBurstPerMinute: 40,
    syncBurstPerMinute: 30,
  },
  pro: {
    telemetryEventsPerDay: 15_000,
    syncOpsPerDay: 2_000,
    agentPreviewPerDay: 1_000,
    tokensPerDay: 2_000_000,
    estimatedCostUsdPerDay: 40,
    telemetryBurstPerMinute: 80,
    syncBurstPerMinute: 60,
  },
  max: {
    telemetryEventsPerDay: 100_000,
    syncOpsPerDay: 20_000,
    agentPreviewPerDay: 10_000,
    tokensPerDay: 20_000_000,
    estimatedCostUsdPerDay: 200,
    telemetryBurstPerMinute: 200,
    syncBurstPerMinute: 120,
  },
};

export function getEconomicQuotas(plan: string | null | undefined): EconomicQuotas {
  return QUOTAS[normalizePlan(plan)];
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return neon(url);
  } catch {
    return null;
  }
}

// ─── Memory ledgers ───────────────────────────────────────────

type DayCounters = {
  telemetry_events: number;
  sync_ops: number;
  agent_preview: number;
  tokens: number;
  estimated_cost_usd: number;
};

const memDaily = new Map<string, DayCounters>(); // `${tenantId}:${day}`
const burstBuckets = new Map<string, number[]>(); // key → timestamps ms

function memKey(tenantId: string, day = dayKey()) {
  return `${tenantId}:${day}`;
}

function getMem(tenantId: string): DayCounters {
  const k = memKey(tenantId);
  let c = memDaily.get(k);
  if (!c) {
    c = {
      telemetry_events: 0,
      sync_ops: 0,
      agent_preview: 0,
      tokens: 0,
      estimated_cost_usd: 0,
    };
    memDaily.set(k, c);
  }
  return c;
}

let usageTableReady: Promise<void> | null = null;

async function ensureUsageTable(): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  if (!usageTableReady) {
    usageTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS shipboard_usage_daily (
          tenant_id TEXT NOT NULL,
          day TEXT NOT NULL,
          telemetry_events INTEGER NOT NULL DEFAULT 0,
          sync_ops INTEGER NOT NULL DEFAULT 0,
          agent_preview INTEGER NOT NULL DEFAULT 0,
          tokens BIGINT NOT NULL DEFAULT 0,
          estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
          PRIMARY KEY (tenant_id, day)
        )
      `;
    })().catch((e) => {
      usageTableReady = null;
      console.warn("[economic] usage table", e);
    });
  }
  await usageTableReady;
}

export type UsageSnapshot = DayCounters & {
  day: string;
  quotas: EconomicQuotas;
  remaining: {
    telemetry_events: number | null;
    sync_ops: number | null;
    agent_preview: number | null;
    tokens: number | null;
    estimated_cost_usd: number | null;
  };
};

function remaining(
  used: number,
  cap: number | null
): number | null {
  if (cap == null) return null;
  return Math.max(0, cap - used);
}

export async function getUsageSnapshot(
  tenantId: string,
  plan: string | null | undefined
): Promise<UsageSnapshot> {
  const quotas = getEconomicQuotas(plan);
  const day = dayKey();
  let used = getMem(tenantId);

  try {
    await ensureUsageTable();
    const sql = getSql();
    if (sql) {
      const rows = await sql`
        SELECT telemetry_events, sync_ops, agent_preview, tokens, estimated_cost_usd
        FROM shipboard_usage_daily
        WHERE tenant_id = ${tenantId} AND day = ${day}
        LIMIT 1
      `;
      if (rows[0]) {
        used = {
          telemetry_events: Number(rows[0].telemetry_events) || 0,
          sync_ops: Number(rows[0].sync_ops) || 0,
          agent_preview: Number(rows[0].agent_preview) || 0,
          tokens: Number(rows[0].tokens) || 0,
          estimated_cost_usd: Number(rows[0].estimated_cost_usd) || 0,
        };
        memDaily.set(memKey(tenantId, day), { ...used });
      }
    }
  } catch {
    /* memory */
  }

  return {
    day,
    ...used,
    quotas,
    remaining: {
      telemetry_events: remaining(used.telemetry_events, quotas.telemetryEventsPerDay),
      sync_ops: remaining(used.sync_ops, quotas.syncOpsPerDay),
      agent_preview: remaining(used.agent_preview, quotas.agentPreviewPerDay),
      tokens: remaining(used.tokens, quotas.tokensPerDay),
      estimated_cost_usd: remaining(
        used.estimated_cost_usd,
        quotas.estimatedCostUsdPerDay
      ),
    },
  };
}

async function loadAndBump(
  tenantId: string,
  field: keyof DayCounters,
  amount: number
): Promise<DayCounters> {
  const day = dayKey();
  const c = getMem(tenantId);
  c[field] = (c[field] || 0) + amount;

  try {
    await ensureUsageTable();
    const sql = getSql();
    if (sql) {
      // Upsert
      await sql`
        INSERT INTO shipboard_usage_daily (
          tenant_id, day, telemetry_events, sync_ops, agent_preview, tokens, estimated_cost_usd
        ) VALUES (
          ${tenantId}, ${day},
          ${field === "telemetry_events" ? amount : 0},
          ${field === "sync_ops" ? amount : 0},
          ${field === "agent_preview" ? amount : 0},
          ${field === "tokens" ? amount : 0},
          ${field === "estimated_cost_usd" ? amount : 0}
        )
        ON CONFLICT (tenant_id, day) DO UPDATE SET
          telemetry_events = shipboard_usage_daily.telemetry_events
            + ${field === "telemetry_events" ? amount : 0},
          sync_ops = shipboard_usage_daily.sync_ops
            + ${field === "sync_ops" ? amount : 0},
          agent_preview = shipboard_usage_daily.agent_preview
            + ${field === "agent_preview" ? amount : 0},
          tokens = shipboard_usage_daily.tokens
            + ${field === "tokens" ? amount : 0},
          estimated_cost_usd = shipboard_usage_daily.estimated_cost_usd
            + ${field === "estimated_cost_usd" ? amount : 0}
      `;
    }
  } catch (e) {
    console.warn("[economic] bump failed", e);
  }

  return { ...c };
}

function checkBurst(
  bucketKey: string,
  maxPerMinute: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000;
  let arr = burstBuckets.get(bucketKey) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= maxPerMinute) {
    const oldest = arr[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    burstBuckets.set(bucketKey, arr);
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  burstBuckets.set(bucketKey, arr);
  return { ok: true };
}

export type LimitCheckResult =
  | { allowed: true; usage: UsageSnapshot }
  | {
      allowed: false;
      status: 429;
      code: string;
      error: string;
      retryAfterSec?: number;
      usage: UsageSnapshot;
      upgrade?: boolean;
    };

/**
 * Pre-check + optional consume for a meter.
 * For tokens/cost: pass amount to consume after successful run_finish.
 */
export async function checkAndConsume(
  tenantId: string,
  plan: string | null | undefined,
  meter: EconomicMeter,
  amount = 1
): Promise<LimitCheckResult> {
  const quotas = getEconomicQuotas(plan);
  const usage = await getUsageSnapshot(tenantId, plan);

  // Burst
  if (meter === "telemetry_events") {
    const b = checkBurst(`tel:${tenantId}`, quotas.telemetryBurstPerMinute);
    if (!b.ok) {
      return {
        allowed: false,
        status: 429,
        code: "burst_telemetry",
        error: `Telemetry burst limit (${quotas.telemetryBurstPerMinute}/min). Slow down agent tool spam.`,
        retryAfterSec: b.retryAfterSec,
        usage,
        upgrade: normalizePlan(plan) === "free",
      };
    }
  }
  if (meter === "sync_ops") {
    const b = checkBurst(`sync:${tenantId}`, quotas.syncBurstPerMinute);
    if (!b.ok) {
      return {
        allowed: false,
        status: 429,
        code: "burst_sync",
        error: `Sync burst limit (${quotas.syncBurstPerMinute}/min).`,
        retryAfterSec: b.retryAfterSec,
        usage,
      };
    }
  }

  const fieldMap: Record<EconomicMeter, keyof DayCounters> = {
    telemetry_events: "telemetry_events",
    sync_ops: "sync_ops",
    agent_preview: "agent_preview",
    tokens: "tokens",
    estimated_cost_usd: "estimated_cost_usd",
  };
  const field = fieldMap[meter];

  const caps: Record<EconomicMeter, number | null> = {
    telemetry_events: quotas.telemetryEventsPerDay,
    sync_ops: quotas.syncOpsPerDay,
    agent_preview: quotas.agentPreviewPerDay,
    tokens: quotas.tokensPerDay,
    estimated_cost_usd: quotas.estimatedCostUsdPerDay,
  };
  const cap = caps[meter];
  const used = usage[field];

  if (cap != null && used + amount > cap) {
    const labels: Record<EconomicMeter, string> = {
      telemetry_events: "daily telemetry events",
      sync_ops: "daily CLI sync operations",
      agent_preview: "daily agent tool previews",
      tokens: "daily agent token budget",
      estimated_cost_usd: "daily estimated agent cost (USD)",
    };
    return {
      allowed: false,
      status: 429,
      code: `quota_${meter}`,
      error: `Economic limit: ${labels[meter]} exceeded (${used}/${cap} used today). Upgrade plan or wait until UTC midnight.`,
      usage,
      upgrade: true,
    };
  }

  await loadAndBump(tenantId, field, amount);
  const next = await getUsageSnapshot(tenantId, plan);
  return { allowed: true, usage: next };
}

/** Map plan string for anonymous tenants (ip or anon id) */
export function anonEconomicTenantId(seed: string): string {
  return `anon:${seed.slice(0, 64)}`;
}
