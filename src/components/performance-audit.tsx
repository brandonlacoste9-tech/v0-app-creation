"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  ShieldCheck,
  Accessibility,
  Globe,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  RefreshCw,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  runStaticPreviewQa,
  mergeLiveIntoReport,
  scoreLabel,
  requestLiveQa,
  shouldSuggestFix,
  type PreviewQaReport,
  type LiveQaPayload,
} from "@/lib/browser";
import { wrapCodeForPreview } from "@/lib/preview-html";
import { PREVIEW_THEMES } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface PerformanceAuditProps {
  code?: string;
  sessionId?: string;
  /** Parent runs live DOM QA against the preview iframe */
  onRequestLiveQa?: () => Promise<LiveQaPayload | null>;
  /** Prefill chat with fix prompt from current report */
  onFixFromQa?: (report: PreviewQaReport) => void;
}

function AuditMetric({
  label,
  score,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  score: number;
  icon: LucideIcon;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3"
    >
      <Icon className="h-4 w-4" style={{ color }} />
      <div className="font-mono text-xl font-bold text-white">{score}</div>
      <div className="text-[9px] uppercase tracking-tighter text-white/40">
        {label}
      </div>
    </motion.div>
  );
}

function severityIcon(severity: string) {
  if (severity === "error")
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
  if (severity === "warning")
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
  if (severity === "pass")
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald" />;
  return <Info className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
}

export function PerformanceAudit({
  code = "",
  sessionId,
  onRequestLiveQa,
  onFixFromQa,
}: PerformanceAuditProps) {
  const { t } = useI18n();
  const [report, setReport] = useState<PreviewQaReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveTried, setLiveTried] = useState(false);
  const hiddenIframeRef = useRef<HTMLIFrameElement | null>(null);

  /** Live DOM when preview tab iframe is gone — spin a headless srcDoc iframe. */
  const runHiddenLiveQa = useCallback(async (): Promise<LiveQaPayload | null> => {
    if (!code.trim()) return null;
    const el = hiddenIframeRef.current;
    if (!el) return null;
    el.srcdoc = wrapCodeForPreview(code, PREVIEW_THEMES[0]);
    // Wait for Babel + React render
    await new Promise((r) => setTimeout(r, 900));
    return requestLiveQa(el, 3500);
  }, [code]);

  const runQa = useCallback(
    async (withLive: boolean) => {
      setBusy(true);
      try {
        let base = runStaticPreviewQa(code);
        if (withLive) {
          let live =
            (onRequestLiveQa ? await onRequestLiveQa() : null) ||
            (await runHiddenLiveQa());
          setLiveTried(true);
          if (live) {
            base = mergeLiveIntoReport(base, {
              rootEmpty: live.rootEmpty,
              consoleErrors: live.consoleErrors,
              buttonCount: live.buttonCount,
              linkCount: live.linkCount,
              hasH1: live.hasH1,
              textSample: live.h1Text,
            });
          }
        }
        setReport(base);
      } finally {
        setBusy(false);
      }
    },
    [code, onRequestLiveQa, runHiddenLiveQa]
  );

  useEffect(() => {
    void runQa(false);
  }, [code, runQa]);

  const r = report;
  const a11yScore = r
    ? Math.max(
        20,
        100 -
          r.findings.filter((f) => f.category === "a11y").length * 18 -
          (r.metrics.hasH1 ? 0 : 15)
      )
    : 0;
  const interactScore = r
    ? Math.min(
        100,
        40 +
          r.metrics.buttonCount * 12 +
          r.metrics.linkCount * 6 +
          (r.metrics.hasCta ? 15 : 0)
      )
    : 0;
  const structureScore = r
    ? Math.max(
        15,
        100 -
          r.findings.filter((f) => f.category === "structure" || f.category === "render")
            .filter((f) => f.severity === "error" || f.severity === "warning")
            .length *
            20
      )
    : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/5 bg-black/40 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15">
            <Gauge className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white">
              {t("audit.title")}
            </h3>
            <p className="text-[10px] uppercase tracking-tighter text-white/40">
              {t("audit.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && shouldSuggestFix(report) && onFixFromQa && (
            <button
              type="button"
              onClick={() => onFixFromQa(report)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 transition-colors hover:bg-amber-500/20"
            >
              {t("audit.fixFromQa")}
            </button>
          )}
          <button
            type="button"
            disabled={busy || !code}
            onClick={() => void runQa(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
              busy
                ? "border-white/10 text-white/40"
                : "border-orange-500/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20"
            )}
            title={t("audit.runLive")}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {t("audit.runLive")}
          </button>
        </div>
      </div>

      {/* Offscreen iframe for live QA when Preview tab is not mounted */}
      <iframe
        ref={hiddenIframeRef}
        title="Shipboard Browser QA sandbox"
        className="pointer-events-none fixed h-0 w-0 opacity-0"
        sandbox="allow-scripts allow-same-origin"
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 sm:p-6">
        {!code ? (
          <p className="text-sm text-white/50">
            {t("audit.generateFirst")}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-mono text-4xl font-bold text-white">
                  {r?.score ?? "—"}
                  <span className="text-lg text-white/40">/100</span>
                </div>
                <p className="mt-1 text-sm text-white/70">
                  {r ? scoreLabel(r.score) : "…"} · {r?.summary}
                </p>
                <p className="mt-0.5 text-[10px] text-white/35">
                  Source: {r?.metrics.source ?? "static"}
                  {liveTried ? " · live attempted" : ""}
                  {sessionId ? ` · ${sessionId.slice(0, 8)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-white/50">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  {r?.metrics.fileCount ?? 0} files
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  {r?.metrics.buttonCount ?? 0} buttons
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  {r?.metrics.linkCount ?? 0} links
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  {(r?.metrics.codeBytes ?? 0) > 1024
                    ? `${((r?.metrics.codeBytes ?? 0) / 1024).toFixed(1)} KB`
                    : `${r?.metrics.codeBytes ?? 0} B`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <AuditMetric
                label="Overall"
                score={r?.score ?? 0}
                icon={Zap}
                color="#f97316"
                delay={0.05}
              />
              <AuditMetric
                label="Structure"
                score={structureScore}
                icon={Globe}
                color="#3b82f6"
                delay={0.1}
              />
              <AuditMetric
                label="A11y"
                score={a11yScore}
                icon={Accessibility}
                color="#8b5cf6"
                delay={0.15}
              />
              <AuditMetric
                label="Interaction"
                score={Math.min(100, interactScore)}
                icon={MousePointerClick}
                color="#10b981"
                delay={0.2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                <ShieldCheck className="h-3 w-3 text-orange-400" />
                Findings
              </div>
              <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
                {(r?.findings || []).map((f) => (
                  <div
                    key={f.id + f.message}
                    className="flex items-start gap-3 p-3 sm:p-4"
                  >
                    {severityIcon(f.severity)}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white/90">
                        {f.message}
                      </div>
                      {f.hint ? (
                        <div className="mt-0.5 text-[10px] text-white/40">
                          {f.hint}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[9px] uppercase tracking-wider text-white/25">
                        {f.category} · {f.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] leading-relaxed text-white/35">
              Phase 1: static code + live preview iframe (same-origin). Phase 2
              (Pro+): open-web inspiration scrape via optional Playwright /
              browser-use worker — not bundled into Netlify.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
