/**
 * Detect and soft-heal truncated model output (cut mid-string / mid-JSX).
 * Common when max_tokens is hit during a large landing-page gen.
 */

export type StringState = "none" | "double" | "single" | "template";

export interface TruncationAnalysis {
  stringState: StringState;
  braceDelta: number;
  parenDelta: number;
  bracketDelta: number;
  likelyTruncated: boolean;
  reasons: string[];
}

/** Scan source for open strings and brace balance (string-aware). */
export function analyzeSourceTruncation(source: string): TruncationAnalysis {
  const reasons: string[] = [];
  let stringState: StringState = "none";
  let brace = 0;
  let paren = 0;
  let bracket = 0;
  let escape = false;
  let templateExprDepth = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (stringState === "double" || stringState === "single") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (
        (stringState === "double" && ch === '"') ||
        (stringState === "single" && ch === "'")
      ) {
        stringState = "none";
      }
      continue;
    }

    if (stringState === "template") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "`" && templateExprDepth === 0) {
        stringState = "none";
        continue;
      }
      if (ch === "$" && source[i + 1] === "{") {
        templateExprDepth++;
        i++;
        continue;
      }
      if (templateExprDepth > 0) {
        if (ch === "{") templateExprDepth++;
        else if (ch === "}") templateExprDepth--;
        else if (ch === "(") paren++;
        else if (ch === ")") paren--;
        else if (ch === "[") bracket++;
        else if (ch === "]") bracket--;
      }
      continue;
    }

    if (ch === '"') {
      stringState = "double";
      continue;
    }
    if (ch === "'") {
      // Apostrophe in prose/JSX text: You're, We'll, I'll — not a string delimiter
      const prev = i > 0 ? source[i - 1] : "";
      if (/[A-Za-z]/.test(prev)) continue;
      stringState = "single";
      continue;
    }
    if (ch === "`") {
      stringState = "template";
      templateExprDepth = 0;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length - 1 && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (ch === "{") brace++;
    else if (ch === "}") brace--;
    else if (ch === "(") paren++;
    else if (ch === ")") paren--;
    else if (ch === "[") bracket++;
    else if (ch === "]") bracket--;
  }

  if (stringState !== "none") {
    reasons.push(`unterminated ${stringState} string`);
  }
  if (brace > 0) reasons.push(`${brace} unclosed brace(s)`);
  if (brace < 0) reasons.push(`${-brace} extra brace(s)`);
  if (paren > 0) reasons.push(`${paren} unclosed paren(s)`);
  if (paren < 0) reasons.push(`${-paren} extra paren(s)`);
  if (bracket > 0) reasons.push(`${bracket} unclosed bracket(s)`);
  if (bracket < 0) reasons.push(`${-bracket} extra bracket(s)`);

  const trimmed = source.trimEnd();
  const lastLine = trimmed.split("\n").pop()?.trim() || "";
  if (
    lastLine.length > 0 &&
    !/[;})\]`'"']\s*$/.test(lastLine) &&
    (/className=["'][^"']*$/.test(lastLine) ||
      /=\s*["'][^"']*$/.test(lastLine) ||
      /<[A-Za-z][\w.-]*\s+[^>]*$/.test(lastLine))
  ) {
    if (!reasons.some((r) => r.includes("unterminated"))) {
      reasons.push("ends mid-JSX / mid-attribute");
    }
  }

  // Trailing `))}` / `))` often means over-closed return ( after a bad heal or cut
  if (/\)\s*\)+\s*;?\s*\}\s*$/.test(trimmed) && paren < 0) {
    reasons.push("over-closed return parens");
  }

  if (countUnmatchedJsxClosers(source) > 0) {
    reasons.push("unmatched JSX closing tag(s)");
  }

  // Short orphan text line then a storm of closers — classic mid-copy cut
  if (
    /\n\s*[A-Za-z][A-Za-z0-9'’ ]{0,40}\s*\n\s*<\/[A-Za-z]/.test(source) &&
    /<\/(div|section|main|p|span|h[1-6])>\s*\n\s*<\/(div|section|main)/.test(
      source
    )
  ) {
    // Only flag when also structurally suspicious (extra closers or open paren)
    if (paren !== 0 || brace !== 0 || countUnmatchedJsxClosers(source) > 0) {
      reasons.push("possible mid-text JSX truncation");
    }
  }

  if (
    /\bfunction\s+Component\s*\(/.test(source) &&
    brace > 0 &&
    !/\}\s*$/.test(trimmed)
  ) {
    if (!reasons.length) reasons.push("Component body not closed");
  }

  const likelyTruncated =
    stringState !== "none" ||
    brace > 2 ||
    paren > 2 ||
    brace < 0 ||
    paren < 0 ||
    bracket < 0 ||
    reasons.some((r) =>
      /unterminated|mid-JSX|not closed|unclosed|extra paren|extra brace|unmatched JSX|over-closed|mid-text/.test(
        r
      )
    );

  return {
    stringState,
    braceDelta: brace,
    parenDelta: paren,
    bracketDelta: bracket,
    likelyTruncated,
    reasons,
  };
}

/** How many `</tag>` have no matching open in a simple stack walk. */
export function countUnmatchedJsxClosers(source: string): number {
  const stack: string[] = [];
  let unmatched = 0;
  const re =
    /<!--[\s\S]*?-->|<\/([A-Za-z][\w.-]*)\s*>|<([A-Za-z][\w.-]*)(\s[^>]*?)?(\/)?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const name = m[1];
      let found = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === name) {
          found = i;
          break;
        }
      }
      if (found >= 0) stack.splice(found, 1);
      else unmatched++;
      continue;
    }
    const name = m[2];
    if (m[4]) continue;
    if (
      /^(br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)$/i.test(
        name
      )
    ) {
      continue;
    }
    stack.push(name);
  }
  return unmatched;
}

/**
 * Drop closing tags that don't match the open stack (keeps source parseable).
 * Also returns open tags still unclosed (caller may append closers).
 */
export function repairJsxTagBalance(source: string): string {
  type Tok =
    | { kind: "text"; value: string }
    | { kind: "open"; name: string; raw: string; self: boolean }
    | { kind: "close"; name: string; raw: string }
    | { kind: "comment"; raw: string };

  const tokens: Tok[] = [];
  const re =
    /<!--[\s\S]*?-->|<\/([A-Za-z][\w.-]*)\s*>|<([A-Za-z][\w.-]*)(\s[^>]*?)?(\/)?>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: source.slice(last, m.index) });
    }
    if (m[0].startsWith("<!--")) {
      tokens.push({ kind: "comment", raw: m[0] });
    } else if (m[1]) {
      tokens.push({ kind: "close", name: m[1], raw: m[0] });
    } else {
      tokens.push({
        kind: "open",
        name: m[2],
        raw: m[0],
        self: Boolean(m[4]),
      });
    }
    last = m.index + m[0].length;
  }
  if (last < source.length) {
    tokens.push({ kind: "text", value: source.slice(last) });
  }

  const stack: string[] = [];
  const out: string[] = [];
  const voidRe =
    /^(br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)$/i;

  for (const tok of tokens) {
    if (tok.kind === "text" || tok.kind === "comment") {
      out.push(tok.kind === "text" ? tok.value : tok.raw);
      continue;
    }
    if (tok.kind === "open") {
      out.push(tok.raw);
      if (!tok.self && !voidRe.test(tok.name)) stack.push(tok.name);
      continue;
    }
    // close
    let found = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === tok.name) {
        found = i;
        break;
      }
    }
    if (found < 0) {
      // drop unmatched closer
      continue;
    }
    // auto-close skipped intermediates: </div> when stack is [div, span] → close span first
    while (stack.length - 1 > found) {
      const skip = stack.pop()!;
      out.push(`</${skip}>`);
    }
    stack.pop();
    out.push(tok.raw);
  }

  // Append missing closers for remaining opens
  for (let i = stack.length - 1; i >= 0; i--) {
    out.push(`\n</${stack[i]}>`);
  }
  return out.join("");
}

/** Strip extra `)` / `]` / `}` when deltas are negative (common after bad heals). */
function stripExtraTrailingClosers(source: string): string {
  let s = source.replace(/\r\n/g, "\n");
  for (let n = 0; n < 24; n++) {
    const a = analyzeSourceTruncation(s);
    if (a.parenDelta >= 0) break;
    const idx = s.lastIndexOf(")");
    if (idx < 0) break;
    s = s.slice(0, idx) + s.slice(idx + 1);
  }
  for (let n = 0; n < 12; n++) {
    const a = analyzeSourceTruncation(s);
    if (a.bracketDelta >= 0) break;
    const idx = s.lastIndexOf("]");
    if (idx < 0) break;
    s = s.slice(0, idx) + s.slice(idx + 1);
  }
  for (let n = 0; n < 12; n++) {
    const a = analyzeSourceTruncation(s);
    if (a.braceDelta >= 0) break;
    const idx = s.lastIndexOf("}");
    if (idx < 0) break;
    s = s.slice(0, idx) + s.slice(idx + 1);
  }
  // Collapse `))}`  → `)}` near function end
  s = s.replace(/\)(\s*\))+(\s*;?\s*\n\s*\})/g, ")$2");
  // Ensure return (...) is terminated before final function }
  s = s.replace(/\)\s*\n(\s*\})\s*$/, ");\n$1");
  return s;
}

/**
 * Drop a truncated text node sitting alone on a line right before closers
 * (e.g. line with just "You" mid-copy cut).
 */
function stripOrphanTextBeforeClosers(source: string): string {
  const lines = source.split("\n");
  if (lines.length < 3) return source;
  // Find last non-closer-ish content line near the end
  for (let i = lines.length - 1; i >= 1; i--) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^<\//.test(t) || /^\)+;?\s*$/.test(t) || /^\}+\s*$/.test(t)) continue;
    // Short bare words / unfinished sentence without JSX or punctuation end
    if (
      /^[A-Za-z][A-Za-z0-9'’ ]{0,48}$/.test(t) &&
      !/[.!?:,;]$/.test(t) &&
      t.split(/\s+/).length <= 6
    ) {
      // Only strip if following lines are mostly closers
      const rest = lines.slice(i + 1).join("\n");
      if (/^\s*(<\/[A-Za-z][\w.-]*>\s*)+\)*\s*;?\s*\}*\s*$/.test(rest) ||
          lines.slice(i + 1).every((l) => {
            const x = l.trim();
            return !x || /^<\//.test(x) || /^\)+;?$/.test(x) || /^\}+$/.test(x);
          })) {
        lines.splice(i, 1);
        return lines.join("\n");
      }
    }
    break;
  }
  return source;
}

/** Drop incomplete open string at EOF (including the attr that started it). */
function stripOpenStringTail(source: string): string {
  let stringState: StringState = "none";
  let escape = false;
  let stringStart = -1;
  let templateExprDepth = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (stringState === "double" || stringState === "single") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (
        (stringState === "double" && ch === '"') ||
        (stringState === "single" && ch === "'")
      ) {
        stringState = "none";
        stringStart = -1;
      }
      continue;
    }
    if (stringState === "template") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "`" && templateExprDepth === 0) {
        stringState = "none";
        stringStart = -1;
        continue;
      }
      if (ch === "$" && source[i + 1] === "{") {
        templateExprDepth++;
        i++;
        continue;
      }
      if (templateExprDepth > 0) {
        if (ch === "{") templateExprDepth++;
        else if (ch === "}") templateExprDepth--;
      }
      continue;
    }
    if (ch === '"') {
      stringState = "double";
      stringStart = i;
      continue;
    }
    if (ch === "'") {
      const prev = i > 0 ? source[i - 1] : "";
      if (/[A-Za-z]/.test(prev)) continue; // You're / We'll
      stringState = "single";
      stringStart = i;
      continue;
    }
    if (ch === "`") {
      stringState = "template";
      stringStart = i;
      templateExprDepth = 0;
      continue;
    }
  }

  if (stringState === "none" || stringStart < 0) return source;

  // Prefer removing ` attrName=` + open quote, not just the quote
  const before = source.slice(0, stringStart);
  const attr = before.match(/(\s+)([A-Za-z_:][\w:.-]*)=\s*$/);
  if (attr) {
    return before.slice(0, before.length - attr[0].length);
  }
  return before;
}

/** Remove a trailing incomplete open tag like `<a href=...` without `>`. */
function stripIncompleteOpenTag(source: string): string {
  return source.replace(/<[A-Za-z][\w.-]*(?:\s[^<>]*)?$/u, "");
}

/**
 * Close unclosed JSX elements with a simple tag stack (ignores strings roughly).
 */
function closeOpenJsxTags(source: string): string {
  const stack: string[] = [];
  const re =
    /<!--[\s\S]*?-->|<\/([A-Za-z][\w.-]*)\s*>|<([A-Za-z][\w.-]*)(\s[^>]*?)?(\/)?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      // closing tag
      const name = m[1];
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === name) {
          stack.splice(i, 1);
          break;
        }
      }
      continue;
    }
    const name = m[2];
    const selfClose = Boolean(m[4]);
    if (selfClose) continue;
    // void-ish tags
    if (
      /^(br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)$/i.test(
        name
      )
    ) {
      continue;
    }
    stack.push(name);
  }

  let s = source;
  for (let i = stack.length - 1; i >= 0; i--) {
    s += `\n</${stack[i]}>`;
  }
  return s;
}

/**
 * Best-effort close of truncated / mangled TSX so Babel can parse something.
 * Strips incomplete tails, unmatched closers, and extra parens — does not invent UI.
 */
export function healTruncatedSource(source: string): string {
  if (!source?.trim()) return source;

  let s = source.replace(/\r\n/g, "\n");
  const initial = analyzeSourceTruncation(s);
  const needsHeal =
    initial.likelyTruncated ||
    initial.stringState !== "none" ||
    countUnmatchedJsxClosers(s) > 0 ||
    initial.parenDelta < 0 ||
    initial.braceDelta < 0;

  if (!needsHeal) {
    return s;
  }

  s = stripOpenStringTail(s);
  s = stripIncompleteOpenTag(s.trimEnd());
  s = stripOrphanTextBeforeClosers(s);

  // Drop trailing incomplete lines that still look mid-expression
  const lines = s.split("\n");
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    if (
      !last ||
      /[=,({\[]\s*$/.test(last) ||
      (/^(const|let|var|function|return|if|else|map|className)\b/.test(last) &&
        !/[;}>)]\s*$/.test(last))
    ) {
      if (/^(const|let|var)\b/.test(last) && !/=\s*.+/.test(last)) {
        lines.pop();
        continue;
      }
      if (/[=,]\s*$/.test(last)) {
        lines.pop();
        continue;
      }
    }
    break;
  }
  s = lines.join("\n");

  // Prefer full JSX rebalance (drops extra </div>, closes missing opens)
  s = repairJsxTagBalance(s);
  // Legacy path still helps pure open-only cases if rebalance left holes
  if (countUnmatchedJsxClosers(s) === 0) {
    // still may have unclosed opens — repairJsxTagBalance already appended them
  } else {
    s = closeOpenJsxTags(s);
  }

  s = stripExtraTrailingClosers(s);

  let a = analyzeSourceTruncation(s);
  // Never append closers while a string is still open — they land inside the
  // string and parenDelta never drops → infinite loop (browser freeze).
  let guard = 0;
  while (a.parenDelta > 0 && a.stringState === "none" && guard++ < 40) {
    s += ")";
    a = analyzeSourceTruncation(s);
  }
  guard = 0;
  while (a.bracketDelta > 0 && a.stringState === "none" && guard++ < 20) {
    s += "]";
    a = analyzeSourceTruncation(s);
  }

  if (a.stringState === "none" && /\breturn\s*\(/.test(s)) {
    a = analyzeSourceTruncation(s);
    guard = 0;
    while (a.parenDelta > 0 && guard++ < 40) {
      s += ")";
      a.parenDelta--;
    }
    if (!/\)\s*;?\s*(\n\s*)*\}*\s*$/.test(s.trimEnd()) && a.braceDelta > 0) {
      if (!/\)\s*$/.test(s.trimEnd())) {
        /* balanced */
      } else if (!/;\s*$/.test(s.trimEnd().replace(/\}\s*$/, "").trimEnd())) {
        s = s.replace(/\n(\s*\}+\s*)$/, ";\n$1");
      }
    }
  } else if (
    a.stringState === "none" &&
    !/[;})]\s*$/.test(s.trimEnd()) &&
    a.braceDelta > 0
  ) {
    s += ";";
  }

  a = analyzeSourceTruncation(s);
  guard = 0;
  while (a.braceDelta > 0 && a.stringState === "none" && guard++ < 40) {
    s += "\n}";
    a.braceDelta--;
  }

  // Final pass: extra ) again after brace close, JSX rebalance once more
  s = stripExtraTrailingClosers(s);
  if (countUnmatchedJsxClosers(s) > 0 || /<[A-Za-z]/.test(s)) {
    s = repairJsxTagBalance(s);
    s = stripExtraTrailingClosers(s);
  }

  return s;
}

/** Always-valid Component when heal cannot recover truncated code. */
export function buildTruncationFallbackComponent(partialSource: string): string {
  const snippet = (partialSource || "")
    .slice(0, 2400)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  return `function Component() {
  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#09090b", color: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "48px auto 16px", border: "1px solid rgba(245,158,11,0.45)", background: "rgba(245,158,11,0.12)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>
          Generation cut off mid-file
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.9, margin: 0 }}>
          The model hit the token limit before finishing a string or tag, so this version cannot compile as-is.
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.75, margin: "12px 0 0" }}>
          In chat, click <strong style={{ color: "#fde68a" }}>Continue</strong> to finish the files, or raise <strong>Max tokens</strong> in Settings and regenerate.
        </p>
      </div>
      <pre style={{ maxWidth: 720, margin: "0 auto", fontSize: 10, lineHeight: 1.4, opacity: 0.4, whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 220, padding: 12, borderRadius: 8, background: "#111113", border: "1px solid #27272a" }}>\`\`\`tsx
${snippet}
\`\`\`</pre>
    </div>
  );
}
`;
}

/** Neutral shell while code is still streaming (not a final cut-off). */
export function buildStreamingPlaceholderComponent(): string {
  return `function Component() {
  return (
    <div style={{ minHeight: "100%", padding: 24, background: "#09090b", color: "#a1a1aa", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", fontSize: 13 }}>
        <div style={{ width: 28, height: 28, margin: "0 auto 12px", borderRadius: "9999px", border: "2px solid #f97316", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <style>{\`@keyframes spin { to { transform: rotate(360deg) } }\`}</style>
        Building live preview…
      </div>
    </div>
  );
}
`;
}

/**
 * Produce source that Babel can compile for the preview iframe.
 * Heals truncation when possible; otherwise returns a clear fallback UI.
 * @param soft — streaming mode: avoid “cut off” messaging; use a building shell if unhealable
 */
export function makePreviewSafeSource(
  source: string,
  opts?: { soft?: boolean }
): {
  code: string;
  truncated: boolean;
  usedFallback: boolean;
} {
  const raw = source || "";
  const analysis = analyzeSourceTruncation(raw);
  const structuralIssue =
    analysis.likelyTruncated ||
    countUnmatchedJsxClosers(raw) > 0 ||
    analysis.parenDelta < 0 ||
    analysis.braceDelta < 0;

  if (!structuralIssue) {
    return { code: raw, truncated: false, usedFallback: false };
  }

  const healed = healTruncatedSource(raw);
  const after = analyzeSourceTruncation(healed);
  const stillBroken =
    after.stringState !== "none" ||
    after.braceDelta !== 0 ||
    after.parenDelta !== 0 ||
    countUnmatchedJsxClosers(healed) > 0 ||
    !healed.trim() ||
    healed.trim().length < 40 ||
    // Classic fatal: closers with no function wrapper left
    (!/\bfunction\s+(Component|App|Page)\b/.test(healed) &&
      !/\bconst\s+(Component|App|Page)\b/.test(healed));

  if (stillBroken) {
    return {
      code: opts?.soft
        ? buildStreamingPlaceholderComponent()
        : buildTruncationFallbackComponent(raw),
      truncated: true,
      usedFallback: true,
    };
  }

  return { code: healed, truncated: true, usedFallback: false };
}

/** Chat prompt when generation hit max tokens mid-file. */
export function buildContinueTruncationPrompt(): string {
  return [
    "The previous generation was CUT OFF mid-file (unterminated string / incomplete JSX).",
    "Continue and complete every incomplete file from where it stopped.",
    "Return FULL complete sources for each file (not only the missing tail).",
    "Keep the same product, layout, and design language — do not restart from scratch.",
    "No TypeScript types, no imports. Entry must define function Component().",
    "Ensure every string, tag, and brace is closed so the preview compiles.",
  ].join("\n");
}
