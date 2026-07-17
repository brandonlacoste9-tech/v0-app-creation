/** Human-friendly checkpoint labels for version timeline. */

export function checkpointLabel(
  userPrompt: string | undefined,
  extractedTitle: string | undefined,
  versionNumber: number
): string {
  const t = (extractedTitle || "").trim();
  if (t && t.length >= 3 && !/^new project$/i.test(t)) {
    return t.slice(0, 56);
  }
  const p = (userPrompt || "").trim().replace(/\s+/g, " ");
  if (p.length >= 8) {
    return (p.length > 52 ? `${p.slice(0, 52)}…` : p);
  }
  return `Checkpoint ${versionNumber}`;
}
