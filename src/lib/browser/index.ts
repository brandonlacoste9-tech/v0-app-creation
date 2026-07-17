/**
 * AdGen Browser — product-owned browser ops.
 *
 * Phase 1 (this package): static + live preview QA inside the studio iframe.
 * Phase 2: optional worker (Playwright or browser-use) for open-web scrape / ship QA.
 *
 * We deliberately do NOT embed the full browser-use Python stack in Next/Netlify.
 */

export type {
  BrowserTaskKind,
  BrowserTaskRequest,
  BrowserTaskResult,
  PreviewCaptureResult,
  PreviewQaReport,
  QaFinding,
  QaSeverity,
} from "./types";

export { runStaticPreviewQa, mergeLiveIntoReport } from "./qa-static";
export {
  ADGEN_QA_REQUEST,
  ADGEN_QA_RESPONSE,
  getPreviewBridgeScript,
  requestLiveQa,
  requestLiveCapture,
  type LiveQaPayload,
  type LiveCapturePayload,
} from "./preview-bridge";

import { runStaticPreviewQa } from "./qa-static";
import type { BrowserTaskRequest, BrowserTaskResult, PreviewQaReport } from "./types";

/** Server-safe task runner (static only). Live DOM needs the client bridge. */
export function runBrowserTask(req: BrowserTaskRequest): BrowserTaskResult {
  if (req.kind === "inspiration_scrape" || req.kind === "live_site_qa") {
    return {
      kind: req.kind,
      ok: false,
      deferred: true,
      error:
        "Open-web agent tasks need the AdGen browser worker (Playwright / optional browser-use). Not available on Netlify serverless.",
    };
  }

  if (req.kind === "preview_screenshot") {
    return {
      kind: req.kind,
      ok: false,
      deferred: true,
      error: "Screenshots use the client preview bridge (requestLiveCapture).",
    };
  }

  // preview_qa
  if (!req.code?.trim()) {
    return {
      kind: "preview_qa",
      ok: false,
      error: "Missing code",
    };
  }

  const qa = runStaticPreviewQa(req.code);
  return { kind: "preview_qa", ok: qa.ok, qa };
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "Needs polish";
  return "Broken / sparse";
}

export function formatQaForChat(report: PreviewQaReport): string {
  const lines = [
    `Browser QA · score ${report.score}/100 · ${report.summary}`,
    ...report.findings
      .filter((f) => f.severity !== "pass")
      .slice(0, 8)
      .map((f) => `• [${f.severity}] ${f.message}`),
  ];
  return lines.join("\n");
}

