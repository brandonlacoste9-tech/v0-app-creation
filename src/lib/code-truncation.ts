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
  if (paren > 0) reasons.push(`${paren} unclosed paren(s)`);
  if (bracket > 0) reasons.push(`${bracket} unclosed bracket(s)`);

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
    reasons.some((r) =>
      /unterminated|mid-JSX|not closed|unclosed brace/.test(r)
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
 * Best-effort close of truncated TSX so Babel can parse something.
 * Strips the incomplete tail rather than inventing half attributes.
 */
export function healTruncatedSource(source: string): string {
  if (!source?.trim()) return source;

  let s = source.replace(/\r\n/g, "\n");
  const initial = analyzeSourceTruncation(s);
  if (!initial.likelyTruncated && initial.stringState === "none") {
    return s;
  }

  s = stripOpenStringTail(s);
  s = stripIncompleteOpenTag(s.trimEnd());

  // Drop trailing incomplete lines that still look mid-expression
  const lines = s.split("\n");
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    if (
      !last ||
      /[=,({\[]\s*$/.test(last) ||
      /^(const|let|var|function|return|if|else|map|className)\b/.test(last) &&
        !/[;}>)]\s*$/.test(last)
    ) {
      // keep return ( if we need structure — only drop pure junk tails
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

  s = closeOpenJsxTags(s);

  let a = analyzeSourceTruncation(s);
  while (a.parenDelta > 0) {
    s += ")";
    a.parenDelta--;
  }
  while (a.bracketDelta > 0) {
    s += "]";
    a.bracketDelta--;
  }
  // statement terminator before closing braces if mid-return
  if (/\breturn\s*\(/.test(s) && !/\)\s*;?\s*$/.test(s.trimEnd())) {
    if (!/\)\s*$/.test(s.trimEnd())) {
      // parens already balanced — ensure ;
    } else if (!/;\s*$/.test(s.trimEnd())) {
      s += ";";
    }
  } else if (!/[;})]\s*$/.test(s.trimEnd()) && a.braceDelta > 0) {
    s += ";";
  }

  a = analyzeSourceTruncation(s);
  while (a.braceDelta > 0) {
    s += "\n}";
    a.braceDelta--;
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
  if (!analysis.likelyTruncated) {
    return { code: raw, truncated: false, usedFallback: false };
  }

  const healed = healTruncatedSource(raw);
  const after = analyzeSourceTruncation(healed);
  const stillBroken =
    after.stringState !== "none" ||
    after.braceDelta > 0 ||
    after.parenDelta > 2 ||
    !healed.trim() ||
    healed.trim().length < 40;

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
