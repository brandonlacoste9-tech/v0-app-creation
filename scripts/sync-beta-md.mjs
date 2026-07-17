/**
 * Sync repo-root BETA.md → src/lib/shipboard-beta-md.ts
 * (client-safe ship ZIP; no node:fs at runtime)
 *
 *   node scripts/sync-beta-md.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(root, "BETA.md"), "utf8");
const out = `/** Synced from repo-root BETA.md for client-safe ship export (no node:fs).
 *  Regenerate: node scripts/sync-beta-md.mjs
 */
export const SHIPBOARD_BETA_MD = ${JSON.stringify(md)};
`;
writeFileSync(join(root, "src/lib/shipboard-beta-md.ts"), out, "utf8");
console.log("synced BETA.md → src/lib/shipboard-beta-md.ts (" + md.length + " chars)");
