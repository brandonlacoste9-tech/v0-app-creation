/**
 * Preview success telemetry — dogfood / product metrics (no PII).
 *
 * Separate from Agent X-Ray (`telemetry-store.ts`). This tracks the
 * hybrid single-pass *projection* quality: mount success, truncation,
 * BYOB mock usage. In-browser ring buffer + localStorage; optional console.
 *
 * Toggle off: localStorage `shipboard_preview_metrics=0` or
 * `process.env.NEXT_PUBLIC_PREVIEW_METRICS=0`.
 */

export type PreviewMetricEventType =
  | "preview_prepare"
  | "preview_mount_success"
  | "preview_mount_fallback"
  | "truncation_triggered"
  | "continue_clicked"
  | "continue_completed"
  | "byob_schema_used"
  | "share_link_copied"
  | "publish_success";

export interface PreviewMetricEvent {
  id: string;
  type: PreviewMetricEventType;
  ts: string;
  /** No PII — booleans/counts/short reason codes only */
  props: Record<string, string | number | boolean | null | undefined>;
}

const MAX = 400;
const STORAGE_KEY = "shipboard_preview_metrics_v1";
const ENABLED_KEY = "shipboard_preview_metrics";

const ring: PreviewMetricEvent[] = [];
let listeners: Array<(e: PreviewMetricEvent) => void> = [];
let hydrated = false;

function uid(): string {
  return `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function isPreviewMetricsEnabled(): boolean {
  if (typeof process !== "undefined") {
    const env = process.env?.NEXT_PUBLIC_PREVIEW_METRICS;
    if (env === "0" || env === "false") return false;
  }
  if (typeof window === "undefined") return true; // SSR: allow emit no-op store
  try {
    if (window.localStorage?.getItem(ENABLED_KEY) === "0") return false;
  } catch {
    /* ignore */
  }
  return true;
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PreviewMetricEvent[];
    if (Array.isArray(parsed)) {
      ring.push(...parsed.slice(0, MAX));
    }
  } catch {
    /* ignore */
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(ring.slice(0, MAX)));
  } catch {
    /* quota */
  }
}

/** Emit a preview metric (no-op when disabled). */
export function emitPreviewMetric(
  type: PreviewMetricEventType,
  props: PreviewMetricEvent["props"] = {}
): PreviewMetricEvent | null {
  if (!isPreviewMetricsEnabled()) return null;
  hydrate();

  const event: PreviewMetricEvent = {
    id: uid(),
    type,
    ts: new Date().toISOString(),
    props: { ...props },
  };

  ring.unshift(event);
  if (ring.length > MAX) ring.length = MAX;
  persist();

  for (const fn of listeners) {
    try {
      fn(event);
    } catch {
      /* ignore */
    }
  }

  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "development" &&
    typeof console !== "undefined"
  ) {
    try {
      console.debug("[preview-metrics]", type, props);
    } catch {
      /* ignore */
    }
  }

  return event;
}

export function getPreviewMetrics(limit = 200): PreviewMetricEvent[] {
  hydrate();
  return ring.slice(0, limit);
}

export function clearPreviewMetrics(): void {
  ring.length = 0;
  persist();
}

export function subscribePreviewMetrics(
  fn: (e: PreviewMetricEvent) => void
): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

/** Aggregate for dogfood dashboard (session + localStorage history). */
export interface PreviewMetricsSummary {
  total: number;
  prepare: number;
  mountSuccess: number;
  mountFallback: number;
  truncation: number;
  continueClicks: number;
  continueCompleted: number;
  byobSchema: number;
  shareLinks: number;
  publishSuccess: number;
  /** success / (success + fallback) when either > 0 */
  mountSuccessRate: number | null;
  schemaVsNone: { schema: number; none: number };
  fallbackReasons: Record<string, number>;
  recent: PreviewMetricEvent[];
}

export function summarizePreviewMetrics(
  events?: PreviewMetricEvent[]
): PreviewMetricsSummary {
  const list = events ?? getPreviewMetrics(MAX);
  const fallbackReasons: Record<string, number> = {};
  let mountSuccess = 0;
  let mountFallback = 0;
  let truncation = 0;
  let continueClicks = 0;
  let continueCompleted = 0;
  let byobSchema = 0;
  let shareLinks = 0;
  let publishSuccess = 0;
  let prepare = 0;
  let schema = 0;
  let none = 0;

  for (const e of list) {
    if (e.type === "preview_prepare") prepare++;
    if (e.type === "preview_mount_success") {
      mountSuccess++;
      if (e.props.hasSchema === true) schema++;
      if (e.props.hasSchema === false) none++;
    }
    if (e.type === "preview_mount_fallback") {
      mountFallback++;
      const r = String(e.props.reason || "unknown");
      fallbackReasons[r] = (fallbackReasons[r] || 0) + 1;
      if (e.props.hasSchema === true) schema++;
      if (e.props.hasSchema === false) none++;
    }
    if (e.type === "truncation_triggered") truncation++;
    if (e.type === "continue_clicked") continueClicks++;
    if (e.type === "continue_completed") continueCompleted++;
    if (e.type === "byob_schema_used") byobSchema++;
    if (e.type === "share_link_copied") shareLinks++;
    if (e.type === "publish_success") publishSuccess++;
  }

  const denom = mountSuccess + mountFallback;
  return {
    total: list.length,
    prepare,
    mountSuccess,
    mountFallback,
    truncation,
    continueClicks,
    continueCompleted,
    byobSchema,
    shareLinks,
    publishSuccess,
    mountSuccessRate: denom > 0 ? mountSuccess / denom : null,
    schemaVsNone: { schema, none },
    fallbackReasons,
    recent: list.slice(0, 40),
  };
}

/** Parent window listener for iframe mount signals. */
export const PREVIEW_METRICS_MSG = "shipboard-preview-metrics";

export function installPreviewMetricsParentListener(): () => void {
  if (typeof window === "undefined") return () => {};
  const onMsg = (ev: MessageEvent) => {
    try {
      const d = ev.data;
      if (!d || d.type !== PREVIEW_METRICS_MSG) return;
      if (d.event === "preview_mount_success") {
        emitPreviewMetric("preview_mount_success", {
          hasSchema: d.hasSchema ?? null,
          durationMs: d.durationMs ?? null,
          source: "iframe",
        });
      } else if (d.event === "preview_mount_fallback") {
        emitPreviewMetric("preview_mount_fallback", {
          reason: d.reason || "iframe_error",
          hasSchema: d.hasSchema ?? null,
          source: "iframe",
        });
      }
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("message", onMsg);
  return () => window.removeEventListener("message", onMsg);
}
