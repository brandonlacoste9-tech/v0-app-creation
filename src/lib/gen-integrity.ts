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
