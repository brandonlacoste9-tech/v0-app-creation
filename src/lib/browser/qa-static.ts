/**
 * Static preview QA — runs on code without launching Chromium.
 * Catches empty shells, missing CTAs, weak a11y, etc. before/after gen.
 */
import { listProjectFiles, parseProject } from "@/lib/project-files";
import { analyzeSourceTruncation } from "@/lib/code-truncation";
import type { PreviewQaReport, QaFinding } from "./types";

function finding(
  id: string,
  severity: QaFinding["severity"],
  category: QaFinding["category"],
  message: string,
  hint?: string
): QaFinding {
  return { id, severity, category, message, hint };
}

export function runStaticPreviewQa(code: string): PreviewQaReport {
  const findings: QaFinding[] = [];
  const raw = (code || "").trim();
  const project = parseProject(raw);
  const files = listProjectFiles(raw);
  const entry = project.files[project.entry] || raw;
  const allSrc = Object.values(project.files).join("\n") || raw;
  const codeBytes = allSrc.length;
  const fileCount = files.length || (raw ? 1 : 0);

  if (!raw) {
    findings.push(
      finding("empty", "error", "render", "No code to audit", "Generate a UI first")
    );
  }

  // Structure
  const hasComponent =
    /\bfunction\s+Component\s*\(/.test(allSrc) ||
    /\bconst\s+Component\s*=/.test(allSrc) ||
    /\bexport\s+default\s+function\b/.test(allSrc);
  if (raw && !hasComponent) {
    findings.push(
      finding(
        "no_component",
        "error",
        "render",
        "No Component() entry found — preview may fail",
        "Entry should define function Component()"
      )
    );
  }

  if (entry.length > 0 && entry.length < 120) {
    findings.push(
      finding(
        "sparse",
        "warning",
        "content",
        "Entry component is very short — first viewport may look empty"
      )
    );
  }

  const trunc = analyzeSourceTruncation(allSrc);
  if (trunc.likelyTruncated) {
    findings.push(
      finding(
        "truncated",
        "error",
        "render",
        `Code looks cut off (${trunc.reasons[0] || "incomplete syntax"})`,
        "Raise Max tokens in Settings, or send Continue in chat to finish the file"
      )
    );
  }

  // Content / product copy
  if (/\blorem ipsum\b/i.test(allSrc)) {
    findings.push(
      finding("lorem", "warning", "content", "Placeholder lorem ipsum still present")
    );
  }
  if (/\bFeature\s*[123]\b|\bfeature one\b/i.test(allSrc)) {
    findings.push(
      finding(
        "generic_features",
        "warning",
        "content",
        "Generic feature labels — prefer benefit-driven copy"
      )
    );
  }

  // Interaction
  const buttonCount = (allSrc.match(/<button\b/gi) || []).length;
  const linkCount = (allSrc.match(/<a\b/gi) || []).length;
  const hasForm = /<form\b/i.test(allSrc);
  const hasUseState = /\buseState\s*\(/.test(allSrc);
  const hasNav = /<nav\b/i.test(allSrc) || /\bNavbar\b/.test(allSrc);
  const hasH1 = /<h1\b/i.test(allSrc);
  const headingCount =
    (allSrc.match(/<h[1-6]\b/gi) || []).length +
    (allSrc.match(/\bh[1-6]\s*[:=]/gi) || []).length;
  const ctaHints =
    /Start free|Get started|Book demo|Sign up|Try free|View docs|Buy now|Subscribe/i.test(
      allSrc
    );
  const hasCta = buttonCount + linkCount > 0 && (ctaHints || buttonCount > 0);

  if (buttonCount + linkCount === 0) {
    findings.push(
      finding(
        "no_clicks",
        "warning",
        "interaction",
        "No buttons or links detected — UI may feel dead",
        "Add a primary CTA and navigation"
      )
    );
  }
  if (!hasUseState && fileCount >= 1 && codeBytes > 400) {
    findings.push(
      finding(
        "no_state",
        "info",
        "interaction",
        "No useState — consider one interactive control (menu, tabs, form)",
        "v1 feels more real with at least one stateful control"
      )
    );
  }
  if (hasForm && !hasUseState) {
    findings.push(
      finding(
        "dead_form",
        "warning",
        "interaction",
        "Form present without useState — submit may do nothing"
      )
    );
  }

  // A11y
  const hasAria = /\baria-|\brole=/.test(allSrc);
  const hasAlt = /\balt=/.test(allSrc);
  const imgCount = (allSrc.match(/<img\b/gi) || []).length;
  if (!hasAria && (buttonCount > 2 || hasNav)) {
    findings.push(
      finding(
        "weak_a11y",
        "info",
        "a11y",
        "Little ARIA / roles — add labels and focus rings on controls"
      )
    );
  }
  if (imgCount > 0 && !hasAlt) {
    findings.push(
      finding("img_alt", "warning", "a11y", "Images without alt attributes")
    );
  }
  if (!hasH1 && codeBytes > 300) {
    findings.push(
      finding(
        "no_h1",
        "warning",
        "structure",
        "No <h1> found — first viewport hierarchy may be weak"
      )
    );
  }

  // Security / hygiene
  if (/\beval\s*\(/.test(allSrc) || /dangerouslySetInnerHTML/.test(allSrc)) {
    findings.push(
      finding(
        "risky_html",
        "warning",
        "structure",
        "Risky patterns (eval / dangerouslySetInnerHTML) in generated UI"
      )
    );
  }

  if (!hasCta && codeBytes > 400) {
    findings.push(
      finding(
        "weak_cta",
        "info",
        "content",
        "No clear product CTA copy detected (Start free / Book demo / …)"
      )
    );
  }

  if (findings.length === 0 && raw) {
    findings.push(
      finding("healthy", "pass", "structure", "Static checks look solid")
    );
  }

  const errorN = findings.filter((f) => f.severity === "error").length;
  const warnN = findings.filter((f) => f.severity === "warning").length;
  let score = 100;
  score -= errorN * 28;
  score -= warnN * 10;
  score -= findings.filter((f) => f.severity === "info").length * 3;
  score = Math.max(0, Math.min(100, score));

  const ok = errorN === 0;
  const summary =
    errorN > 0
      ? `${errorN} blocking issue${errorN > 1 ? "s" : ""} — fix before shipping`
      : warnN > 0
        ? `OK to preview · ${warnN} polish warning${warnN > 1 ? "s" : ""}`
        : "Looks shippable on static checks";

  return {
    ok,
    score,
    summary,
    findings,
    metrics: {
      buttonCount,
      linkCount,
      headingCount,
      hasH1,
      hasForm,
      hasNav,
      hasCta,
      codeBytes,
      fileCount,
      consoleErrors: 0,
      source: "static",
    },
    capturedAt: new Date().toISOString(),
  };
}

export function mergeLiveIntoReport(
  staticReport: PreviewQaReport,
  live: {
    rootEmpty?: boolean;
    consoleErrors?: string[];
    buttonCount?: number;
    linkCount?: number;
    hasH1?: boolean;
    textSample?: string;
  }
): PreviewQaReport {
  const findings = [...staticReport.findings];
  const consoleErrors = live.consoleErrors?.length ?? 0;

  if (live.rootEmpty) {
    findings.push(
      finding(
        "live_empty",
        "error",
        "render",
        "Live preview root is empty — Babel/render failed",
        "Open Code tab or check console errors in preview"
      )
    );
  }
  if (consoleErrors > 0) {
    findings.push(
      finding(
        "live_console",
        "error",
        "console",
        `${consoleErrors} runtime error${consoleErrors > 1 ? "s" : ""} in preview`,
        live.consoleErrors?.slice(0, 2).join(" · ")
      )
    );
  }
  if (live.hasH1 === false && staticReport.metrics.hasH1) {
    findings.push(
      finding(
        "live_no_h1",
        "warning",
        "structure",
        "H1 present in source but not visible in live DOM"
      )
    );
  }

  // Drop pure-pass noise if we added real issues
  const hasReal = findings.some((f) => f.severity !== "pass" && f.id !== "healthy");
  const cleaned = hasReal
    ? findings.filter((f) => f.id !== "healthy")
    : findings;

  const errorN = cleaned.filter((f) => f.severity === "error").length;
  const warnN = cleaned.filter((f) => f.severity === "warning").length;
  let score = 100;
  score -= errorN * 28;
  score -= warnN * 10;
  score -= cleaned.filter((f) => f.severity === "info").length * 3;
  score = Math.max(0, Math.min(100, score));

  return {
    ...staticReport,
    ok: errorN === 0,
    score,
    summary:
      errorN > 0
        ? `${errorN} live/static issue${errorN > 1 ? "s" : ""}`
        : warnN > 0
          ? `Live preview OK · ${warnN} warnings`
          : "Live + static checks look good",
    findings: cleaned,
    metrics: {
      ...staticReport.metrics,
      buttonCount: live.buttonCount ?? staticReport.metrics.buttonCount,
      linkCount: live.linkCount ?? staticReport.metrics.linkCount,
      hasH1: live.hasH1 ?? staticReport.metrics.hasH1,
      consoleErrors,
      rootEmpty: live.rootEmpty,
      source: "static+live",
    },
    capturedAt: new Date().toISOString(),
  };
}
