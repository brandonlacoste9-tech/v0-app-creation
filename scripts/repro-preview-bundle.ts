/**
 * Repro harness: run the exact preview pipeline on a project and Babel-compile
 * the bundle the same way the iframe does (react preset, sourceType script).
 * Usage: npx tsx scripts/repro-preview-bundle.ts
 * The PROJECT is inlined below — paste the failing files' sources.
 */
import { mergeForPreview, buildScopedPreview, serializeProject } from "../src/lib/project-files";
import { sanitizePreviewSource } from "../src/lib/preview-html";
import { makePreviewSafeSource } from "../src/lib/code-truncation";
// @ts-ignore
import * as Babel from "@babel/standalone";

const PROJECT: Record<string, string> = {
  // PASTE FILES HERE
};

const merged = mergeForPreview(
  serializeProject(PROJECT, "src/Component.tsx")
);
const scoped = buildScopedPreview(merged);
const cleaned = sanitizePreviewSource(scoped.code);
const safe = makePreviewSafeSource(cleaned, { soft: false });
console.log("usedFallback:", safe.usedFallback, "truncated:", safe.truncated);

try {
  Babel.transform(safe.code, {
    presets: [["react", { runtime: "classic" }]],
    filename: "Component.jsx",
    sourceType: "script",
  });
  console.log("BABEL OK");
} catch (e: any) {
  console.log("BABEL ERROR:", e.message.split("\n").slice(0, 12).join("\n"));
}
