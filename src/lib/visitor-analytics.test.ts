/**
 * Run: npx tsx src/lib/visitor-analytics.test.ts
 */
import {
  isBotUserAgent,
  normalizeAnalyticsPath,
} from "./visitor-analytics";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(normalizeAnalyticsPath("/") === "/", "root");
assert(normalizeAnalyticsPath("/studio") === "/studio", "studio");
assert(normalizeAnalyticsPath("/studio/foo") === "/studio", "studio collapse");
assert(normalizeAnalyticsPath("/gallery") === "/gallery", "gallery");
assert(normalizeAnalyticsPath("/gallery/abc") === "/gallery/[id]", "gallery id");
assert(normalizeAnalyticsPath("/share?x=1") === "/share", "share strip query");
assert(normalizeAnalyticsPath("/admin") === null, "disallow random");
assert(isBotUserAgent("Googlebot/2.1"), "bot");
assert(!isBotUserAgent("Mozilla/5.0 Chrome/120"), "human");

console.log("visitor-analytics tests: all passed");
