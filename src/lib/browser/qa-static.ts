/**
 * Static preview QA — runs on code without launching Chromium.
 * Catches empty shells, missing CTAs, weak a11y, etc. before/after gen.
 */
import { listProjectFiles, parseProject } from "@/lib/project-files";
import { analyzeSourceTruncation, rewriteBareJsxObjectEntries } from "@/lib/code-truncation";
import type { PreviewQaReport, QaFinding } from "./types";

function finding(
  id: string,
  severity: QaFinding["severity"],
  category: QaFinding["category"],
  message: string,
  hint?: string
): QaFinding {
  return { id, severity, category, message, hint };
}

export function finalizeQaScore(findings: QaFinding[]): {
  score: number;
  errorN: number;
  warnN: number;
} {
  const errorN = findings.filter((f) => f.severity === "error").length;
  const warnN = findings.filter((f) => f.severity === "warning").length;
  let score = 100;
  score -= errorN * 28;
  score -= warnN * 10;
  score -= findings.filter((f) => f.severity === "info").length * 3;
  const designFail = findings.some(
    (f) => f.category === "design" && (f.severity === "warning" || f.severity === "error")
  );
  if (designFail) score = Math.min(score, 80);
  score = Math.max(0, Math.min(100, score));
  return { score, errorN, warnN };
}

function pushStorefrontDesignFindings(allSrc: string, findings: QaFinding[]): void {
  if (!/text-(5xl|6xl|7xl|8xl|9xl)/.test(allSrc)) {
    findings.push(
      finding(
        "timid_type",
        "warning",
        "design",
        "Storefront headlines never reach text-5xl+ — type looks timid next to Dawn/Impulse",
        "Display: text-5xl md:text-7xl font-semibold tracking-[-0.04em]"
      )
    );
  }
  const typeSizes = allSrc.match(
    /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/g
  );
  if (typeSizes && new Set(typeSizes).size > 8) {
    findings.push(
      finding(
        "type_scale_chaos",
        "warning",
        "design",
        "More than 8 distinct text-* sizes — pick a display/body scale and stay on it"
      )
    );
  }
  if (!/aspect-\[4\/5\]|aspect-\[3\/4\]|aspect-4\/5/.test(allSrc)) {
    findings.push(
      finding(
        "no_image_slot",
        "warning",
        "design",
        "No reserved 4:5 (or 3:4) image slot — product cards will shift when photography lands",
        "Use aspect-[4/5] overflow-hidden object-cover"
      )
    );
  }
  if (!/\bstore-contrast\b/.test(allSrc)) {
    findings.push(
      finding(
        "no_contrast_band",
        "warning",
        "design",
        "Missing store-contrast band — product grid must sit on a full-bleed dark section",
        'section className="store-contrast w-full bg-zinc-950 text-zinc-50 py-20 md:py-28"'
      )
    );
  }
  if (!/\bstore-contrast-inner\b/.test(allSrc)) {
    findings.push(
      finding(
        "no_contrast_inner",
        "warning",
        "design",
        "Missing store-contrast-inner wrap (mx-auto max-w-7xl px-6 md:px-8)"
      )
    );
  }
  const buttonCount = (allSrc.match(/<button\b/gi) || []).length;
  const hoverCount = (allSrc.match(/hover:/g) || []).length;
  if (buttonCount >= 2 && hoverCount < 2) {
    findings.push(
      finding(
        "no_hover",
        "warning",
        "design",
        "Buttons without hover states — every CTA needs hover: on desktop"
      )
    );
  }
  if (/grid-cols-[3-9]/.test(allSrc) && !/grid-cols-1/.test(allSrc)) {
    findings.push(
      finding(
        "mobile_grid",
        "warning",
        "design",
        "Multi-column grid without grid-cols-1 — likely horizontal scroll at 375px"
      )
    );
  }
  if (
    /★★|⭐{3,}|Sarah M|John D\.|Jane from|5\/5 stars/i.test(allSrc) ||
    /\bfake testimonial\b/i.test(allSrc)
  ) {
    findings.push(
      finding(
        "fake_reviews",
        "warning",
        "design",
        "Invented testimonials / star ratings — trust strip only, no Sarah M."
      )
    );
  }
  if ((allSrc.match(/\bSALE\b/g) || []).length > 2) {
    findings.push(
      finding(
        "sale_spam",
        "warning",
        "design",
        "SALE badges on multiple products — restraint, not a clearance rack"
      )
    );
  }
}

// ---- Unbound field reads -------------------------------------------------
// Silent data bug seen in the wild (v0's Harbor Goods rendered {product.number}
// with no `number` in the data array): JSX reads a property the record never
// defines. JS yields undefined, React paints empty text — no error, no warning.
// This check builds a schema from data-array literals, binds .map() params
// (including destructured ones) to the element schema, and flags member reads
// whose FIRST segment is missing from the schema. Regex/static only, no AST.
// Conservative by design: anything ambiguous stays silent.

interface FieldSchema {
  [key: string]: FieldSchema | null; // null = primitive leaf
}

function ufrEscapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const UFR_PAIRS: Record<string, string> = { "[": "]", "{": "}", "(": ")" };

// Balanced bracket extraction: openIdx points at `[`, `{` or `(`.
// Skips '...' / "..." strings, line + block comments, and escapes.
function ufrExtractBalanced(
  src: string,
  openIdx: number
): { inner: string; end: number } | null {
  const open = src[openIdx];
  const close = UFR_PAIRS[open];
  if (!close) return null;
  let depth = 0;
  let i = openIdx;
  let str: string | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (str) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === str) str = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      str = ch;
      i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i + 2);
      i = nl === -1 ? src.length : nl + 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { inner: src.slice(openIdx + 1, i), end: i };
    }
    i++;
  }
  return null;
}

// Split on `sep` at top level, respecting strings / brackets / comments.
function ufrSplitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let str: string | null = null;
  let cur = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (str) {
      cur += ch;
      if (ch === "\\") {
        cur += text[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === str) str = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      str = ch;
      cur += ch;
      i++;
      continue;
    }
    if (ch === "[" || ch === "{" || ch === "(") depth++;
    else if (ch === "]" || ch === "}" || ch === ")") depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  parts.push(cur);
  return parts;
}

interface UfrEntry {
  key: string;
  value: string | null; // null = shorthand / method
  spread: boolean;
}

function ufrParseEntries(objInner: string): UfrEntry[] {
  const entries: UfrEntry[] = [];
  for (const part of ufrSplitTopLevel(objInner, ",")) {
    const t = part.trim();
    if (!t) continue;
    if (t.startsWith("...")) {
      entries.push({ key: "", value: null, spread: true });
      continue;
    }
    let colon = -1;
    let depth = 0;
    let str: string | null = null;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (str) {
        if (ch === "\\") i++;
        else if (ch === str) str = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        str = ch;
        continue;
      }
      if (ch === "[" || ch === "{" || ch === "(") depth++;
      else if (ch === "]" || ch === "}" || ch === ")") depth--;
      else if (ch === ":" && depth === 0) {
        colon = i;
        break;
      }
    }
    if (colon === -1) {
      const m = /^[A-Za-z_$][\w$]*/.exec(t);
      if (m) entries.push({ key: m[0], value: null, spread: false });
      continue;
    }
    const rawKey = t.slice(0, colon).trim();
    const value = t.slice(colon + 1).trim();
    const km =
      /^["']([^"']+)["']$/.exec(rawKey) || /^[A-Za-z_$][\w$]*$/.exec(rawKey);
    if (!km) continue;
    entries.push({ key: km[1] ?? km[0], value, spread: false });
  }
  return entries;
}

function ufrMergeObject(schema: FieldSchema, objInner: string): void {
  for (const e of ufrParseEntries(objInner)) {
    if (e.spread || !e.key) continue;
    const v = (e.value ?? "").trim();
    if (v.startsWith("{")) {
      const got = ufrExtractBalanced(v, 0);
      const nested: FieldSchema = {};
      if (got) ufrMergeObject(nested, got.inner);
      const existing = schema[e.key];
      if (existing && typeof existing === "object") {
        for (const k of Object.keys(nested)) {
          if (!(k in existing)) existing[k] = nested[k];
        }
      } else {
        schema[e.key] = nested;
      }
    } else if (!(e.key in schema)) {
      schema[e.key] = null; // primitive leaf (or unknown) — keep object if already known
    }
  }
}

// Schema = union of keys across the array's object-literal elements;
// nested objects become nested schemas.
function ufrBuildSchema(arrayInner: string): FieldSchema {
  const schema: FieldSchema = {};
  let depth = 0;
  let str: string | null = null;
  for (let i = 0; i < arrayInner.length; i++) {
    const ch = arrayInner[i];
    if (str) {
      if (ch === "\\") i++;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      str = ch;
      continue;
    }
    if (ch === "[" || ch === "{") {
      if (ch === "{" && depth === 0) {
        const got = ufrExtractBalanced(arrayInner, i);
        if (got) {
          ufrMergeObject(schema, got.inner);
          i = got.end;
          continue;
        }
      }
      depth++;
      continue;
    }
    if (ch === "]" || ch === "}") depth--;
  }
  return schema;
}

function ufrFindDataArrays(src: string): { name: string; schema: FieldSchema }[] {
  const out: { name: string; schema: FieldSchema }[] = [];
  const re =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;{]+)?=\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const openIdx = m.index + m[0].length - 1;
    const got = ufrExtractBalanced(src, openIdx);
    if (!got) continue;
    const schema = ufrBuildSchema(got.inner);
    if (Object.keys(schema).length === 0) continue;
    const existing = out.find((a) => a.name === m![1]);
    if (existing) {
      for (const k of Object.keys(schema)) {
        if (!(k in existing.schema)) existing.schema[k] = schema[k];
      }
    } else {
      out.push({ name: m[1], schema });
    }
  }
  return out;
}

// Blank strings/comments (keeping length); keep ${...} code inside templates.
function ufrSanitize(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i + 2);
      const end = nl === -1 ? src.length : nl;
      out += " ".repeat(end - i);
      i = end;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, src.length);
      out += " ".repeat(j - i);
      i = j;
      continue;
    }
    if (ch === "`") {
      out += " ";
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        if (src[i] === "`") {
          out += " ";
          i++;
          break;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          const inner = ufrExtractBalanced(src, i + 1);
          if (inner) {
            out += "${" + ufrSanitize(inner.inner) + "}";
            i = inner.end + 1;
            continue;
          }
        }
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  // Blank JSX text nodes (text between tags with no braces) — not reads.
  return out.replace(/>([^<{}]*)</g, (mm, text: string) =>
    mm[0] + " ".repeat(text.length) + mm[mm.length - 1]
  );
}

type UfrParam =
  | { kind: "simple"; name: string }
  | { kind: "destructure"; inner: string }
  | { kind: "skip" };

function ufrSkipWs(src: string, i: number): number {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

function ufrParseMapParam(
  src: string,
  idx: number
): { param: UfrParam; end: number } | null {
  let i = ufrSkipWs(src, idx);
  const asyncM = /^async\b/.exec(src.slice(i));
  if (asyncM) i = ufrSkipWs(src, i + asyncM[0].length);
  const fnM = /^function\b/.exec(src.slice(i));
  if (fnM) {
    i = ufrSkipWs(src, i + fnM[0].length);
    const nameM = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (nameM) i = ufrSkipWs(src, i + nameM[0].length);
  }
  if (i >= src.length) return null;
  if (src[i] === "(") {
    const got = ufrExtractBalanced(src, i);
    if (!got) return null;
    const parts = ufrSplitTopLevel(got.inner, ",");
    const first = (parts[0] ?? "").trim();
    const end = got.end + 1;
    if (first.startsWith("{")) {
      const b = ufrExtractBalanced(first, 0);
      if (!b) return { param: { kind: "skip" }, end };
      return { param: { kind: "destructure", inner: b.inner }, end };
    }
    const m = /^[A-Za-z_$][\w$]*/.exec(first);
    if (m) return { param: { kind: "simple", name: m[0] }, end };
    return { param: { kind: "skip" }, end };
  }
  if (src[i] === "{") {
    const b = ufrExtractBalanced(src, i);
    if (!b) return null;
    return { param: { kind: "destructure", inner: b.inner }, end: b.end + 1 };
  }
  const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
  if (m) return { param: { kind: "simple", name: m[0] }, end: i + m[0].length };
  return null;
}

// Object pattern -> alias bindings. `...rest` binds nothing (stays silent).
function ufrParsePattern(
  patternInner: string,
  basePath: string[]
): { alias: string; path: string[] }[] {
  const bindings: { alias: string; path: string[] }[] = [];
  for (const part of ufrSplitTopLevel(patternInner, ",")) {
    const t = part.trim();
    if (!t || t.startsWith("...")) continue;
    let split = -1;
    let isColon = false;
    let depth = 0;
    let str: string | null = null;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (str) {
        if (ch === "\\") i++;
        else if (ch === str) str = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        str = ch;
        continue;
      }
      if (ch === "[" || ch === "{" || ch === "(") depth++;
      else if (ch === "]" || ch === "}" || ch === ")") depth--;
      else if (depth === 0 && (ch === ":" || ch === "=")) {
        split = i;
        isColon = ch === ":";
        break;
      }
    }
    if (split === -1) {
      const m = /^[A-Za-z_$][\w$]*/.exec(t);
      if (m) bindings.push({ alias: m[0], path: [...basePath, m[0]] });
      continue;
    }
    const left = t.slice(0, split).trim();
    const right = t.slice(split + 1).trim();
    const lm =
      /^["']([^"']+)["']$/.exec(left) || /^[A-Za-z_$][\w$]*$/.exec(left);
    if (!lm) continue;
    const key = lm[1] ?? lm[0];
    if (!isColon) {
      const am = /^[A-Za-z_$][\w$]*/.exec(left);
      if (am) bindings.push({ alias: am[0], path: [...basePath, key] });
      continue;
    }
    if (right.startsWith("{")) {
      const b = ufrExtractBalanced(right, 0);
      if (b) bindings.push(...ufrParsePattern(b.inner, [...basePath, key]));
      continue;
    }
    if (right.startsWith("[")) continue; // array pattern — bind nothing
    const am = /^[A-Za-z_$][\w$]*/.exec(right);
    if (am) bindings.push({ alias: am[0], path: [...basePath, key] });
  }
  return bindings;
}

// Arrow body after the param list: `{ ... }` block or a bare expression.
function ufrExtractArrowBody(src: string, idx: number): string | null {
  let i = ufrSkipWs(src, idx);
  if (!src.startsWith("=>", i)) return null;
  i = ufrSkipWs(src, i + 2);
  if (src[i] === "{") {
    const b = ufrExtractBalanced(src, i);
    return b ? b.inner : null;
  }
  let depth = 0;
  let str: string | null = null;
  let j = i;
  while (j < src.length) {
    const ch = src[j];
    if (str) {
      if (ch === "\\") j++;
      else if (ch === str) str = null;
      j++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      str = ch;
      j++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) break;
      depth--;
    } else if (ch === "," && depth === 0) break;
    j++;
  }
  return src.slice(i, j);
}

interface UfrSeg {
  key: string;
  numeric?: boolean;
  call?: boolean;
}

// Parse a member chain after a bound identifier: .a, ?.b, ["c"], [0].
// Stops (silently) at computed non-literal keys; a trailing call is noted.
function ufrParseChain(
  src: string,
  idx: number
): { segments: UfrSeg[]; end: number } {
  const segments: UfrSeg[] = [];
  let i = idx;
  for (;;) {
    let j = i;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src.startsWith("?.", j)) {
      j += 2;
      while (j < src.length && /\s/.test(src[j])) j++;
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(j));
      if (!m) break;
      const key = m[0];
      j += key.length;
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === "(") {
        segments.push({ key, call: true });
        i = j;
        break;
      }
      segments.push({ key });
      i = j;
      continue;
    }
    if (src[j] === ".") {
      j += 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(j));
      if (!m) break;
      const key = m[0];
      j += key.length;
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === "(") {
        segments.push({ key, call: true });
        i = j;
        break;
      }
      segments.push({ key });
      i = j;
      continue;
    }
    if (src[j] === "[") {
      const b = ufrExtractBalanced(src, j);
      if (!b) break;
      const inner = b.inner.trim();
      const sm = /^["']([^"']*)["']$/.exec(inner);
      if (sm) {
        segments.push({ key: sm[1] });
        i = b.end + 1;
        continue;
      }
      if (/^\d+$/.test(inner)) {
        segments.push({ key: "", numeric: true });
        i = b.end + 1;
        continue;
      }
      break; // computed non-literal key — stay silent
    }
    break;
  }
  return { segments, end: i };
}

// First schema-missing segment of a read path, or null when the path resolves
// (or bottoms out in a primitive leaf — deeper segments are JS built-ins).
function ufrFirstMissing(
  schema: FieldSchema,
  segments: UfrSeg[]
): string | null {
  let node: FieldSchema | null = schema;
  for (const s of segments) {
    if (s.numeric) return null;
    if (node === null) return null;
    if (Object.prototype.hasOwnProperty.call(node, s.key)) {
      node = node[s.key];
      continue;
    }
    return s.key;
  }
  return null;
}

function ufrResolvePath(
  schema: FieldSchema,
  path: string[]
): { node: FieldSchema | null; missing: string | null } {
  let node: FieldSchema | null = schema;
  for (const seg of path) {
    if (node === null) return { node: null, missing: null };
    if (Object.prototype.hasOwnProperty.call(node, seg)) {
      node = node[seg];
      continue;
    }
    return { node: null, missing: seg };
  }
  return { node, missing: null };
}

function pushUnboundFieldFindings(
  allSrc: string,
  findings: QaFinding[]
): void {
  const arrays = ufrFindDataArrays(allSrc);
  if (arrays.length === 0) return;
  const seen = new Set<string>();
  const report = (arr: string, display: string, missing: string) => {
    const key = `${arr}::${display}::${missing}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(
      finding(
        "unbound_field",
        "warning",
        "content",
        `Unbound field read: ${display} — "${missing}" is not defined in the ${arr} data (renders empty)`,
        `Add "${missing}" to every record in ${arr}, or remove the read`
      )
    );
  };

  const scanReads = (
    cleanBody: string,
    roots: { name: string; schema: FieldSchema; arr: string }[]
  ) => {
    for (const { name, schema, arr } of roots) {
      const esc = ufrEscapeRegExp(name);
      // Name rebound inside the body (nested callback param, local var) — ambiguous, silent.
      if (
        new RegExp(
          `\\(\\s*${esc}\\s*[,)=]|,\\s*${esc}\\s*[,)=]|\\b${esc}\\b\\s*=>|\\b(?:const|let|var|function)\\s+${esc}\\b`
        ).test(cleanBody)
      ) {
        continue;
      }
      const idRe = new RegExp(`\\b${esc}\\b`, "g");
      let m: RegExpExecArray | null;
      while ((m = idRe.exec(cleanBody))) {
        if (cleanBody[m.index - 1] === ".") continue; // member of something else
        const { segments, end } = ufrParseChain(
          cleanBody,
          m.index + m[0].length
        );
        if (segments.length === 0) continue;
        const missing = ufrFirstMissing(schema, segments);
        if (missing) {
          const display =
            cleanBody
              .slice(m.index, end)
              .replace(/\s+/g, " ")
              .trim() || `${name}.${missing}`;
          report(arr, display, missing);
        }
      }
    }
  };

  for (const { name, schema } of arrays) {
    // .map() callbacks on this array — scan reads inside the callback body only,
    // so the same param name in another scope can't cause false positives.
    const mapRe = new RegExp(
      `\\b${ufrEscapeRegExp(name)}\\s*\\.\\s*map\\s*\\(`,
      "g"
    );
    let m: RegExpExecArray | null;
    while ((m = mapRe.exec(allSrc))) {
      if (allSrc[m.index - 1] === ".") continue; // x.products.map — not our array
      const parsed = ufrParseMapParam(allSrc, m.index + m[0].length);
      if (!parsed || parsed.param.kind === "skip") continue;
      let body: string | null = null;
      if (parsed.param.kind === "simple" || parsed.param.kind === "destructure") {
        body = ufrExtractArrowBody(allSrc, parsed.end);
        if (body === null) {
          // function(p) { ... } form
          let k = ufrSkipWs(allSrc, parsed.end);
          if (allSrc[k] === "{") {
            const b = ufrExtractBalanced(allSrc, k);
            body = b ? b.inner : null;
          }
        }
      }
      if (body === null) continue;
      const cleanBody = ufrSanitize(body);
      if (parsed.param.kind === "simple") {
        scanReads(cleanBody, [{ name: parsed.param.name, schema, arr: name }]);
      } else {
        // Destructuring is a read at bind time; defined aliases also get member scans.
        const roots: { name: string; schema: FieldSchema; arr: string }[] = [];
        for (const b of ufrParsePattern(parsed.param.inner, [])) {
          const { node, missing } = ufrResolvePath(schema, b.path);
          if (missing) {
            report(name, `{ ${b.path.join(".")} }`, missing);
            continue;
          }
          if (node && typeof node === "object") {
            roots.push({ name: b.alias, schema: node, arr: name });
          }
        }
        if (roots.length > 0) scanReads(cleanBody, roots);
      }
    }

    // Indexed reads: products[0].x / products[0]?.image.src — same element schema.
    const idxRe = new RegExp(
      `\\b${ufrEscapeRegExp(name)}\\b\\s*\\[\\s*\\d+\\s*\\]`,
      "g"
    );
    let im: RegExpExecArray | null;
    while ((im = idxRe.exec(allSrc))) {
      if (allSrc[im.index - 1] === ".") continue;
      const { segments, end } = ufrParseChain(allSrc, im.index + im[0].length);
      if (segments.length === 0) continue;
      const missing = ufrFirstMissing(schema, segments);
      if (missing) {
        const display =
          allSrc
            .slice(im.index, end)
            .replace(/\s+/g, " ")
            .trim() || `${name}[0].${missing}`;
        report(name, display, missing);
      }
    }
  }
}

export function runStaticPreviewQa(code: string): PreviewQaReport {
  const findings: QaFinding[] = [];
  const raw = (code || "").trim();
  const project = parseProject(raw);
  const files = listProjectFiles(raw);
  const entry = project.files[project.entry] || raw;
  const allSrc = Object.values(project.files).join("\n") || raw;
  const codeBytes = allSrc.length;
  const fileCount = files.length || (raw ? 1 : 0);

  if (!raw) {
    findings.push(
      finding("empty", "error", "render", "No code to audit", "Generate a UI first")
    );
  }

  // Structure
  const hasComponent =
    /\bfunction\s+Component\s*\(/.test(allSrc) ||
    /\bconst\s+Component\s*=/.test(allSrc) ||
    /\bexport\s+default\s+function\b/.test(allSrc);
  if (raw && !hasComponent) {
    findings.push(
      finding(
        "no_component",
        "error",
        "render",
        "No Component() entry found — preview may fail",
        "Entry should define function Component()"
      )
    );
  }

  if (entry.length > 0 && entry.length < 120) {
    findings.push(
      finding(
        "sparse",
        "warning",
        "content",
        "Entry component is very short — first viewport may look empty"
      )
    );
  }

  const trunc = analyzeSourceTruncation(allSrc);
  if (trunc.likelyTruncated) {
    findings.push(
      finding(
        "truncated",
        "error",
        "render",
        `Code looks cut off (${trunc.reasons[0] || "incomplete syntax"})`,
        "Raise Max tokens in Settings, or send Continue in chat to finish the file"
      )
    );
  }

  // Content / product copy
  if (/\blorem ipsum\b/i.test(allSrc)) {
    findings.push(
      finding("lorem", "warning", "content", "Placeholder lorem ipsum still present")
    );
  }
  if (/\bFeature\s*[123]\b|\bfeature one\b/i.test(allSrc)) {
    findings.push(
      finding(
        "generic_features",
        "warning",
        "content",
        "Generic feature labels — prefer benefit-driven copy"
      )
    );
  }

  // Interaction
  const buttonCount = (allSrc.match(/<button\b/gi) || []).length;
  const linkCount = (allSrc.match(/<a\b/gi) || []).length;
  const hasForm = /<form\b/i.test(allSrc);
  const hasUseState = /\buseState\s*\(/.test(allSrc);
  const hasNav = /<nav\b/i.test(allSrc) || /\bNavbar\b/.test(allSrc);
  const hasH1 = /<h1\b/i.test(allSrc);
  const headingCount =
    (allSrc.match(/<h[1-6]\b/gi) || []).length +
    (allSrc.match(/\bh[1-6]\s*[:=]/gi) || []).length;
  const ctaHints =
    /Start free|Get started|Book demo|Sign up|Try free|View docs|Buy now|Subscribe/i.test(
      allSrc
    );
  const hasCta = buttonCount + linkCount > 0 && (ctaHints || buttonCount > 0);

  if (buttonCount + linkCount === 0) {
    findings.push(
      finding(
        "no_clicks",
        "warning",
        "interaction",
        "No buttons or links detected — UI may feel dead",
        "Add a primary CTA and navigation"
      )
    );
  }
  if (!hasUseState && fileCount >= 1 && codeBytes > 400) {
    findings.push(
      finding(
        "no_state",
        "info",
        "interaction",
        "No useState — consider one interactive control (menu, tabs, form)",
        "v1 feels more real with at least one stateful control"
      )
    );
  }
  if (hasForm && !hasUseState) {
    findings.push(
      finding(
        "dead_form",
        "warning",
        "interaction",
        "Form present without useState — submit may do nothing"
      )
    );
  }

  // A11y
  const hasAria = /\baria-|\brole=/.test(allSrc);
  const hasAlt = /\balt=/.test(allSrc);
  const imgCount = (allSrc.match(/<img\b/gi) || []).length;
  if (!hasAria && (buttonCount > 2 || hasNav)) {
    findings.push(
      finding(
        "weak_a11y",
        "info",
        "a11y",
        "Little ARIA / roles — add labels and focus rings on controls"
      )
    );
  }
  if (imgCount > 0 && !hasAlt) {
    findings.push(
      finding("img_alt", "warning", "a11y", "Images without alt attributes")
    );
  }
  if (!hasH1 && codeBytes > 300) {
    findings.push(
      finding(
        "no_h1",
        "warning",
        "structure",
        "No <h1> found — first viewport hierarchy may be weak"
      )
    );
  }

  // Fatal: catalog identifier used but never defined — preview crashes on first paint
  const usesProducts = /\bPRODUCTS\b/.test(allSrc);
  const definesProducts =
    /\b(?:const|let|var|function)\s+PRODUCTS\b/.test(allSrc) ||
    /\bexport\s+const\s+PRODUCTS\b/.test(allSrc) ||
    /from\s+['"][^'"]*lib\/catalog['"]/.test(allSrc) ||
    Object.keys(project.files).some((p) => /lib\/catalog\.(t|j)sx?$/i.test(p));
  if (usesProducts && !definesProducts) {
    findings.push(
      finding(
        "products_undefined",
        "error",
        "render",
        "PRODUCTS is used but never defined — preview will crash on first paint",
        "Golden path must emit the typed catalog (or import @/lib/catalog). Ready-to-ship cannot pass a store that throws."
      )
    );
  }

  // Silent unbound field reads: JSX references a data property the record never
  // defines (v0's Harbor Goods shipped {product.number} with no `number` field).
  pushUnboundFieldFindings(allSrc, findings);

  const bareJsx = Object.values(project.files).some(
    (src) => rewriteBareJsxObjectEntries(src) !== src
  );
  if (bareJsx) {
    findings.push(
      finding(
        "bare_jsx_entry",
        "error",
        "render",
        'Bare object entry `"sku": <svg>` — Babel Missing semicolon. Put icons in a const ICONS = { ... } or inline in the 4:5 slot.',
        'const ICONS = { "canvas-tote": <svg viewBox="0 0 80 100" /> }'
      )
    );
  }

  // Security / hygiene
  if (/\beval\s*\(/.test(allSrc) || /dangerouslySetInnerHTML/.test(allSrc)) {
    findings.push(
      finding(
        "risky_html",
        "warning",
        "structure",
        "Risky patterns (eval / dangerouslySetInnerHTML) in generated UI"
      )
    );
  }

  if (!hasCta && codeBytes > 400) {
    findings.push(
      finding(
        "weak_cta",
        "info",
        "content",
        "No clear product CTA copy detected (Start free / Book demo / …)"
      )
    );
  }

  const isStore =
    /\bPRODUCTS\b/.test(allSrc) &&
    (/\bformatMoney\b/.test(allSrc) || /\bcreateCheckoutSession\b/.test(allSrc));
  if (isStore) {
    pushStorefrontDesignFindings(allSrc, findings);
  }

  if (findings.length === 0 && raw) {
    findings.push(
      finding("healthy", "pass", "structure", "Static checks look solid")
    );
  }

  const { score, errorN, warnN } = finalizeQaScore(findings);

  const ok = errorN === 0;
  const summary =
    errorN > 0
      ? `${errorN} blocking issue${errorN > 1 ? "s" : ""} — fix before shipping`
      : warnN > 0
        ? `OK to preview · ${warnN} polish warning${warnN > 1 ? "s" : ""}`
        : "Looks shippable on static checks";

  return {
    ok,
    score,
    summary,
    findings,
    metrics: {
      buttonCount,
      linkCount,
      headingCount,
      hasH1,
      hasForm,
      hasNav,
      hasCta,
      codeBytes,
      fileCount,
      consoleErrors: 0,
      source: "static",
    },
    capturedAt: new Date().toISOString(),
  };
}

export function mergeLiveIntoReport(
  staticReport: PreviewQaReport,
  live: {
    rootEmpty?: boolean;
    consoleErrors?: string[];
    buttonCount?: number;
    linkCount?: number;
    hasH1?: boolean;
    textSample?: string;
  }
): PreviewQaReport {
  const findings = [...staticReport.findings];
  const consoleErrors = live.consoleErrors?.length ?? 0;

  const runtimeDetail = (live.consoleErrors || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);

  if (live.rootEmpty) {
    findings.push(
      finding(
        "live_empty",
        "error",
        "render",
        runtimeDetail
          ? `Live preview root is empty — ${runtimeDetail}`
          : "Live preview root is empty — Babel/render failed",
        runtimeDetail || "No runtime message was captured. Open the preview console."
      )
    );
  }
  if (consoleErrors > 0) {
    findings.push(
      finding(
        "live_console",
        "error",
        "render",
        runtimeDetail ||
          `${consoleErrors} runtime error${consoleErrors > 1 ? "s" : ""} in preview`,
        runtimeDetail
      )
    );
  }
  if (live.hasH1 === false && staticReport.metrics.hasH1) {
    findings.push(
      finding(
        "live_no_h1",
        "warning",
        "structure",
        "H1 present in source but not visible in live DOM"
      )
    );
  }

  // Drop pure-pass noise if we added real issues
  const hasReal = findings.some((f) => f.severity !== "pass" && f.id !== "healthy");
  const cleaned = hasReal
    ? findings.filter((f) => f.id !== "healthy")
    : findings;

  const errorN = cleaned.filter((f) => f.severity === "error").length;
  const warnN = cleaned.filter((f) => f.severity === "warning").length;
  let { score } = finalizeQaScore(cleaned);
  if (live.rootEmpty || consoleErrors > 0) {
    score = Math.min(score, 50);
  }

  return {
    ...staticReport,
    ok: errorN === 0,
    score,
    summary:
      errorN > 0
        ? `${errorN} live/static issue${errorN > 1 ? "s" : ""}`
        : warnN > 0
          ? `Live preview OK · ${warnN} warnings`
          : "Live + static checks look good",
    findings: cleaned,
    metrics: {
      ...staticReport.metrics,
      buttonCount: live.buttonCount ?? staticReport.metrics.buttonCount,
      linkCount: live.linkCount ?? staticReport.metrics.linkCount,
      hasH1: live.hasH1 ?? staticReport.metrics.hasH1,
      consoleErrors,
      rootEmpty: live.rootEmpty,
      source: "static+live",
    },
    capturedAt: new Date().toISOString(),
  };
}
