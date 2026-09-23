/**
 * Preview intercept for @/lib/catalog and @/lib/checkout so studio iframe
 * can mount the agent-ready store without a dual-path LLM dialect.
 *
 * The platform injects CATALOG / PRODUCTS / getProduct / searchProducts /
 * formatMoney / createCheckoutSession once. Generated files must not declare
 * them — merge concatenates into one Babel script, so a second `const PRODUCTS`
 * throws "Identifier 'PRODUCTS' has already been declared".
 */
import { DEFAULT_CATALOG } from "./catalog";

const CATALOG_FROM =
  /import\s+[^;]+from\s+['"](?:@\/)?(?:\.\/|\.\.\/)*lib\/(?:catalog|checkout|commerce-types)['"];?\n?/g;

const INTERCEPT_MARK = "Shipboard Preview Intercept: catalog + checkout";

export const PLATFORM_CATALOG_IDENTS = [
  "PRODUCTS",
  "CATALOG",
  "getProduct",
  "searchProducts",
  "formatMoney",
  "createCheckoutSession",
] as const;

export function isPreviewPlatformFile(path: string): boolean {
  return /(?:^|\/)lib\/(catalog|checkout|commerce-types|orders|channel|ucp)\.(t|j)sx?$/i.test(
    path
  );
}

export function sourceReferencesCatalog(source: string): boolean {
  if (!source) return false;
  if (/@\/lib\/catalog|@\/lib\/checkout/.test(source)) return true;
  if (/\bcreateCheckoutSession\b/.test(source)) return true;
  if (/\bformatMoney\b/.test(source)) return true;
  if (/\bgetProduct\b/.test(source)) return true;
  if (/\bsearchProducts\b/.test(source)) return true;
  if (/\bPRODUCTS\b/.test(source)) return true;
  if (/agent-ready store/i.test(source)) return true;
  return false;
}

/** True if PRODUCTS is bound in this source (const/let/var/function/destructure). */
export function catalogIsDefined(source: string): boolean {
  if (!source) return false;
  if (source.includes(INTERCEPT_MARK)) return true;
  return productBindingCount(source) > 0;
}

export function productBindingCount(source: string): number {
  if (!source) return 0;
  const a = source.match(
    /\b(?:export\s+)?(?:const|let|var|function)\s+PRODUCTS\b/g
  );
  const b = source.match(
    /\b(?:export\s+)?(?:const|let|var)\s*\{[^}]*\bPRODUCTS\b[^}]*\}/g
  );
  return (a?.length ?? 0) + (b?.length ?? 0);
}

function skipString(src: string, i: number): number {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

// Assumes src[i] === "/" and src[i + 1] is "/" or "*". Returns the index just
// past the comment. Braces inside comments must not affect balance counting
// (a `// }` inside a PRODUCTS array once truncated the extracted literal and
// broke the injected `var CATALOG = …` statement).
function skipComment(src: string, i: number): number {
  if (src[i + 1] === "/") {
    let j = i + 2;
    while (j < src.length && src[j] !== "\n") j++;
    return j;
  }
  let j = i + 2;
  while (j < src.length) {
    if (src[j] === "*" && src[j + 1] === "/") return j + 2;
    j++;
  }
  return j;
}

function skipBalanced(src: string, i: number): number {
  const open = src[i];
  const close = open === "{" ? "}" : open === "[" ? "]" : ")";
  let depth = 1;
  i++;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
      i = skipComment(src, i);
      continue;
    }
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) depth--;
    i++;
  }
  return i;
}

function skipType(src: string, i: number): number {
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== ":") return i;
  i++;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
      i = skipComment(src, i);
      continue;
    }
    if (c === "<" || c === "(" || c === "{" || c === "[") {
      depth++;
      i++;
      continue;
    }
    if (c === ">" || c === ")" || c === "}" || c === "]") {
      depth--;
      i++;
      continue;
    }
    if (depth === 0 && (c === "=" || c === ";" || c === "," || c === "\n")) return i;
    i++;
  }
  return i;
}

function skipValue(src: string, start: number): number {
  let i = start;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src.startsWith("async", i)) {
    i += 5;
    while (i < src.length && /\s/.test(src[i])) i++;
  }
  if (src.startsWith("function", i)) {
    const paren = src.indexOf("(", i);
    if (paren < 0) return src.length;
    i = skipBalanced(src, paren);
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === "{") i = skipBalanced(src, i);
    return i;
  }
  // Whole statement, including newlines — do not stop after (window as any)
  // or the next line `.formatMoney ? (wind` poisons the merge.
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
      i = skipComment(src, i);
      continue;
    }
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") {
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    if (depth === 0 && c === ";") {
      i++;
      return i;
    }
    if (depth === 0 && c === "\n") {
      let j = i + 1;
      while (j < src.length && /[ \t]/.test(src[j])) j++;
      const rest = src.slice(j, j + 24);
      const cont = rest.startsWith(".") || rest.startsWith("?") || rest.startsWith(":") || rest.startsWith("&&") || rest.startsWith("||") || rest.startsWith("(");
      if (!cont && /^(export\s+)?(async\s+)?(function|const|let|var|class|interface|type|enum)\b/.test(rest)) {
        return i;
      }
    }
    i++;
  }
  return i;
}

// Skip an optional TS return-type annotation between `)` and `{`
// (e.g. `function formatMoney(cents: number): string {`). Without this the
// strip removed `function formatMoney(cents: number)` and left a stray
// `: string { … }` at the top level — a Babel "Unexpected token" that blocked
// the whole preview. Returns the index of the `{` that opens the body.
function skipReturnType(src: string, i: number): number {
  let j = i;
  while (j < src.length && /\s/.test(src[j])) j++;
  if (src[j] !== ":") return i;
  j++;
  let depth = 0;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'" || c === "`") {
      j = skipString(src, j);
      continue;
    }
    if (c === "/" && (src[j + 1] === "/" || src[j + 1] === "*")) {
      j = skipComment(src, j);
      continue;
    }
    if (c === "<" || c === "(" || c === "[") {
      depth++;
      j++;
      continue;
    }
    if (c === "<" || c === "(" || c === "[") {
      depth++;
      j++;
      continue;
    }
    if (c === "{") {
      if (depth > 0) {
        depth++;
        j++;
        continue;
      }
      // At depth 0 this `{` either opens the function body — or is an
      // object-literal return type (`: { item: any } {`). If the balanced
      // span is followed by another `{`, the first was the type.
      const afterSpan = skipBalanced(src, j);
      let k = afterSpan;
      while (k < src.length && /\s/.test(src[k])) k++;
      return src[k] === "{" ? k : j;
    }
    if (c === ">" || c === ")" || c === "]" || c === "}") {
      if (depth === 0) return j;
      depth--;
      j++;
      continue;
    }
    // `=>` inside a function-type return annotation is part of the type.
    if (c === "=" && src[j + 1] === ">") {
      j += 2;
      continue;
    }
    if (depth === 0 && (c === ";" || c === "=" || c === ",")) return j;
    j++;
  }
  return j;
}

function stripOneDecl(src: string, ident: string): string {
  const patterns = [
    new RegExp(
      `(?:export\\s+)?(?:declare\\s+)?(?:async\\s+)?function\\s+${ident}\\s*\\(`,
      "g"
    ),
    new RegExp(
      `(?:export\\s+)?(?:declare\\s+)?(?:const|let|var)\\s+${ident}\\b`,
      "g"
    ),
    new RegExp(
      `(?:export\\s+)?(?:const|let|var)\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*=`,
      "g"
    ),
  ];
  let out = src;
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(out))) {
      const start = m.index;
      let end: number;
      if (m[0].includes("function")) {
        const paren = out.indexOf("(", start);
        if (paren < 0) break;
        end = skipBalanced(out, paren);
        end = skipReturnType(out, end);
        while (end < out.length && /\s/.test(out[end])) end++;
        if (out[end] === "{") end = skipBalanced(out, end);
      } else if (m[0].includes("{")) {
        end = skipValue(out, start + m[0].length);
      } else {
        let k = start + m[0].length;
        k = skipType(out, k);
        while (k < out.length && /\s/.test(out[k])) k++;
        if (out[k] === "=") {
          end = skipValue(out, k + 1);
        } else {
          end = skipValue(out, k);
        }
      }
      out = out.slice(0, start) + "\n" + out.slice(end);
      re.lastIndex = start;
    }
  }
  return out;
}

/** Remove generated bindings that collide with the platform catalog in iframe scope. */
export function stripPlatformCatalogDeclarations(source: string): string {
  let s = source.replace(CATALOG_FROM, "");
  for (const ident of PLATFORM_CATALOG_IDENTS) {
    s = stripOneDecl(s, ident);
  }
  return s;
}

export function catalogPreviewSource(productsLiteral?: string | null): string {
  const products = productsLiteral?.trim() || JSON.stringify(DEFAULT_CATALOG.products);
  const catalog = JSON.stringify({
    merchant: DEFAULT_CATALOG.merchant,
    brand: DEFAULT_CATALOG.brand,
    description: DEFAULT_CATALOG.description,
    policies: DEFAULT_CATALOG.policies,
  });
  return `/* ── ${INTERCEPT_MARK} ── */
var CATALOG = Object.assign(${catalog}, { products: ${products} });
var PRODUCTS = CATALOG.products;
function getProduct(id) {
  var key = String(id || "").toLowerCase();
  for (var i = 0; i < PRODUCTS.length; i++) {
    var p = PRODUCTS[i];
    if (p.id === id || String(p.sku).toLowerCase() === key || p.gtin === id) return p;
  }
  return null;
}
function searchProducts(query) {
  var q = String(query || "").trim().toLowerCase();
  if (!q) return PRODUCTS.slice();
  return PRODUCTS.filter(function (p) {
    return [p.title, p.description, p.brand, p.sku, p.id].join(" ").toLowerCase().indexOf(q) !== -1;
  });
}
function formatMoney(cents, currency) {
  currency = currency || "usd";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency).toUpperCase() }).format((cents || 0) / 100);
}
async function createCheckoutSession(input) {
  input = input || {};
  return {
    ok: true,
    preview: true,
    id: "cs_preview",
    url: null,
    message: "Stripe Checkout and /.well-known/ucp are attached on eject — same Ready-to-ship gate."
  };
}
try {
  window.CATALOG = CATALOG;
  window.PRODUCTS = PRODUCTS;
  window.getProduct = getProduct;
  window.searchProducts = searchProducts;
  window.formatMoney = formatMoney;
  window.createCheckoutSession = createCheckoutSession;
} catch (e) {}
`;
}

/**
 * Iframe window bridge — runs BEFORE Babel user code.
 * Generated files call (window as any).formatMoney; local function formatMoney
 * inside new Function() is not a window property.
 */
export function previewCommerceWindowBridge(): string {
  return `;(function (w) {
  if (!w) return;
  function money(cents, currency) {
    currency = currency || "usd";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: String(currency).toUpperCase()
      }).format((Number(cents) || 0) / 100);
    } catch (e) {
      return "$" + ((Number(cents) || 0) / 100).toFixed(2);
    }
  }
  function list() {
    if (Array.isArray(w.PRODUCTS)) return w.PRODUCTS;
    if (w.CATALOG && Array.isArray(w.CATALOG.products)) return w.CATALOG.products;
    return [];
  }
  if (typeof w.formatMoney !== "function") w.formatMoney = money;
  if (typeof w.getProduct !== "function") w.getProduct = function (id) {
    var key = String(id || "").toLowerCase();
    var products = list();
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      if (p.id === id || String(p.sku || "").toLowerCase() === key || p.gtin === id) return p;
    }
    return null;
  };
  if (typeof w.searchProducts !== "function") w.searchProducts = function (query) {
    var q = String(query || "").trim().toLowerCase();
    var products = list();
    if (!q) return products.slice();
    return products.filter(function (p) {
      return [p.title, p.description, p.brand, p.sku, p.id].join(" ").toLowerCase().indexOf(q) !== -1;
    });
  };
  if (typeof w.createCheckoutSession !== "function") w.createCheckoutSession = async function (input) {
    input = input || {};
    return {
      ok: true,
      preview: true,
      id: "cs_preview",
      url: null,
      message: "Stripe Checkout and /.well-known/ucp are attached on eject — same Ready-to-ship gate."
    };
  };
})(typeof window !== "undefined" ? window : this);`;
}

/** Pull a user-authored `PRODUCTS = [ ... ]` so custom SKUs survive the intercept. */
export function extractProductsArrayLiteral(source: string): string | null {
  if (!source) return null;
  const re = /(?:export\s+)?(?:const|let|var)\s+PRODUCTS\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let i = skipType(source, m.index + m[0].length);
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== "=") continue;
    i++;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== "[") continue;
    const end = skipBalanced(source, i);
    const lit = source.slice(i, end);
    if (lit.length > 24 && /sku|title|price/.test(lit)) return lit;
  }
  return null;
}

/** Blank out string/template/comment contents (keeping newlines) so structural
 *  scans can't be fooled by copy text. Dependency-free and client-safe. */
function scrubStringsAndComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += " ";
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += " ";
      i++;
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
      const end = skipComment(src, i);
      for (let k = i; k < end; k++) out += src[k] === "\n" ? "\n" : " ";
      i = end;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Dependency-free structural sanity check for TSX (client-safe — no parser
 * dependency). True when delimiters balance with string/template/comment
 * awareness and no statement-position `: Type {` leftover from declaration
 * stripping is present. Conservative by design: valid code always passes;
 * exotic-but-valid constructs are never flagged, only genuinely broken
 * output fails.
 */
export function isStructurallySoundTsx(src: string): boolean {
  if (!src) return true;
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
      i = skipComment(src, i);
      continue;
    }
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      stack.push(c);
      i++;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== pairs[c]) return false;
      i++;
      continue;
    }
    i++;
  }
  if (stack.length !== 0) return false;
  // `: Type {` at statement start = a stripped `function f(...): Type {`
  // whose return type survived. Never valid TSX at that position
  // (ternary `:` is followed by an expression, not `Ident {`).
  const scrubbed = scrubStringsAndComments(src);
  if (/^[ \t]*:[ \t]*[A-Za-z_$][\w$]*[ \t]*\{/m.test(scrubbed)) return false;
  return true;
}

export function applyCatalogPreviewIntercept(source: string): {
  code: string;
  applied: boolean;
} {
  if (!sourceReferencesCatalog(source) && productBindingCount(source) === 0) {
    return { code: source, applied: false };
  }
  const custom = extractProductsArrayLiteral(source);
  const stripped = stripPlatformCatalogDeclarations(source);
  const code = catalogPreviewSource(custom) + "\n" + stripped;
  // Defense in depth: the intercept must never be the reason a preview fails
  // to compile. If the rewrite is not structurally sound, serve the
  // un-intercepted source — downstream sanitize/heal stages have their own
  // fallbacks for genuinely broken input.
  if (!isStructurallySoundTsx(code)) {
    return { code: source, applied: false };
  }
  return { code, applied: true };
}
