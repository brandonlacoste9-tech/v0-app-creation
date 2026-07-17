import type { PreviewQaReport } from "./types";

/** Prompt the model to surgically fix QA findings. */
export function buildFixFromQaPrompt(report: PreviewQaReport): string {
  const issues = report.findings.filter(
    (f) => f.severity === "error" || f.severity === "warning"
  );
  const infos = report.findings.filter((f) => f.severity === "info").slice(0, 3);

  if (issues.length === 0 && infos.length === 0) {
    return "Polish the UI: stronger first-viewport hierarchy, clearer primary CTA, one more real interaction (useState), keep the same product and palette.";
  }

  const lines = [
    "Fix these UI quality issues. Keep the same product concept, structure, and design language.",
    "Return FULL multi-file sources for every file that still exists.",
    `Current QA score: ${report.score}/100 — ${report.summary}`,
    "",
    "Issues to fix:",
    ...issues.map(
      (f, i) =>
        `${i + 1}. [${f.severity}/${f.category}] ${f.message}${f.hint ? ` — ${f.hint}` : ""}`
    ),
  ];

  if (infos.length) {
    lines.push("", "Nice-to-have polish:");
    infos.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.message}`);
    });
  }

  lines.push(
    "",
    "Requirements: real useState where needed, no lorem, no TypeScript types, no imports, entry Component()."
  );

  return lines.join("\n");
}

export function shouldSuggestFix(report: PreviewQaReport | null | undefined): boolean {
  if (!report) return false;
  if (report.score < 85) return true;
  return report.findings.some(
    (f) => f.severity === "error" || f.severity === "warning"
  );
}
