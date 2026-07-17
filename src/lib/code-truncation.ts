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

    // not in string
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
      // line comment
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

  // Ends mid-line without closing Component-ish patterns
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

  // File clearly starts a Component but never closes
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

/**
 * Best-effort close of truncated TSX so Babel can parse something.
 * Not perfect — goal is partial preview + clear path to continue gen.
 */
export function healTruncatedSource(source: string): string {
  if (!source?.trim()) return source;
  let s = source;
  let a = analyzeSourceTruncation(s);

  if (!a.likelyTruncated && a.stringState === "none" && a.braceDelta <= 0) {
    return s;
  }

  // Close open string / template
  if (a.stringState === "double") s += '"';
  else if (a.stringState === "single") s += "'";
  else if (a.stringState === "template") s += "`";

  // Incomplete open tag on last line → self-close
  const lastLine = (s.split("\n").pop() || "").trimEnd();
  if (/<[A-Za-z][\w.-]*(\s|$)[^>]*$/.test(lastLine) && !lastLine.includes("</")) {
    if (!/>\s*$/.test(lastLine)) {
      s += " />";
    }
  }

  a = analyzeSourceTruncation(s);

  // Close open groups (strings closed first so counts are real)
  while (a.parenDelta > 0) {
    s += ")";
    a.parenDelta--;
  }
  while (a.bracketDelta > 0) {
    s += "]";
    a.bracketDelta--;
  }

  // If mid-return JSX, close expression then function braces
  const needsReturnClose =
    /\breturn\s*\(\s*$/m.test(s) ||
    (/\breturn\s*\(/.test(s) && a.parenDelta === 0 && a.braceDelta > 0);

  if (needsReturnClose && !/\)\s*;?\s*$/.test(s.trimEnd())) {
    // Only add ); if we still have open parens from return — already closed parens above
    // Prefer wrapping incomplete tree
    if (!/;\s*$/.test(s.trimEnd())) {
      // already balanced parens; ensure statement end
    }
  }

  // Close remaining braces for Component / functions
  while (a.braceDelta > 0) {
    s += "\n}";
    a.braceDelta--;
  }

  // If still no Component closed cleanly, append a tiny safe fallback
  if (
    /\bfunction\s+Component\s*\(/.test(s) &&
    analyzeSourceTruncation(s).braceDelta > 0
  ) {
    const again = analyzeSourceTruncation(s);
    while (again.braceDelta > 0) {
      s += "\n}";
      again.braceDelta--;
    }
  }

  return s;
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
