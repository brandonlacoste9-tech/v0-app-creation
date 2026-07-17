/**
 * Run: npx tsx src/lib/preview-metrics.test.ts
 */
import {
  clearPreviewMetrics,
  emitPreviewMetric,
  getPreviewMetrics,
  summarizePreviewMetrics,
} from "./preview-metrics";
import { makePreviewSafeSource } from "./code-truncation";
import {
  generatePreviewActionsInline,
} from "./byob/preview-intercept";
import { FIXTURE_BLOG_SCHEMA } from "./byob/mock-data-generator";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

clearPreviewMetrics();

{
  const e = emitPreviewMetric("preview_prepare", {
    hasSchema: true,
    tablesCount: 2,
  });
  assert(e != null && e.type === "preview_prepare", "emit prepare");
  assert(e!.props.hasSchema === true, "props");
}

{
  emitPreviewMetric("preview_mount_success", { hasSchema: true, durationMs: 12 });
  emitPreviewMetric("preview_mount_fallback", {
    reason: "SyntaxError",
    hasSchema: false,
  });
  emitPreviewMetric("truncation_triggered", { soft: false });
  emitPreviewMetric("continue_clicked", { source: "toast" });

  const s = summarizePreviewMetrics();
  assert(s.mountSuccess >= 1, "success count");
  assert(s.mountFallback >= 1, "fallback count");
  assert(s.mountSuccessRate != null && s.mountSuccessRate > 0, "rate");
  assert(s.truncation >= 1, "truncation");
  assert(s.continueClicks >= 1, "continue");
  assert(Object.keys(s.fallbackReasons).length >= 1, "reasons");
}

// truncation path emits
{
  const before = getPreviewMetrics().filter(
    (e) => e.type === "truncation_triggered"
  ).length;
  makePreviewSafeSource(`function Component() {
  return <div className="unclosed
`, { soft: false });
  const after = getPreviewMetrics().filter(
    (e) => e.type === "truncation_triggered"
  ).length;
  assert(after > before, "makePreviewSafeSource emits truncation_triggered");
}

// schema path emits byob_schema_used
{
  const before = getPreviewMetrics().filter(
    (e) => e.type === "byob_schema_used"
  ).length;
  generatePreviewActionsInline(FIXTURE_BLOG_SCHEMA);
  const after = getPreviewMetrics().filter(
    (e) => e.type === "byob_schema_used"
  ).length;
  assert(after > before, "schema inline emits byob_schema_used");
}

console.log("preview-metrics tests: all passed");
