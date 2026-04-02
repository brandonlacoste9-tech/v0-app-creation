import React from "react"

type TokenType =
  | "keyword"
  | "comment"
  | "string"
  | "template"
  | "tag"
  | "attribute"
  | "function"
  | "number"
  | "operator"
  | "punctuation"
  | "type"
  | "import-path"
  | "other"

interface Token {
  type: TokenType
  value: string
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "text-violet-400",
  comment: "text-zinc-500",
  string: "text-emerald-400",
  template: "text-emerald-400",
  tag: "text-sky-400",
  attribute: "text-amber-300",
  function: "text-amber-300",
  number: "text-orange-400",
  operator: "text-pink-400",
  punctuation: "text-zinc-400",
  type: "text-cyan-400",
  "import-path": "text-emerald-400/80",
  other: "text-foreground",
}

const KEYWORDS = new Set([
  "import",
  "export",
  "default",
  "from",
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "class",
  "extends",
  "new",
  "typeof",
  "instanceof",
  "void",
  "null",
  "undefined",
  "true",
  "false",
  "async",
  "await",
  "type",
  "interface",
  "enum",
  "as",
  "implements",
  "static",
  "readonly",
  "private",
  "public",
  "protected",
  "try",
  "catch",
  "finally",
  "throw",
  "switch",
  "case",
  "break",
  "continue",
  "do",
  "in",
  "of",
])

const TYPE_KEYWORDS = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "any",
  "unknown",
  "never",
  "void",
  "React",
  "ReactNode",
  "FC",
  "JSX",
])

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < line.length) {
    // Whitespace
    if (/\s/.test(line[i])) {
      let value = ""
      while (i < line.length && /\s/.test(line[i])) {
        value += line[i++]
      }
      tokens.push({ type: "other", value })
      continue
    }

    // Single-line comment
    if (line.slice(i, i + 2) === "//") {
      tokens.push({ type: "comment", value: line.slice(i) })
      break
    }

    // Multi-line comment start (simplified - doesn't handle spanning lines)
    if (line.slice(i, i + 2) === "/*") {
      const end = line.indexOf("*/", i + 2)
      if (end !== -1) {
        tokens.push({ type: "comment", value: line.slice(i, end + 2) })
        i = end + 2
        continue
      } else {
        tokens.push({ type: "comment", value: line.slice(i) })
        break
      }
    }

    // String literals
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i]
      let value = quote
      i++
      while (i < line.length && line[i] !== quote) {
        if (line[i] === "\\" && i + 1 < line.length) {
          value += line[i++]
        }
        value += line[i++]
      }
      if (i < line.length) value += line[i++]

      // Check if it's an import path
      const isImportPath = tokens.some(
        (t) => t.type === "keyword" && (t.value === "from" || t.value === "import")
      )
      tokens.push({
        type: isImportPath ? "import-path" : quote === "`" ? "template" : "string",
        value,
      })
      continue
    }

    // JSX tags
    if (line[i] === "<") {
      // Closing tag or opening tag
      const match = line.slice(i).match(/^(<\/?[A-Za-z][A-Za-z0-9]*|<\/>)/)
      if (match) {
        tokens.push({ type: "tag", value: match[0] })
        i += match[0].length
        continue
      }
      // Self-closing or comparison
      tokens.push({ type: "operator", value: line[i++] })
      continue
    }

    // Closing JSX tag bracket
    if (line[i] === ">") {
      tokens.push({ type: "tag", value: ">" })
      i++
      continue
    }

    // Numbers
    if (/\d/.test(line[i])) {
      let value = ""
      while (i < line.length && /[\d.xXa-fA-F_n]/.test(line[i])) {
        value += line[i++]
      }
      tokens.push({ type: "number", value })
      continue
    }

    // Identifiers and keywords
    if (/[A-Za-z_$]/.test(line[i])) {
      let value = ""
      while (i < line.length && /[A-Za-z0-9_$]/.test(line[i])) {
        value += line[i++]
      }

      // Check if followed by ( to identify function calls
      const isFunction = line[i] === "("

      if (KEYWORDS.has(value)) {
        tokens.push({ type: "keyword", value })
      } else if (TYPE_KEYWORDS.has(value)) {
        tokens.push({ type: "type", value })
      } else if (isFunction) {
        tokens.push({ type: "function", value })
      } else if (value[0] === value[0].toUpperCase() && /^[A-Z]/.test(value)) {
        // PascalCase - likely a component or type
        tokens.push({ type: "type", value })
      } else {
        tokens.push({ type: "other", value })
      }
      continue
    }

    // Operators
    if (/[+\-*/%=!&|^~?:]/.test(line[i])) {
      let value = line[i++]
      // Handle multi-char operators
      while (i < line.length && /[+\-*/%=!&|^~?:<>]/.test(line[i])) {
        value += line[i++]
      }
      tokens.push({ type: "operator", value })
      continue
    }

    // Punctuation
    if (/[{}()\[\];,.]/.test(line[i])) {
      tokens.push({ type: "punctuation", value: line[i++] })
      continue
    }

    // Everything else
    tokens.push({ type: "other", value: line[i++] })
  }

  return tokens
}

export function highlightCode(code: string): React.ReactNode[] {
  const lines = code.split("\n")

  return lines.map((line, lineIdx) => {
    const tokens = tokenizeLine(line)

    return (
      <div key={lineIdx} className="flex">
        <span className="select-none w-10 shrink-0 text-right pr-4 text-muted-foreground/40 text-xs leading-5 font-mono">
          {lineIdx + 1}
        </span>
        <span className="flex-1 leading-5 text-xs font-mono whitespace-pre">
          {tokens.map((token, tokenIdx) => (
            <span key={tokenIdx} className={TOKEN_COLORS[token.type]}>
              {token.value}
            </span>
          ))}
        </span>
      </div>
    )
  })
}

export function extractCodeBlocks(text: string): { code: string; language: string }[] {
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  const blocks: { code: string; language: string }[] = []
  let match

  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
    })
  }

  return blocks
}
