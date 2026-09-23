/**
 * Per-file structural validation + conservative auto-repair for LLM-generated UI code.
 *
 * The bundle-level integrity checks (gen-integrity.ts) work on regexes over the
 * joined source, so a single malformed file (e.g. ProductGrid.tsx emitting a bare
 * top-level `return (...)` with no function declaration) sails through. This module
 * checks each file structurally without a parser dependency:
 *   - balanced {}, (), []
 *   - no top-level `return` / `await` outside a function scope
 *   - file does not end mid-expression (truncation)
 * and repairs the one failure mode we can fix safely: a component file whose entire
 * body is a bare `return`, which gets wrapped in `function <BaseName>() { ... }`.
 */

export interface StructureIssue {
  line: number;
  message: string;
}

const WS = /\s/;

/**
 * Replace string literals, template literals (with ${} nesting), comments and
 * regex literals with spaces, preserving newlines so line numbers stay valid.
 */
export function stripNonCode(src: string): string {
  const out: string[] = [];
  const n = src.length;
  let i = 0;

  const pushSpaces = (text: string) => {
    for (const ch of text) out.push(ch === "\n" ? "\n" : " ");
  };

  // Heuristic: a `/` starts a regex when the previous significant char is one of these
  const regexBefore = new Set([
    "", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "\n",
  ]);

  while (i < n) {
    const ch = src[i]!;
    const next = src[i + 1] ?? "";

    // line comment
    if (ch === "/" && next === "/") {
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      pushSpaces(src.slice(i, j));
      i = j;
      continue;
    }
    // block comment
    if (ch === "/" && next === "*") {
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      pushSpaces(src.slice(i, j));
      i = j;
      continue;
    }
    // string literal
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") j += 2;
        else if (src[j] === ch) { j++; break; }
        else if (src[j] === "\n") break; // unterminated — bail
        else j++;
      }
      pushSpaces(src.slice(i, j));
      i = j;
      continue;
    }
    // template literal (may nest ${ ... })
    if (ch === "`") {
      let j = i + 1;
      let depth = 0;
      while (j < n) {
        const c = src[j]!;
        if (c === "\\") { j += 2; continue; }
        if (c === "`" && depth === 0) { j++; break; }
        if (c === "$" && src[j + 1] === "{") { depth++; j += 2; continue; }
        if (c === "}" && depth > 0) { depth--; j++; continue; }
        if (c === "\n" && depth === 0) break; // unterminated — bail
        j++;
      }
      // Keep ${...} code intact-ish is complex; mask the whole template.
      // (Braces inside ${} are rare in generated UI copy; balance check tolerates.)
      pushSpaces(src.slice(i, j));
      i = j;
      continue;
    }
    // regex literal (best effort)
    if (ch === "/") {
      // find previous significant char in the ORIGINAL source
      let sk = i - 1;
      while (sk >= 0 && WS.test(src[sk]!)) sk--;
      const prevSrc = sk >= 0 ? src[sk]! : "";
      const { word: prevWord } = readIdentifierBefore(src, sk + 1);
      const isRegex =
        regexBefore.has(prevSrc) ||
        prevSrc === ">" || // `=> /re/`
        REGEX_KEYWORDS.has(prevWord);
      if (isRegex) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const c = src[j]!;
          if (c === "\\") { j += 2; continue; }
          if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (c === "/" && !inClass) { j++; break; }
          else if (c === "\n") break;
          j++;
        }
        while (j < n && /[a-z]/.test(src[j]!)) j++; // flags
        pushSpaces(src.slice(i, j));
        i = j;
        continue;
      }
      out.push(ch);
      i++;
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}

const CONTROL_KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "with", "else", "do", "try", "finally",
]);

/** Keywords after which a `/` starts a regex literal (not division). */
const REGEX_KEYWORDS = new Set([
  "return", "typeof", "case", "in", "of", "new", "delete", "void", "instanceof",
]);

function isIdentifierChar(ch: string): boolean {
  return /[a-zA-Z0-9_$]/.test(ch);
}

/** Read the identifier ending just before index `end` (exclusive). */
function readIdentifierBefore(s: string, end: number): { word: string; start: number } {
  let j = end - 1;
  while (j >= 0 && isIdentifierChar(s[j]!)) j--;
  return { word: s.slice(j + 1, end), start: j + 1 };
}

/**
 * Decide whether the `{` at index `braceIdx` in stripped source opens a function
 * scope (function declaration/expression, arrow body, object/class method).
 */
function braceOpensFunctionScope(stripped: string, braceIdx: number): boolean {
  let j = braceIdx - 1;
  while (j >= 0 && WS.test(stripped[j]!)) j--;
  if (j < 0) return false;
  // arrow body: `=> {`
  if (stripped[j] === ">" && stripped[j - 1] === "=") return true;
  // `identifier(...) {` or `(...) {` — method, function decl, or call-like
  if (stripped[j] === ")") {
    let depth = 1;
    let k = j - 1;
    while (k >= 0 && depth > 0) {
      if (stripped[k] === ")") depth++;
      else if (stripped[k] === "(") depth--;
      k--;
    }
    const openParen = k + 1;
    let w = openParen - 1;
    while (w >= 0 && WS.test(stripped[w]!)) w--;
    if (w < 0) return true; // `(...) {` at file start — treat as function-ish
    const { word } = readIdentifierBefore(stripped, w + 1);
    if (!word) return false;
    // `if (...) {`, `for (...) {` etc. are blocks, not functions
    if (CONTROL_KEYWORDS.has(word)) return false;
    return true;
  }
  // `else {`, `try {`, `do {`
  const { word } = readIdentifierBefore(stripped, j + 1);
  if (word === "else" || word === "try" || word === "do") return false;
  return false;
}

function lineOf(src: string, idx: number): number {
  let line = 1;
  for (let k = 0; k < idx; k++) if (src[k] === "\n") line++;
  return line;
}

const OPEN: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
const CLOSE: Record<string, string> = { "}": "{", ")": "(", "]": "[" };

/**
 * Structural check of one generated file. Returns issues (empty = clean).
 * Only flags what would definitely break the preview's Babel transform.
 */
export function checkFileStructure(path: string, src: string): StructureIssue[] {
  const issues: StructureIssue[] = [];
  if (!src.trim()) return issues;
  const stripped = stripNonCode(src);

  // Stack of { ch, idx, isFunctionScope }
  const stack: { ch: string; idx: number; fn: boolean }[] = [];
  const n = stripped.length;
  let i = 0;

  const wordAt = (idx: number): string | null => {
    const c = stripped[idx];
    if (c == null || !isIdentifierChar(c)) return null;
    // make sure it's the start of the word
    const prev = stripped[idx - 1];
    if (prev != null && isIdentifierChar(prev)) return null;
    let j = idx;
    while (j < n && isIdentifierChar(stripped[j]!)) j++;
    return stripped.slice(idx, j);
  };

  while (i < n) {
    const ch = stripped[i]!;
    if (OPEN[ch]) {
      const fn = ch === "{" ? braceOpensFunctionScope(stripped, i) : false;
      stack.push({ ch, idx: i, fn });
      i++;
      continue;
    }
    if (CLOSE[ch]) {
      const top = stack[stack.length - 1];
      if (!top || top.ch !== CLOSE[ch]) {
        issues.push({
          line: lineOf(src, i),
          message: `Unmatched '${ch}' — no opening '${CLOSE[ch]}'`,
        });
        // recover: skip this closer
        i++;
        continue;
      }
      stack.pop();
      i++;
      continue;
    }
    const w = wordAt(i);
    if (w === "return" || w === "await") {
      const inFunction = stack.some((s) => s.fn);
      if (!inFunction) {
        issues.push({
          line: lineOf(src, i),
          message: `Top-level '${w}' outside any function — file will not compile`,
        });
      }
      i += w.length;
      continue;
    }
    i++;
  }

  for (const unclosed of stack) {
    issues.push({
      line: lineOf(src, unclosed.idx),
      message: `Unclosed '${unclosed.ch}' opened here — file may be truncated`,
    });
  }

  // Ends mid-expression (truncation that brace balance alone may miss)
  const tail = stripped.trimEnd();
  if (
    /[,\(\[=]$/.test(tail) ||
    /=>\s*$/.test(tail) ||
    /\breturn\s*$/.test(tail) ||
    /[?:&|]\s*$/.test(tail)
  ) {
    issues.push({
      line: lineOf(src, src.trimEnd().length),
      message: "File ends mid-expression — likely truncated",
    });
  }

  return issues;
}

function baseComponentName(path: string): string | null {
  const base = (path.split("/").pop() || "").replace(/\.(tsx|jsx)$/i, "");
  if (!/^[A-Z][A-Za-z0-9]*$/.test(base)) return null;
  return base;
}

/**
 * Repair the classic malformed-output failure: a component file whose entire body
 * is a bare `return (...)` with no function declaration. Wraps it in
 * `function <BaseName>() { ... }`. Returns the repaired source, or null when the
 * file is not a clean candidate (caller should surface the structure issues).
 */
export function repairBareReturn(path: string, src: string): string | null {
  const name = baseComponentName(path);
  if (!name) return null;
  const trimmed = src.trim();
  if (!/^return[\s(]/.test(trimmed)) return null;
  // Must not already declare a component
  const stripped = stripNonCode(src);
  if (/function\s+[A-Z]/.test(stripped)) return null;
  if (/export\s+default/.test(stripped)) return null;
  // Only repair when the ONLY structural problem is the top-level return
  // (balanced braces etc.) — otherwise we'd wrap garbage.
  const problems = checkFileStructure(path, src);
  const nonReturn = problems.filter((p) => !p.message.startsWith("Top-level 'return'"));
  if (nonReturn.length > 0) return null;

  const repaired = `function ${name}() {\n${trimmed}\n}\n`;
  // Verify the repair actually yields a clean file
  if (checkFileStructure(path, repaired).length > 0) return null;
  return repaired;
}

export interface RepairResult {
  files: Record<string, string>;
  repaired: string[];
}

/** Apply conservative auto-repairs across a project's files. */
export function repairProjectFiles(
  files: Record<string, string>
): RepairResult {
  const out: Record<string, string> = { ...files };
  const repaired: string[] = [];
  for (const [path, src] of Object.entries(files)) {
    if (!src.trim()) continue;
    if (!/\.(tsx|jsx)$/i.test(path)) continue;
    const fixed = repairBareReturn(path, src);
    if (fixed && fixed !== src) {
      out[path] = fixed;
      repaired.push(path);
    }
  }
  return { files: out, repaired };
}
