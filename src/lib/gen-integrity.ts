/**
 * Post-generation integrity checks for Shipboard outputs.
 * Catches incomplete rewrites, placeholders, and empty shells before we treat a build as success.
 */
import {
  extractProjectFromResponse,
  parseProject,
  type ProjectBundle,
  type ProjectFiles,
} from "./project-files";
import { analyzeSourceTruncation } from "./code-truncation";

export type IntegritySeverity = "error" | "warning";

export interface IntegrityIssue {
  severity: IntegritySeverity;
  code: string;
  message: string;
}

export interface IntegrityReport {
  /** Safe to save as a version (may still have warnings). */
  ok: boolean;
  issues: IntegrityIssue[];
  project: ProjectBundle;
  isMulti: boolean;
  summary: string;
}

const PLACEHOLDER_PATTERNS: { re: RegExp; code: string; message: string }[] = [
  {
    re: /previous content remains/i,
    code: "placeholder_previous",
    message: 'Incomplete rewrite: "previous content remains…"',
  },
  {
    re: /rest (of the )?(code|file|component) (unchanged|the same|as before)/i,
    code: "placeholder_rest",
    message: "Incomplete rewrite: rest-of-file stub",
  },
  {
    re: /\b(lorem ipsum|dolor sit amet)\b/i,
    code: "placeholder_lorem",
    message: "Placeholder lorem ipsum copy",
  },
  // Hard stubs only (severity applied in validateGeneration)
  {
    re: /\bTODO:?\s*(implement|add|fix|complete)\b/i,
    code: "placeholder_todo",
    message: "TODO stub left in generated code",
  },
  {
    re: /\[?\.\.\.\]?\s*(same as|unchanged|existing)/i,
    code: "placeholder_ellipsis",
    message: "Ellipsis / unchanged stub in code",
  },
  {
    re: /\byour (content|component|code) here\b/i,
    code: "placeholder_here",
    message: "Placeholder “your content here”",
  },
  {
    re: /\bnot implemented\b/i,
    code: "placeholder_ni",
    message: "Not implemented stub in output",
  },
];

/** Quality smells — warn but still save the version */
const QUALITY_WARNINGS: { re: RegExp; code: string; message: string }[] = [
  {
    re: /\bFeature\s*[123]\b/i,
    code: "placeholder_feature",
    message: 'Generic "Feature 1/2/3" copy — try “Better copy” iterate',
  },
  {
    re: /\bcoming soon\b/i,
    code: "placeholder_soon",
    message: '"Coming soon" in UI copy',
  },
  {
    re: /\binsert\s+(text|content|code)\b/i,
    code: "placeholder_insert",
    message: "Insert-text placeholder smell",
  },
];

function issue(
  severity: IntegritySeverity,
  code: string,
  message: string
): IntegrityIssue {
  return { severity, code, message };
}

function allSource(files: ProjectFiles): string {
  return Object.values(files).join("\n");
}

function hasComponentFn(src: string): boolean {
  return (
    /function\s+Component\s*\(/.test(src) ||
    /const\s+Component\s*=/.test(src) ||
    /function\s+[A-Z][A-Za-z0-9]*\s*\(/.test(src)
  );
}

/**
 * Validate assistant text after a generation finishes.
 * @param previousCode optional last version — flags dropped multi-file pieces
 */
export function validateGeneration(
  text: string,
  previousCode?: string | null
): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const { project, isMulti, summary } = extractProjectFromResponse(text);
  const files = project.files;
  const paths = Object.keys(files).filter((p) => files[p]?.trim());
  const entry = project.entry;
  const entrySrc = files[entry] || "";

  if (paths.length === 0 || !entrySrc.trim()) {
    issues.push(
      issue("error", "no_code", "No usable code block — nothing to preview")
    );
    return { ok: false, issues, project, isMulti, summary };
  }

  const joined = allSource(files);
  const hasFn = hasComponentFn(joined);

  // Only hard-fail empty/tiny shells when there's clearly no UI
  if (entrySrc.trim().length < 24 && !hasFn) {
    issues.push(
      issue("error", "entry_too_short", "Entry file is too short to be a real UI")
    );
  } else if (entrySrc.trim().length < 40) {
    issues.push(
      issue("warning", "entry_short", "Entry is short — preview may look sparse")
    );
  }

  if (!hasFn) {
    issues.push(
      issue(
        "warning",
        "no_component",
        "No Component() (or similar) found — preview may fail"
      )
    );
  }

  // Hard stubs only in code (not in the prose summary before fences)
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.re.test(joined)) {
      issues.push(issue("error", p.code, p.message));
    }
  }
  for (const p of QUALITY_WARNINGS) {
    if (p.re.test(joined)) {
      issues.push(issue("warning", p.code, p.message));
    }
  }

  // Unbalanced fences in original text
  const ticks = (text.match(/```/g) || []).length;
  if (ticks % 2 !== 0) {
    issues.push(
      issue("warning", "unclosed_fence", "Code fence may be unclosed (truncated stream?)")
    );
  }

  // Cut off mid-string / mid-JSX (max_tokens) — hard error so UI can offer Continue
  const trunc = analyzeSourceTruncation(joined);
  if (trunc.likelyTruncated) {
    issues.push(
      issue(
        "error",
        "truncated_code",
        `Generation cut off mid-file (${trunc.reasons[0] || "incomplete syntax"}). Raise Max tokens in Settings or click Continue.`
      )
    );
  }

  // Multi-file: JSX tags that look like custom components without a matching file
  if (isMulti) {
    const defined = new Set(
      paths.map((p) => {
        const base = p.split("/").pop() || p;
        return base.replace(/\.(tsx|jsx|ts|js)$/i, "");
      })
    );
    defined.add("Component");
    const tagRe = /<([A-Z][A-Za-z0-9]*)\b/g;
    const missing = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(joined)) !== null) {
      const name = m[1];
      if (
        ["Fragment", "Suspense", "StrictMode"].includes(name) ||
        defined.has(name)
      ) {
        continue;
      }
      // Allow if defined as function in any file
      const fnRe = new RegExp(`function\\s+${name}\\s*\\(`);
      const constRe = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`);
      if (!fnRe.test(joined) && !constRe.test(joined)) {
        missing.add(name);
      }
    }
    if (missing.size > 0 && missing.size <= 8) {
      issues.push(
        issue(
          "warning",
          "missing_components",
          `Referenced but not defined: ${[...missing].slice(0, 5).join(", ")}`
        )
      );
    }
  }

  // Dropped files vs previous version
  if (previousCode?.trim()) {
    const prev = parseProject(previousCode);
    const prevPaths = Object.keys(prev.files).filter((p) => prev.files[p]?.trim());
    if (prevPaths.length >= 2) {
      const dropped = prevPaths.filter((p) => !files[p]?.trim());
      if (dropped.length > 0 && paths.length < prevPaths.length) {
        issues.push(
          issue(
            "warning",
            "dropped_files",
            `Multi-file iterate may have dropped: ${dropped.slice(0, 4).join(", ")}`
          )
        );
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  return {
    ok: !hasError,
    issues,
    project,
    isMulti,
    summary,
  };
}

export function formatIntegrityToast(report: IntegrityReport): {
  title: string;
  description: string;
} {
  if (report.ok && report.issues.length === 0) {
    return { title: "Build complete", description: "Integrity checks passed" };
  }
  if (report.ok) {
    const w = report.issues.filter((i) => i.severity === "warning");
    return {
      title: "Build complete",
      description: w[0]?.message || "Saved with warnings",
    };
  }
  const e = report.issues.filter((i) => i.severity === "error");
  return {
    title: "Generation incomplete",
    description: e[0]?.message || "Could not extract a solid UI — try again",
  };
}

/**
 * Production / eject gate — runs on RAW sources (not preview-stripped).
 * Preview Babel stripper bugs must never block or falsely approve ship.
 *
 * Blocks GitHub push / deploy when code is truncated, empty, or full of stubs.
 */
export interface ShipGateReport {
  ok: boolean;
  /** Human messages for API / toast */
  blockers: string[];
  issues: IntegrityIssue[];
  fileCount: number;
}

export function validateForShip(code: string): ShipGateReport {
  const issues: IntegrityIssue[] = [];
  const project = parseProject(code || "");
  const files = project.files;
  const paths = Object.keys(files).filter((p) => files[p]?.trim());
  const joined = allSource(files);

  if (paths.length === 0 || !joined.trim()) {
    issues.push(
      issue("error", "ship_no_code", "No code to ship — generate a UI first")
    );
    return { ok: false, blockers: issues.map((i) => i.message), issues, fileCount: 0 };
  }

  if (joined.trim().length < 40) {
    issues.push(
      issue("error", "ship_too_short", "Code is too short to ship as a real project")
    );
  }

  // Truncation / open strings — WILL break `tsc` and Next build live
  const trunc = analyzeSourceTruncation(joined);
  if (trunc.likelyTruncated) {
    issues.push(
      issue(
        "error",
        "ship_truncated",
        `Code looks cut off (${trunc.reasons[0] || "incomplete syntax"}). Send Continue in chat before shipping — live Next.js will fail the same way.`
      )
    );
  }

  // Hard stubs that ship broken apps
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.re.test(joined)) {
      issues.push(
        issue(
          "error",
          `ship_${p.code}`,
          `${p.message} — fix before GitHub / Vercel`
        )
      );
    }
  }

  // Unbalanced braces/parens that truncation analysis might miss if soft
  if (
    trunc.braceDelta !== 0 ||
    trunc.parenDelta !== 0 ||
    trunc.bracketDelta !== 0
  ) {
    // only hard-block if also truncated OR large imbalance
    if (
      trunc.likelyTruncated ||
      Math.abs(trunc.braceDelta) > 2 ||
      Math.abs(trunc.parenDelta) > 2
    ) {
      if (!issues.some((i) => i.code === "ship_truncated")) {
        issues.push(
          issue(
            "error",
            "ship_unbalanced",
            "Unbalanced braces/parens — complete the generation before shipping"
          )
        );
      }
    }
  }

  const blockers = issues
    .filter((i) => i.severity === "error")
    .map((i) => i.message);

  return {
    ok: blockers.length === 0,
    blockers,
    issues,
    fileCount: paths.length,
  };
}

/** Studio UI status for the ship-readiness chip */
export type ShipReadyStatus = "empty" | "building" | "ready" | "blocked";

export interface ShipReadyUi {
  status: ShipReadyStatus;
  report: ShipGateReport;
  /** Short chip label */
  label: string;
  /** Tooltip / secondary line */
  detail: string;
  /** Primary CTA when not building */
  primaryAction: "push" | "continue" | "generate";
  /** Soft warnings — do not block ship */
  warnings: string[];
}

export interface ShipReadyOptions {
  /** BYOB schema map — when missing, warn if code imports @/app/actions */
  byobSchema?: { tables?: unknown[] } | null;
}

/**
 * First-class ship readiness for the studio toolbar.
 * - ready → Push to GitHub
 * - blocked → Continue generation
 * - empty → generate first
 * - building → wait
 */
export function getShipReadyUi(
  code: string | undefined | null,
  isGenerating: boolean,
  opts?: ShipReadyOptions
): ShipReadyUi {
  if (isGenerating) {
    return {
      status: "building",
      report: { ok: false, blockers: [], issues: [], fileCount: 0 },
      label: "Building…",
      detail: "Preview opens when the stream finishes — ship check waits too",
      primaryAction: "generate",
      warnings: [],
    };
  }
  if (!code?.trim()) {
    return {
      status: "empty",
      report: { ok: false, blockers: ["Generate a UI first"], issues: [], fileCount: 0 },
      label: "No project",
      detail: "Generate a UI, then ship when ready",
      primaryAction: "generate",
      warnings: [],
    };
  }
  const report = validateForShip(code);
  const warnings: string[] = [];
  const usesActions =
    /@\/app\/actions/.test(code) ||
    /from\s+['"]@\/app\/actions['"]/.test(code);
  const hasByobTables = Boolean(opts?.byobSchema?.tables?.length);
  if (usesActions && !hasByobTables) {
    warnings.push(
      "Uses @/app/actions — connect Database in Settings for Drizzle eject, or set DATABASE_URL after clone"
    );
  } else if (hasByobTables) {
    warnings.push(
      `BYOB · ${opts!.byobSchema!.tables!.length} tables — set DATABASE_URL in .env.local after clone`
    );
  }

  if (report.ok) {
    const detailParts = [
      report.fileCount > 1
        ? `${report.fileCount} files · real Next.js on GitHub`
        : "Complete source · real Next.js on GitHub",
    ];
    if (warnings[0]) detailParts.push(warnings[0]);
    return {
      status: "ready",
      report,
      label: "Ready to ship",
      detail: detailParts.join(" · "),
      primaryAction: "push",
      warnings,
    };
  }
  return {
    status: "blocked",
    report,
    label: "Not ready",
    detail: report.blockers[0] || "Send Continue to finish incomplete files",
    primaryAction: "continue",
    warnings,
  };
}
