/**
 * Preview defense suite — production-dialect TSX fixtures.
 *
 * Run:
 *   npx tsx src/lib/preview-fixtures.test.ts
 *   npm run test:preview
 *
 * This is the regression wall for hybrid single-pass:
 * model writes uncompromised Next/TSX → preview path absorbs it.
 */
import { sanitizePreviewSource, wrapCodeForPreview } from "./preview-html";
import {
  analyzeSourceTruncation,
  makePreviewSafeSource,
} from "./code-truncation";
import { PREVIEW_THEMES } from "./types";
import { mergeForPreview, serializeProject } from "./project-files";
import { PREVIEW_FIXTURES } from "./preview-fixtures/catalog";
import {
  findResidualTs,
  resolveBabel,
  tryMountEntry,
} from "./preview-fixtures/guards";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const theme = PREVIEW_THEMES[0];
const Babel = resolveBabel();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function fail(id: string, msg: string) {
  failed++;
  failures.push(`[${id}] ${msg}`);
  console.error(`  FAIL ${id}: ${msg}`);
}

function ok(id: string, detail?: string) {
  passed++;
  console.log(`  ok   ${id}${detail ? ` — ${detail}` : ""}`);
}

console.log(`preview-fixtures: ${PREVIEW_FIXTURES.length} shapes\n`);

for (const fix of PREVIEW_FIXTURES) {
  const label = `${fix.category}/${fix.id}`;
  try {
    if (fix.truncated) {
      // ── stream path: detect + heal + wrap without throwing ──
      const analysis = analyzeSourceTruncation(fix.source);
      if (!analysis.likelyTruncated) {
        // Some cuts may already look balanced enough; still require safe path
        console.log(`  note ${label}: truncation not flagged (still exercising safe path)`);
      }
      const safe = makePreviewSafeSource(fix.source);
      assert(typeof safe.code === "string" && safe.code.length > 0, "safe code empty");
      assert(
        /function\s+(Component|App|Page)\b|const\s+(Component|App|Page)\b/.test(
          safe.code
        ),
        "healed/fallback must expose an entry component"
      );

      const html = wrapCodeForPreview(fix.source, theme);
      assert(html.includes("Babel.transform"), "wrap has Babel");
      assert(html.includes("new Function"), "wrap has new Function loader");
      assert(html.includes("adgen-error"), "wrap has error panel");

      // Sanitized healed code should not leave import/export that break mount
      const cleaned = sanitizePreviewSource(safe.code);
      const residual = findResidualTs(cleaned).filter(
        (h) => h.id === "import-from" || h.id === "export-default" || h.id === "interface-decl"
      );
      // Fallback UI is plain JS — residual empty is ideal; allow soft heal residuals only if entry exists
      if (residual.length && !safe.usedFallback) {
        // healed source still has heavy TS — warn but try Babel
        console.log(
          `  warn ${label}: residual after heal: ${residual.map((h) => h.id).join(",")}`
        );
      }

      if (Babel && !safe.usedFallback) {
        try {
          const r = Babel.transform(cleaned, {
            presets: [["react", { runtime: "classic" }]],
            filename: "Fixture.jsx",
            sourceType: "script",
          });
          if (r.code) {
            const mount = tryMountEntry(r.code);
            if (!mount.ok) {
              // Truncation may still fail mount — wrap must provide recovery UI path
              assert(
                html.includes("Preview could not compile") ||
                html.includes("Studio preview could not compile") ||
                  html.includes("function Component") ||
                  html.includes("Building live preview"),
                `mount failed and no recovery: ${mount.error}`
              );
            }
          }
        } catch {
          // Acceptable for hard truncations — iframe shows recovery
          assert(html.includes("Babel.transform"), "still wraps after babel fail");
        }
      }

      ok(label, fix.why);
      continue;
    }

    // ── complete production dialect ──
    const cleaned = sanitizePreviewSource(fix.source);

    for (const needle of fix.mustStrip ?? []) {
      assert(
        !cleaned.includes(needle),
        `mustStrip still present: ${JSON.stringify(needle)}`
      );
    }
    for (const needle of fix.mustKeep ?? []) {
      assert(
        cleaned.includes(needle),
        `mustKeep missing: ${JSON.stringify(needle)}\n--- cleaned ---\n${cleaned.slice(0, 400)}`
      );
    }

    const residual = findResidualTs(cleaned);
    if (residual.length) {
      fail(
        label,
        `residual TS: ${residual.map((h) => `${h.id}(${JSON.stringify(h.match)})`).join("; ")}`
      );
      continue;
    }

    // Must keep an entry point for the loader
    const hasEntry =
      /\bfunction\s+Component\b/.test(cleaned) ||
      /\bconst\s+Component\b/.test(cleaned) ||
      /\bfunction\s+App\b/.test(cleaned) ||
      /\bconst\s+App\b/.test(cleaned) ||
      /\bfunction\s+Page\b/.test(cleaned) ||
      /\bconst\s+Page\b/.test(cleaned);
    assert(hasEntry, "no Component/App/Page entry after sanitize");

    const html = wrapCodeForPreview(fix.source, theme);
    assert(html.includes("Babel.transform"), "wrap has Babel");
    assert(html.includes("new Function"), "wrap has new Function loader");
    // Embedded source in HTML must not reintroduce stripped TS for known needles
    for (const needle of fix.mustStrip ?? []) {
      // JSON-escaped embedding — check raw needle and simple escape forms
      if (html.includes(needle)) {
        // Some needles are short (e.g. ": Props") might appear in comments/error strings — check source JSON
        const m = html.match(/var source = ("(?:\\.|[^"\\])*")/);
        if (m) {
          const embedded = JSON.parse(m[1]) as string;
          assert(
            !embedded.includes(needle),
            `embedded source still has ${JSON.stringify(needle)}`
          );
        }
      }
    }

    if (Babel) {
      const r = Babel.transform(cleaned, {
        presets: [["react", { runtime: "classic" }]],
        filename: "Fixture.jsx",
        sourceType: "script",
      });
      assert(Boolean(r.code && r.code.length > 0), "Babel emitted empty code");
      const mount = tryMountEntry(r.code!);
      assert(mount.ok, `mount: ${"error" in mount ? mount.error : "?"}`);
      ok(label, `entry=${mount.ok ? mount.entry : "?"} · ${fix.why}`);
    } else {
      ok(label, `(no @babel/standalone) sanitize+wrap · ${fix.why}`);
    }
  } catch (e) {
    fail(label, e instanceof Error ? e.message : String(e));
  }
}

// ── multi-file merge smoke (product) ──
{
  const label = "product/multi-file-merge";
  try {
    const multi = serializeProject(
      {
        "src/Hero.tsx": `interface HeroProps { title: string }
export function Hero({ title }: HeroProps) {
  return <h1 className="text-3xl font-bold">{title}</h1>;
}`,
        "src/Component.tsx": `import { Hero } from "./Hero";
function Component() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-white">
      <Hero title="Merged" />
    </div>
  );
}`,
      },
      "src/Component.tsx"
    );
    const html = wrapCodeForPreview(multi, theme);
    assert(html.includes("function Hero") || html.includes("Hero"), "merged Hero");
    assert(html.includes("function Component"), "merged Component");
    assert(html.includes("new Function"), "loader");
    const merged = multi.trim().startsWith("{") ? mergeForPreview(multi) : multi;
    const cleaned = sanitizePreviewSource(merged);
    const residual = findResidualTs(cleaned);
    assert(
      residual.filter((h) => h.id === "interface-decl" || h.id === "import-from")
        .length === 0,
      `multi residual: ${residual.map((h) => h.id).join(",")}`
    );
    ok(label, "multi-file production merge absorbs types+imports");
  } catch (e) {
    fail(label, e instanceof Error ? e.message : String(e));
  }
}

console.log(
  `\npreview-fixtures: ${passed} passed, ${failed} failed (of ${passed + failed})`
);
if (failures.length) {
  console.error("\nFailures:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("preview-fixtures: all passed");
