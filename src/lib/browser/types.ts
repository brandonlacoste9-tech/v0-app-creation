/**
 * AdGen Browser — owned browser ops for the UI factory.
 * Not a browser-use fork. Deterministic QA + capture first;
 * optional external agent worker later for open-web research.
 */

export type BrowserTaskKind =
  | "preview_qa"
  | "preview_screenshot"
  | "inspiration_scrape" // future: external agent / worker
  | "live_site_qa"; // future

export type QaSeverity = "error" | "warning" | "info" | "pass";

export interface QaFinding {
  id: string;
  severity: QaSeverity;
  category:
    | "render"
    | "content"
    | "a11y"
    | "interaction"
    | "structure"
    | "console";
  message: string;
  hint?: string;
}

export interface PreviewQaReport {
  ok: boolean;
  score: number; // 0–100
  summary: string;
  findings: QaFinding[];
  metrics: {
    buttonCount: number;
    linkCount: number;
    headingCount: number;
    hasH1: boolean;
    hasForm: boolean;
    hasNav: boolean;
    hasCta: boolean;
    codeBytes: number;
    fileCount: number;
    consoleErrors: number;
    rootEmpty?: boolean;
    source: "static" | "live" | "static+live";
  };
  capturedAt: string;
}

export interface PreviewCaptureResult {
  ok: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

/** Structured task contract (browser-use-like, AdGen-owned). */
export interface BrowserTaskRequest {
  kind: BrowserTaskKind;
  /** Version code (serialized project or plain TSX) */
  code?: string;
  /** Optional URL for open-web tasks (worker only) */
  url?: string;
  /** Device width for screenshot / QA */
  viewport?: { width: number; height: number };
}

export interface BrowserTaskResult {
  kind: BrowserTaskKind;
  ok: boolean;
  qa?: PreviewQaReport;
  capture?: PreviewCaptureResult;
  error?: string;
  /** When task needs a Python/cloud worker not available here */
  deferred?: boolean;
}
