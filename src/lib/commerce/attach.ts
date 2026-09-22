/**
 * Fold the deterministic agent-commerce stack into a studio version so
 * generated v1 is not just 5 UI files — catalog, UCP, MCP, Stripe, ACP, channel=.
 */
import { isPreviewUiFile, parseProject, serializeProject } from "@/lib/project-files";
import { buildCommerceShipFiles } from "./codegen";
import { wantsCommerceShip } from "./detect";

export function attachCommerceFilesToCode(
  code: string,
  opts?: { title?: string | null }
): string {
  if (!code?.trim()) return code;
  if (!wantsCommerceShip({ code, title: opts?.title })) return code;

  const project = parseProject(code);
  const extra = buildCommerceShipFiles({ title: opts?.title || undefined });
  let changed = 0;
  for (const f of extra) {
    const ejectOnly = !isPreviewUiFile(f.path, project.entry);
    const next = f.content.endsWith("\n") ? f.content : f.content + "\n";
    // Always replace eject-only files so a truncated model copy cannot stick.
    if (ejectOnly || !project.files[f.path]) {
      if (project.files[f.path] !== next) changed += 1;
      project.files[f.path] = next;
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
