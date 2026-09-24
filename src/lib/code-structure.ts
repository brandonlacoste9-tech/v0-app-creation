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

  // Bare object entries the model emitted without a wrapper (repair declined —
  // no provable reference). Name the file + lines instead of letting Babel
  // report a cryptic "Missing semicolon".
  for (const run of detectBareObjectEntries(path, src)) {
    const refId = findEntriesReference(src, run, run.keys);
    if (!refId && run.keys.length < 2) continue; // too weak a signal alone
    const keyPreview =
      run.keys.slice(0, 3).join(", ") + (run.keys.length > 3 ? ", …" : "");
    issues.push({
      line: run.startLine,
      message:
        `Lines ${run.startLine}-${run.endLine} look like object entries ` +
        `(${keyPreview}) outside any object — the model emitted a fragment` +
        (refId
          ? `. Wrap them in \`const ${refId} = { ... };\``
          : `. Wrap them in a const object or delete them`),
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

/** A run of `key: value` lines at brace depth 0 — a probable object fragment
 *  the model emitted without its surrounding `const x = { ... }`. */
export interface BareEntriesRun {
  /** 1-based */
  startLine: number;
  /** 1-based, last entry line */
  endLine: number;
  keys: string[];
}

/** `key:` at line start — not `::`, `:=`, or a ternary branch. */
const ENTRY_LINE_RE = /^[ \t]*([A-Za-z_$][\w$-]*)[ \t]*:(?![=:])/;

function isTsxLike(path: string): boolean {
  return /\.(tsx|jsx)$/i.test(path);
}

/**
 * Find maximal runs of entry-like lines at brace depth 0 (masked source, so
 * strings/comments can't fake entries). Blank lines don't break a run; any
 * other non-entry line does.
 */
export function detectBareObjectEntries(
  path: string,
  src: string
): BareEntriesRun[] {
  if (!isTsxLike(path)) return [];
  const masked = stripNonCode(src);
  const lines = masked.split("\n");
  const runs: BareEntriesRun[] = [];
  let depth = 0;
  let runStart = -1;
  let lastEntry = -1;
  let keys: string[] = [];
  const flush = () => {
    if (runStart >= 0 && keys.length > 0) {
      runs.push({ startLine: runStart + 1, endLine: lastEntry + 1, keys });
    }
    runStart = -1;
    lastEntry = -1;
    keys = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = depth === 0 ? ENTRY_LINE_RE.exec(line) : null;
    if (m) {
      if (runStart < 0) runStart = i;
      lastEntry = i;
      keys.push(m[1]);
    } else if (line.trim() !== "") {
      flush();
    }
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
    }
  }
  flush();
  return runs;
}

/**
 * Find the identifier the entries are accessed through: `assets.knive` or
 * `assets["knive"]`. Searches the source with the run's own lines removed so
 * a self-reference inside the fragment can't create a TDZ trap.
 */
function findEntriesReference(
  src: string,
  run: BareEntriesRun,
  keys: string[]
): string | null {
  const lines = src.split("\n");
  const haystack = [
    ...lines.slice(0, run.startLine - 1),
    ...lines.slice(run.endLine),
  ].join("\n");
  const counts = new Map<string, number>();
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      `([A-Za-z_$][\\w$]*)\\s*\\.\\s*${esc}(?![\\w$])`,
      `([A-Za-z_$][\\w$]*)\\s*\\[\\s*["'\`]${esc}["'\`]\\s*\\]`,
    ];
    for (const p of patterns) {
      const re = new RegExp(p, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(haystack)) !== null) {
        counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      }
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [id, n] of counts) {
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

/**
 * Conservative repair: wrap a bare entries run in `const <referencedName> =
 * { ... };`. Only fires when at least one key is provably accessed through
 * that identifier elsewhere in the file. Consumes an immediately following
 * orphaned `};` (the fragment's lost closing brace), skipping blank lines.
 * Otherwise leaves the source alone so checkFileStructure can name it.
 */
export function repairBareObjectEntries(
  path: string,
  src: string
): { src: string; repaired: boolean; note?: string } {
  const runs = detectBareObjectEntries(path, src);
  if (runs.length === 0) return { src, repaired: false };
  const notes: string[] = [];
  let out = src;
  // Bottom-up so earlier line numbers stay valid as we splice.
  for (let r = runs.length - 1; r >= 0; r--) {
    const run = runs[r];
    const refId = findEntriesReference(out, run, run.keys);
    if (!refId) continue;
    const cur = out.split("\n");
    const startIdx = run.startLine - 1;
    const endIdx = run.endLine - 1;
    // Consume an orphaned closing brace after the run (past blank lines):
    // it becomes the wrapper's closer instead of a stray `}`.
    let j = endIdx + 1;
    while (j < cur.length && cur[j].trim() === "") j++;
    const orphanIdx =
      j < cur.length && (cur[j].trim() === "};" || cur[j].trim() === "}")
        ? j
        : -1;
    const body = cur
      .slice(startIdx, orphanIdx >= 0 ? orphanIdx : endIdx + 1)
      .join("\n");
    cur.splice(
      startIdx,
      (orphanIdx >= 0 ? orphanIdx : endIdx) - startIdx + 1,
      `const ${refId} = {\n${body}\n};`
    );
    out = cur.join("\n");
    const keyPreview =
      run.keys.slice(0, 3).join(", ") + (run.keys.length > 3 ? ", …" : "");
    notes.push(
      `${path} lines ${run.startLine}-${run.endLine}: wrapped bare entries (${keyPreview}) as const ${refId}`
    );
  }
  if (notes.length === 0) return { src, repaired: false };
  return { src: out, repaired: true, note: notes.join("; ") };
}

export interface RepairResult {
  files: Record<string, string>;
  repaired: string[];
}

/**
 * Remove positional unmatched `)`, `]`, `}` closers.
 *
 * The model sometimes emits a stray `)` mid-file (probe 2026-09-23:
 * "src/Component.tsx line 73: Unmatched ')' — no opening '('"). Count-based
 * checks miss these when totals balance, but Babel fails on everything after
 * the stray closer (e.g. a valid `const ICONS = { beanie: <svg/> }` at line 146
 * reported "Unexpected token" as a cascade).
 *
 * Walks the stripNonCode-masked source (strings/comments/regex blanked,
 * positions preserved) with a stack and drops any closer with no matching
 * opener. This is a safe repair: an unmatched closer ALWAYS breaks parsing.
 */
export function repairUnmatchedClosers(
  path: string,
  src: string
): { src: string; repaired: boolean; note?: string } {
  if (!src.trim()) return { src, repaired: false };
  if (!/\.(tsx|jsx)$/i.test(path)) return { src, repaired: false };
  const masked = stripNonCode(src);
  const stack: string[] = [];
  const badIndices: number[] = [];

  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "{" || ch === "(" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === ")" || ch === "]") {
      const expected = CLOSE[ch];
      const top = stack[stack.length - 1];
      if (top === expected) {
        stack.pop();
      } else {
        // Unmatched closer — mark for removal. Don't pop: the opener might
        // still be open (mismatched nesting), and removing just the stray
        // closer is the conservative fix.
        badIndices.push(i);
      }
    }
  }

  if (badIndices.length === 0) return { src, repaired: false };

  // Remove from end to start so indices stay valid
  let out = src;
  const lines: number[] = [];
  for (let k = badIndices.length - 1; k >= 0; k--) {
    const idx = badIndices[k];
    lines.push(lineOf(src, idx));
    out = out.slice(0, idx) + out.slice(idx + 1);
  }

  const uniqueLines = [...new Set(lines)].sort((a, b) => a - b);
  return {
    src: out,
    repaired: true,
    note: `${path}: removed ${badIndices.length} unmatched closer(s) at line(s) ${uniqueLines.join(", ")}`,
  };
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
    // First: drop positional unmatched closers — they break all downstream
    // parsing (Babel cascade) and confuse the other repairs.
    const closers = repairUnmatchedClosers(path, src);
    const base0 = closers.repaired ? closers.src : src;
    // Then: drop stray JSX closers (no provable opener) — same rationale.
    const jsx = repairStrayJsxClosers(path, base0);
    const base1 = jsx.repaired ? jsx.src : base0;
    const entries = repairBareObjectEntries(path, base1);
    const base = entries.repaired ? entries.src : base1;
    const fixed = repairBareReturn(path, base);
    const finalSrc = fixed && fixed !== base ? fixed : base;
    if (finalSrc !== src) {
      out[path] = finalSrc;
      repaired.push(path);
    }
  }
  return { files: out, repaired };
}

/**
 * Remove stray JSX closing tags that provably have no matching opener.
 *
 * The model sometimes emits a closer for a component it already self-closed
 * (probe 2026-09-24: `<ProductDetail ... />` followed later by a stray
 * `</ProductDetail></Header>`), or a closer with no opener at all. Babel then
 * fails with "Expected corresponding JSX closing tag" and the preview stays
 * blank.
 *
 * Walks the stripNonCode-masked source (strings/comments/regex blanked,
 * positions preserved) tracking open JSX tags. A closer `</X>` is removed
 * only when the open-tag stack contains no `X` anywhere — it cannot match any
 * opener, so it can never parse. Misnested closers (`X` open but not on top)
 * are left alone: removing those would be guessing at the model's intent.
 * `<` in code (`a < b`, `<=`, `<<`, generics like `<T,>`) never forms a tag
 * token, and a `<` inside a tag's attribute scan aborts the token, so valid
 * code is not misread.
 */
export function repairStrayJsxClosers(
  path: string,
  src: string
): { src: string; repaired: boolean; note?: string } {
  if (!src.trim()) return { src, repaired: false };
  if (!/\.(tsx|jsx)$/i.test(path)) return { src, repaired: false };
  const masked = stripNonCode(src);
  const n = masked.length;
  const FRAG = "<>"; // sentinel for fragment openers `<>`
  const stack: string[] = [];
  // [start, end) ranges (end exclusive, past `>`) of stray closers to drop
  const badRanges: Array<[number, number]> = [];

  const isNameStart = (c: string | undefined) =>
    c != null && /[A-Za-z]/.test(c);
  const isNameChar = (c: string | undefined) =>
    c != null && /[\w.-]/.test(c);

  interface TagToken {
    end: number;
    name: string;
    closing: boolean;
    selfClose: boolean;
  }

  // Apply one parsed tag token to the open-tag stack.
  const handleToken = (tokenStart: number, tok: TagToken) => {
    if (tok.selfClose) return; // opens and closes itself: no stack change
    if (tok.closing) {
      const top = stack[stack.length - 1];
      if (top === tok.name) {
        stack.pop();
      } else if (!stack.includes(tok.name)) {
        // No opener anywhere on the stack: provably stray. Remove it.
        badRanges.push([tokenStart, tok.end]);
      }
      // else: misnested (opener exists but isn't on top) — leave alone.
    } else {
      stack.push(tok.name);
    }
  };

  // Try to parse a JSX tag token starting at masked[start] === "<".
  // Returns the token or null when `<` is just code.
  const parseTag = (start: number): TagToken | null => {
    let j = start + 1;
    let closing = false;
    if (masked[j] === "/") {
      closing = true;
      j++;
    }
    let name: string;
    if (masked[j] === ">") {
      // fragment `<>` / `</>`
      name = FRAG;
      return { end: j + 1, name, closing, selfClose: false };
    }
    if (!isNameStart(masked[j])) return null;
    name = "";
    while (j < n && isNameChar(masked[j])) {
      name += masked[j];
      j++;
    }
    // Skip attributes, respecting {…} nesting (strings already blanked).
    // A `<` at depth 0 before the terminator means this wasn't a tag
    // (e.g. `x<y` in code). Inside {…}, `<` is code (`a < b`) or a nested
    // tag (`{cond && <span>}`) — handle the nested tag recursively so its
    // opener/closer stay balanced.
    let depth = 0;
    let lastNonWs = "";
    while (j < n) {
      const c = masked[j]!;
      if (c === "<") {
        if (depth === 0) return null;
        const nested = parseTag(j);
        if (nested) {
          handleToken(j, nested);
          j = nested.end;
          lastNonWs = ">";
          continue;
        }
        // `<` as code (comparison): skip the char
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth = Math.max(0, depth - 1);
      } else if (c === ">" && depth === 0) {
        break;
      }
      if (!/\s/.test(c)) lastNonWs = c;
      j++;
    }
    if (j >= n) return null;
    const selfClose = !closing && lastNonWs === "/";
    return { end: j + 1, name, closing, selfClose };
  };

  let i = 0;
  while (i < n) {
    if (masked[i] !== "<") {
      i++;
      continue;
    }
    const tok = parseTag(i);
    if (!tok) {
      i++;
      continue;
    }
    handleToken(i, tok);
    i = tok.end;
  }

  if (badRanges.length === 0) return { src, repaired: false };

  // Remove from end to start so indices stay valid
  let out = src;
  const lines: number[] = [];
  for (let k = badRanges.length - 1; k >= 0; k--) {
    const [s, e] = badRanges[k]!;
    lines.push(lineOf(src, s));
    out = out.slice(0, s) + out.slice(e);
  }

  const uniqueLines = [...new Set(lines)].sort((a, b) => a - b);
  return {
    src: out,
    repaired: true,
    note: `${path}: removed ${badRanges.length} stray JSX closer(s) at line(s) ${uniqueLines.join(", ")}`,
  };
}
