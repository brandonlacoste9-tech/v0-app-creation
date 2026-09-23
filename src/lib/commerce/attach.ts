/**
 * Fold the deterministic agent-commerce stack into a studio version so
 * generated v1 is not just 5 UI files — catalog, UCP, MCP, Stripe, ACP, channel=.
 */
import { isPreviewUiFile, parseProject, serializeProject } from "@/lib/project-files";
import { buildCommerceShipFiles } from "./codegen";
import { wantsCommerceShip } from "./detect";
import { extractProductsArrayLiteral } from "./preview";
import {
  catalogProductsFromBrief,
  productsLiteral,
  type StoreBrief,
} from "./store-brief";

function svgRect(fill: string, mark: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
  <rect width="640" height="800" fill="${fill}"/>
  <rect x="48" y="48" width="544" height="704" fill="none" stroke="#f4efe8" stroke-width="2" opacity="0.4"/>
  <text x="320" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#f4efe8">${mark}</text>
</svg>\n`;
}

const FILLS = ["#8a7a62", "#c4b7a6", "#5c6b73", "#b08d57", "#3f3a36", "#6e7f6b"];

function wizardAssetFiles(brief: StoreBrief): Array<{ path: string; content: string }> {
  return catalogProductsFromBrief(brief).map((p, i) => {
    const mark =
      (p.title || p.id || "P").replace(/[^A-Za-z0-9]+/g, "").slice(0, 2).toUpperCase() || "P";
    return {
      path: `public/products/${p.id}.svg`,
      content: svgRect(FILLS[i % FILLS.length], mark),
    };
  });
}

export function attachCommerceFilesToCode(
  code: string,
  opts?: { title?: string | null; storeBrief?: StoreBrief | null }
): string {
  if (!code?.trim()) return code;
  const brief = opts?.storeBrief || null;
  if (brief && !brief.products.length) {
    throw new Error("Wizard products are required — refusing the default/placeholder catalog");
  }
  if (!brief && !wantsCommerceShip({ code, title: opts?.title })) {
    return code;
  }

  const project = parseProject(code);
  const joined = Object.values(project.files).join("\n");
  const extra = buildCommerceShipFiles({
    title: brief?.storeName || opts?.title || undefined,
    productsLiteral: brief
      ? productsLiteral(brief)
      : extractProductsArrayLiteral(joined),
  });
  let changed = 0;
  for (const f of extra) {
    const ejectOnly = !isPreviewUiFile(f.path, project.entry);
    const next = f.content.endsWith("\n") ? f.content : f.content + "\n";
    if (ejectOnly || !project.files[f.path]) {
      if (project.files[f.path] !== next) changed += 1;
      project.files[f.path] = next;
    }
  }
  if (brief) {
    for (const p of Object.keys(project.files)) {
      if (p.replace(/\\/g, "/").startsWith("public/products/")) {
        delete project.files[p];
        changed += 1;
      }
    }
    for (const f of wizardAssetFiles(brief)) {
      const next = f.content.endsWith("\n") ? f.content : f.content + "\n";
      project.files[f.path] = next;
      changed += 1;
    }
  }
  for (const p of Object.keys(project.files)) {
    const n = p.replace(/\\/g, "/");
    if (!/\.svg\.tsx?$/i.test(n)) continue;
    const body = project.files[p] || "";
    const isReact =
      /\bexport\s+default\s+function\b/.test(body) ||
      /\bfunction\s+[A-Z]/.test(body);
    if (isReact) {
      delete project.files[p];
      changed += 1;
    }
  }
  if (!changed) return code;
  return serializeProject(project.files, project.entry);
}
