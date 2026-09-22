/**
 * Fold the deterministic agent-commerce stack into a studio version so
 * generated v1 is not just 5 UI files — catalog, UCP, MCP, Stripe, ACP, channel=.
 */
import { parseProject, serializeProject } from "@/lib/project-files";
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
  let added = 0;
  for (const f of extra) {
    if (!project.files[f.path]) {
      project.files[f.path] = f.content.endsWith("\n") ? f.content : f.content + "\n";
      added += 1;
    }
  }
  if (!added) return code;
  return serializeProject(project.files, project.entry);
}
