import type { PreviewTheme } from "./types";
import type { DatabaseSchemaMap } from "./byob/types";
import { mergeForPreview } from "./project-files";
import { getPreviewBridgeScript } from "./browser/preview-bridge";
import { makePreviewSafeSource } from "./code-truncation";
import {
  applyPreviewActionIntercept,
  getPreviewInterceptBabelPluginSource,
  sourceReferencesActions,
} from "./byob/preview-intercept";

/**
 * Strip a balanced `<...>` generic type argument list starting at `start`
 * (position of `<`). Returns end index after `>`, or -1 if not a type generic.
 * Tracks paren/brace depth and ignores `=>` so `useCallback<(v: string) => void>` works.
 */
function skipTypeGeneric(s: string, start: number): number {
  if (s[start] !== "<") return -1;
  let depth = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === "(") paren++;
    else if (ch === ")" && paren) paren--;
    else if (ch === "{") brace++;
    else if (ch === "}" && brace) brace--;
    else if (ch === "[") bracket++;
    else if (ch === "]" && bracket) bracket--;
    else if (ch === "<" && paren === 0 && brace === 0 && bracket === 0) depth++;
    else if (ch === ">" && paren === 0 && brace === 0 && bracket === 0) {
      // Don't treat arrow `=>` as a generic closer
      if (i > 0 && s[i - 1] === "=") continue;
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Remove `type Name = ...` aliases (RHS may contain `;` inside object types).
 */
function stripTypeAliases(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const atLineStart = i === 0 || source[i - 1] === "\n";
    if (atLineStart) {
      let j = i;
      while (j < source.length && (source[j] === " " || source[j] === "\t")) j++;
      const slice = source.slice(j);
      const m = slice.match(/^(?:export\s+)?type\s+[A-Za-z_$][\w$]*(?:\s*<[^>]*>)?\s*=/);
      if (m && m.index === 0) {
        let k = j + m[0].length;
        let depthAngle = 0;
        let depthBrace = 0;
        let depthParen = 0;
        let depthBracket = 0;
        while (k < source.length) {
          const ch = source[k];
          if (ch === "<") depthAngle++;
          else if (ch === ">" && depthAngle) {
            if (k > 0 && source[k - 1] === "=") {
              k++;
              continue;
            }
            depthAngle--;
          } else if (ch === "{") depthBrace++;
          else if (ch === "}" && depthBrace) depthBrace--;
          else if (ch === "(") depthParen++;
          else if (ch === ")" && depthParen) depthParen--;
          else if (ch === "[") depthBracket++;
          else if (ch === "]" && depthBracket) depthBracket--;
          else if (
            ch === ";" &&
            depthAngle === 0 &&
            depthBrace === 0 &&
            depthParen === 0 &&
            depthBracket === 0
          ) {
            k++;
            if (source[k] === "\r") k++;
            if (source[k] === "\n") k++;
            i = k;
            break;
          } else if (
            ch === "\n" &&
            depthAngle === 0 &&
            depthBrace === 0 &&
            depthParen === 0 &&
            depthBracket === 0
          ) {
            // type alias without semicolon
            i = k + 1;
            break;
          }
          k++;
          if (k >= source.length) {
            i = k;
            break;
          }
        }
        if (i !== j) continue;
      }
    }
    out += source[i];
    i++;
  }
  return out;
}

/**
 * Remove `interface` / `enum` declarations with balanced `{...}` braces.
 * Regex-only approaches often swallow the following function body.
 */
function stripBraceTypeDeclarations(source: string): string {
  const keyword =
    /(?:export\s+)?(?:interface|enum)\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[^{]+)?/;
  let out = "";
  let i = 0;
  while (i < source.length) {
    const atLineStart = i === 0 || source[i - 1] === "\n";
    if (atLineStart) {
      // skip leading whitespace on the line
      let j = i;
      while (j < source.length && (source[j] === " " || source[j] === "\t")) j++;
      const slice = source.slice(j);
      const m = slice.match(keyword);
      if (m && m.index === 0) {
        let k = j + m[0].length;
        while (k < source.length && /\s/.test(source[k])) k++;
        if (source[k] === "{") {
          let depth = 0;
          for (; k < source.length; k++) {
            const ch = source[k];
            if (ch === "{") depth++;
            else if (ch === "}") {
              depth--;
              if (depth === 0) {
                k++; // past closing }
                while (k < source.length && (source[k] === ";" || source[k] === " " || source[k] === "\t"))
                  k++;
                if (source[k] === "\r") k++;
                if (source[k] === "\n") k++;
                i = k;
                break;
              }
            }
          }
          if (depth === 0) continue;
        }
      }
    }
    out += source[i];
    i++;
  }
  return out;
}

/**
 * Strip TypeScript-only syntax so the iframe can compile with Babel react-only.
 * Keeps JSX and modern JS intact. Prefer aggressive strip over relying on
 * @babel/preset-typescript (CDN option quirks leave residual errors as red codes).
 */
export function sanitizePreviewSource(source: string): string {
  let s = source
    // imports / exports (preview has no module graph)
    .replace(/import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, "")
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, "")
    .replace(/import\s+['"][^'"]+['"]\s*;?/g, "")
    .replace(/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/g, "({})")
    .replace(/export\s+type\s+\{[^}]*\}\s*;?/g, "")
    .replace(/export\s+type\s+\w+[^=]*=\s*[^;]+;?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  // interface / enum via balanced braces (never eat following Component body)
  s = stripBraceTypeDeclarations(s);
  // type aliases (RHS may contain `;` inside `{ a: string; b: number }`)
  s = stripTypeAliases(s);

  s = s
    // declare ...
    .replace(/^\s*declare\s+[\s\S]*?;?\s*$/gm, "")
    // `as const` / `as Type` / satisfies (incl. object types)
    .replace(/\s+as\s+const\b/g, "")
    .replace(/\s+as\s+[A-Za-z0-9_.<>,\s|&\[\]'"]+/g, "")
    .replace(/\s+satisfies\s+(?:\{[^}]*\}|\[[^\]]*\]|[A-Za-z0-9_.<>,\s|&\[\]]+)/g, "");

  // Call/new generics: useState<number>(0), useRef<HTMLDivElement | null>(null)
  // Only strip when `<...>` is immediately followed by `(` so JSX stays intact.
  {
    let out = "";
    let i = 0;
    while (i < s.length) {
      if (/[A-Za-z_$]/.test(s[i])) {
        const start = i;
        i++;
        while (i < s.length && /[\w$]/.test(s[i])) i++;
        const ident = s.slice(start, i);
        let j = i;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === "<") {
          const endGen = skipTypeGeneric(s, j);
          if (endGen > 0) {
            let k = endGen;
            while (k < s.length && /\s/.test(s[k])) k++;
            if (s[k] === "(") {
              out += ident;
              i = endGen;
              continue;
            }
          }
        }
        out += ident;
        continue;
      }
      out += s[i];
      i++;
    }
    s = out;
  }

  // function Component<TProps>(  /  function Foo<T extends X>(
  s = s.replace(
    /\b(function\s+[A-Za-z_$][\w$]*)\s*<[^>]*(?:extends\s+[^>]*)?>/g,
    "$1"
  );
  // Arrow generic: const X = <T,>(props) =>  /  const X = <T extends Foo>(
  s = s.replace(
    /=\s*<[A-Za-z_$][\w$,\s]*(?:extends\s+[A-Za-z0-9_.<>,\s|&\[\]]+)?>\s*\(/g,
    "= ("
  );

  // Param type annotations — simple: (x: string) / (x: string, y: number)
  s = s.replace(
    /(\(|,)\s*([A-Za-z_$][\w$]*)\s*\??\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]?:'"]+(?=\s*[,)=])/g,
    "$1$2"
  );
  // Destructured params with type: ({ title }: Props) / ([a, b]: Tuple)
  s = s.replace(
    /(\(|,)\s*(\{[^}]*\}|\[[^\]]*\])\s*\??\s*:\s*(?:\{[^}]*\}|\[[^\]]*\]|[A-Za-z0-9_.<>,\s|&\[\]?:'"]+)(?=\s*[,)=])/g,
    "$1$2"
  );
  // Nested object type on destructure once more (if residual)
  s = s.replace(
    /(\(|,)\s*(\{[^}]*\}|\[[^\]]*\])\s*\??\s*:\s*\{[^}]*\}(?=\s*[,)=])/g,
    "$1$2"
  );

  // const/let/var annotations including React.FC<{...}>, generics, object types
  // Scanner: after `const name:` skip type until top-level `=`
  {
    const re = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*[!]?\s*:/g;
    let out = "";
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      let k = m.index + m[0].length;
      let depthAngle = 0;
      let depthBrace = 0;
      let depthParen = 0;
      let depthBracket = 0;
      while (k < s.length) {
        const ch = s[k];
        if (ch === "<") depthAngle++;
        else if (ch === ">" && depthAngle) {
          // ignore arrow `=>` inside type positions
          if (k > 0 && s[k - 1] === "=") {
            k++;
            continue;
          }
          depthAngle--;
        } else if (ch === "{") depthBrace++;
        else if (ch === "}" && depthBrace) depthBrace--;
        else if (ch === "(") depthParen++;
        else if (ch === ")" && depthParen) depthParen--;
        else if (ch === "[") depthBracket++;
        else if (ch === "]" && depthBracket) depthBracket--;
        else if (
          ch === "=" &&
          depthAngle === 0 &&
          depthBrace === 0 &&
          depthParen === 0 &&
          depthBracket === 0
        ) {
          // avoid `=>`
          if (s[k + 1] === ">") {
            k++;
            continue;
          }
          out += s.slice(last, m.index) + m[1] + " " + m[2] + " ";
          last = k; // keep `=`
          break;
        } else if (ch === "\n" && depthAngle === 0 && depthBrace === 0) {
          // give up on multi-line type without `=`
          break;
        }
        k++;
      }
      re.lastIndex = Math.max(re.lastIndex, k);
    }
    out += s.slice(last);
    s = out;
  }
  // tuple/object annotations on destructure binding
  s = s.replace(
    /\b(const|let|var)\s+(\[[^\]]+\]|\{[^}]+\})\s*:\s*(?:\{[^}]*\}|\[[^\]]*\]|[A-Za-z0-9_.<>,\s|&\[\]]+)\s*=/g,
    "$1 $2 ="
  );

  // return types: function Foo(): JSX.Element {  /  ): Promise<void> =>
  s = s.replace(/\)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]?:]+\s*\{/g, ") {");
  s = s.replace(/\)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]?:]+\s*=>/g, ") =>");

  // Class field / param modifiers leftover
  s = s.replace(
    /\b(public|private|protected|readonly|override|abstract)\s+(?=[A-Za-z_$])/g,
    ""
  );

  // non-null assertions only when followed by . [ (  (don't break Tailwind !flex)
  s = s.replace(/([A-Za-z0-9_)\]]+)!(?=[.\[(])/g, "$1");

  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Wrap TSX component source into a self-contained preview HTML document. */
export function wrapCodeForPreview(
  code: string,
  theme: PreviewTheme,
  mockData: string = "{}",
  opts?: {
    softHeal?: boolean;
    /** BYOB schema — enables true preview intercept for @/app/actions */
    byobSchema?: DatabaseSchemaMap | null;
  }
): string {
  // Multi-file projects merge into one script scope for the iframe
  let source = "";
  try {
    source = code.trim().startsWith("{") ? mergeForPreview(code) : code;
  } catch {
    source = code;
  }

  // True Preview Intercept: production `import { x } from "@/app/actions"`
  // → in-memory functions with the same names (LLM never dual-paths)
  const byob = opts?.byobSchema;
  if (byob?.tables?.length || sourceReferencesActions(source)) {
    const intercepted = applyPreviewActionIntercept(source, byob);
    source = intercepted.code;
  }

  let cleaned = sanitizePreviewSource(source);
  // Always make truncated / mid-stream source Babel-safe (heal or fallback UI)
  const safe = makePreviewSafeSource(cleaned, { soft: Boolean(opts?.softHeal) });
  cleaned = safe.code;
  const darkClass = theme.mode === "dark" ? "dark" : "";
  // Escape </script> in user code so it can't break out of the babel script tag
  const safeCode = cleaned.replace(/<\/script/gi, "<\\/script");
  const babelPluginSrc = getPreviewInterceptBabelPluginSource();

  let mockJson = "{}";
  try {
    mockJson = JSON.stringify(JSON.parse(mockData || "{}"));
  } catch {
    mockJson = "{}";
  }

  const fg = escapeHtmlAttr(theme.fg);
  const bg = escapeHtmlAttr(theme.bg);

  // Bridge must not break the outer HTML script element
  const bridge = getPreviewBridgeScript()
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '${theme.bg}',
            foreground: '${theme.fg}',
            card: '${theme.card}',
            border: '${theme.cardBorder}',
            muted: '${theme.muted}',
            'muted-foreground': '${theme.mutedFg}',
            primary: '${theme.accent}',
            secondary: '${theme.muted}',
            accent: '${theme.muted}',
          }
        }
      }
    }
  <\/script>
  <style>
    html, body { height: 100%; }
    body {
      background: ${bg};
      color: ${fg};
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
    * { box-sizing: border-box; }
    #root { min-height: 100vh; }
    #adgen-error {
      display: none;
      position: relative;
      margin: 0;
      padding: 0.75rem 2.5rem 0.75rem 1rem;
      background: #18181b;
      color: #fca5a5;
      font: 12px/1.5 ui-monospace, monospace;
      white-space: pre-wrap;
      border-bottom: 1px solid #3f3f46;
      max-height: 40vh;
      overflow-y: auto;
      z-index: 9999;
    }
    #adgen-error-dismiss {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      border: 0;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 4px 6px;
    }
    #adgen-error-dismiss:hover { color: #fafafa; }
  </style>
</head>
<body class="${darkClass}">
  <pre id="adgen-error"><button type="button" id="adgen-error-dismiss" aria-label="Dismiss" title="Dismiss">×</button><span id="adgen-error-text"></span></pre>
  <div id="root"></div>
  <script>${bridge}<\/script>
  <script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js" crossorigin><\/script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.9/babel.min.js"><\/script>
  <script>
    (function () {
      var errEl = document.getElementById('adgen-error');
      var errText = document.getElementById('adgen-error-text');
      var rootEl = document.getElementById('root');
      var dismissBtn = document.getElementById('adgen-error-dismiss');
      var renderedOk = false;
      var fatalShown = false;

      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          if (errEl) errEl.style.display = 'none';
        });
      }

      function showError(msg, opts) {
        opts = opts || {};
        var fatal = !!opts.fatal;
        // Don't clobber a successful paint with noisy CDN / network errors
        if (!fatal && renderedOk) return;
        if (!fatal && rootEl && rootEl.childElementCount > 0) return;
        if (!errEl || !errText) return;
        fatalShown = fatalShown || fatal;
        errEl.style.display = 'block';
        errText.textContent = 'Preview error: ' + msg;
        if (fatal && rootEl && !rootEl.childElementCount) {
          rootEl.innerHTML = '<div style="padding:2rem;color:${fg};opacity:0.7;font-family:system-ui;font-size:14px;">Could not render this version. Open the Code tab, try Fix from QA, or regenerate.</div>';
        }
      }

      // Only treat runtime errors as fatal if they look like app code failures
      window.addEventListener('error', function (e) {
        try {
          // Resource load failures (script/img) — ignore unless nothing rendered
          if (e && e.target && e.target !== window && e.target.tagName) {
            var tag = String(e.target.tagName || '').toLowerCase();
            if (tag === 'script' || tag === 'link' || tag === 'img') {
              if (!renderedOk && rootEl && !rootEl.childElementCount) {
                showError('A CDN asset failed to load (network or blocked).', { fatal: true });
              }
              return;
            }
          }
          var msg = (e && e.message) ? e.message : String((e && e.error) || 'Unknown error');
          // Cross-origin noise
          if (!msg || msg === 'Script error.' || msg === 'Script error') return;
          // Tailwind/chrome extensions noise
          if (/tailwind|ResizeObserver|Loading CSS/i.test(msg)) return;
          // Friendlier message for leftover server/Node symbols
          var undef = msg.match(/ReferenceError:\\s*([\\w$]+)\\s+is not defined/i)
            || msg.match(/([\\w$]+) is not defined/i);
          if (undef && undef[1]) {
            var name = undef[1];
            if (/^(write|read|require|Buffer|process|module|exports|__dirname|__filename)$/.test(name)) {
              msg = name + ' is not defined — server/Node API left in the UI code. Preview only supports React + browser APIs. Use Fix from QA or regenerate without Node imports.';
            } else if (/^[A-Z]/.test(name)) {
              msg = '<' + name + ' /> is not defined — missing component (often a broken multi-file merge or icon import). Prefer multi-file with function ' + name + '() defined, no imports.';
            }
          }
          if (/Unterminated string constant|Unexpected token|Unexpected end of input|Missing semicolon/i.test(msg)) {
            msg = msg + ' — generation often cut off at the token limit. In chat: “Continue the incomplete file and close all strings/tags”, or raise Max tokens in Settings.';
          }
          showError(msg, { fatal: !renderedOk });
        } catch (_) {}
      }, true);

      window.addEventListener('unhandledrejection', function (e) {
        try {
          var reason = e && e.reason;
          var msg = reason && reason.message ? reason.message : String(reason || 'Promise rejection');
          if (!renderedOk) showError(msg, { fatal: true });
        } catch (_) {}
      });

      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        showError('React failed to load (CDN blocked?). Try refresh or check network.', { fatal: true });
        return;
      }
      if (typeof Babel === 'undefined') {
        showError('Babel failed to load (CDN blocked?). Try refresh or check network.', { fatal: true });
        return;
      }

      var source = ${JSON.stringify(safeCode)};
      var MOCK_DATA = ${mockJson};

      try {
        // Remove leftover @/app/actions imports if any survived sanitize
        var __shipboardPreviewIntercept = ${babelPluginSrc};
        // Source is pre-stripped of TS — prefer react-only (CDN TS preset is flaky)
        var reactPreset = ['react', { runtime: 'classic' }];
        var tsPreset = ['typescript', { isTSX: true, allExtensions: true }];
        var pluginsWith = [__shipboardPreviewIntercept];
        var transformed;
        var firstErr = null;

        function tryTransform(presets, plugins, filename) {
          return Babel.transform(source, {
            presets: presets,
            plugins: plugins || [],
            filename: filename,
            // Avoid Babel wrapping in a way that hides declarations
            sourceType: 'script',
          }).code;
        }

        try {
          transformed = tryTransform([reactPreset], pluginsWith, 'Component.jsx');
        } catch (e1) {
          firstErr = e1;
          try {
            // Residual TS? Try with typescript preset
            transformed = tryTransform([reactPreset, tsPreset], pluginsWith, 'Component.tsx');
          } catch (e2) {
            firstErr = e2;
            try {
              // Plugin may be the culprit — react only, no plugins
              transformed = tryTransform([reactPreset], [], 'Component.jsx');
            } catch (e3) {
              firstErr = e3;
              try {
                transformed = tryTransform([reactPreset, tsPreset], [], 'Component.tsx');
              } catch (e4) {
                firstErr = e4;
                // Last resort: guaranteed-compile fallback UI.
                // Bake the message into the source string — do NOT close over
                // firstErr (new Function scope cannot see outer locals).
                var errMsg =
                  (firstErr && firstErr.message) ? String(firstErr.message) : String(firstErr || "Syntax error");
                // Cap length so a huge parse error doesn't bloat the iframe doc
                if (errMsg.length > 400) errMsg = errMsg.slice(0, 400) + "…";
                var fallback =
                  'function Component(){return React.createElement("div",{style:{minHeight:"100vh",padding:24,background:"#09090b",color:"#fafafa",fontFamily:"system-ui"}},' +
                  'React.createElement("div",{style:{maxWidth:520,margin:"48px auto",padding:20,borderRadius:12,border:"1px solid rgba(245,158,11,0.45)",background:"rgba(245,158,11,0.12)"}},' +
                  'React.createElement("div",{style:{fontWeight:700,color:"#fbbf24",marginBottom:8}},"Preview could not compile"),' +
                  'React.createElement("p",{style:{fontSize:13,lineHeight:1.5,opacity:0.9,margin:0}},' +
                  JSON.stringify(errMsg) +
                  '),' +
                  'React.createElement("p",{style:{fontSize:12,opacity:0.7,marginTop:12}},"Send Continue in chat or raise Max tokens in Settings.")));}';
                transformed = Babel.transform(fallback, {
                  presets: [reactPreset],
                  filename: 'Fallback.jsx',
                  sourceType: 'script',
                }).code;
                showError(
                  errMsg + ' — showing recovery UI. Continue generation to finish the file.',
                  { fatal: false }
                );
              }
            }
          }
        }

        // Hooks + shims injected into the Function scope for generated code
        var useState = React.useState;
        var useEffect = React.useEffect;
        var useRef = React.useRef;
        var useCallback = React.useCallback;
        var useMemo = React.useMemo;
        var useReducer = React.useReducer;
        var createContext = React.createContext;
        var useContext = React.useContext;
        var Fragment = React.Fragment;
        var useLayoutEffect = React.useLayoutEffect;
        var useId = React.useId || function () { return 'adgen-id'; };

        function __adgenNoop() { return undefined; }
        function __adgenStubFn(name) {
          return function () {
            try { console.warn('[Shipboard preview] ' + name + '() is not available in the browser preview'); } catch (_) {}
            return undefined;
          };
        }
        var require = function (id) {
          try { console.warn('[Shipboard preview] require("' + id + '") is not available'); } catch (_) {}
          return new Proxy({}, {
            get: function (_t, prop) {
              if (prop === '__esModule') return true;
              if (prop === 'default') return __adgenNoop;
              return __adgenStubFn(String(prop));
            }
          });
        };
        var module = { exports: {} };
        var exports = module.exports;
        var process = { env: { NODE_ENV: 'development' }, browser: true };
        var write = __adgenStubFn('write');
        var read = __adgenStubFn('read');
        var readFile = __adgenStubFn('readFile');
        var writeFile = __adgenStubFn('writeFile');
        var readFileSync = __adgenStubFn('readFileSync');
        var writeFileSync = __adgenStubFn('writeFileSync');
        var open = typeof open === 'function' ? open : __adgenStubFn('open');
        var Buffer = {
          from: function (v) {
            return {
              toString: function () { return typeof v === 'string' ? v : ''; },
              length: 0
            };
          },
          isBuffer: function () { return false; }
        };

        // new Function (not eval): function declarations are visible for the return.
        // eval() under "use strict" keeps Component invisible → false "No Component" reds.
        var __loader = new Function(
          'React', 'ReactDOM', 'useState', 'useEffect', 'useRef', 'useCallback',
          'useMemo', 'useReducer', 'createContext', 'useContext', 'Fragment',
          'useLayoutEffect', 'useId', 'require', 'module', 'exports', 'process',
          'Buffer', 'write', 'read', 'readFile', 'writeFile', 'readFileSync',
          'writeFileSync', 'open', 'MOCK_DATA',
          transformed +
            '\\n;\\n' +
            'var __entry = null;\\n' +
            'try { if (typeof Component === "function") __entry = Component; } catch(_) {}\\n' +
            'try { if (!__entry && typeof App === "function") __entry = App; } catch(_) {}\\n' +
            'try { if (!__entry && typeof Page === "function") __entry = Page; } catch(_) {}\\n' +
            'try { if (!__entry && module && module.exports) {\\n' +
            '  var ex = module.exports;\\n' +
            '  if (typeof ex === "function") __entry = ex;\\n' +
            '  else if (ex && typeof ex.default === "function") __entry = ex.default;\\n' +
            '  else if (ex && typeof ex.Component === "function") __entry = ex.Component;\\n' +
            '} } catch(_) {}\\n' +
            'return __entry;'
        );

        var ComponentToRender = __loader(
          React, ReactDOM, useState, useEffect, useRef, useCallback,
          useMemo, useReducer, createContext, useContext, Fragment,
          useLayoutEffect, useId, require, module, exports, process,
          Buffer, write, read, readFile, writeFile, readFileSync,
          writeFileSync, open, MOCK_DATA
        );

        if (!ComponentToRender) {
          showError('No function Component() found. Entry must define Component().', { fatal: true });
          return;
        }

        // Lightweight error boundary so render throws show a clean message
        class PreviewBoundary extends React.Component {
          constructor(props) {
            super(props);
            this.state = { err: null };
          }
          static getDerivedStateFromError(err) {
            return { err: err };
          }
          componentDidCatch(err) {
            showError((err && err.message) ? err.message : String(err), { fatal: true });
          }
          render() {
            if (this.state.err) {
              return React.createElement(
                'div',
                { style: { padding: '2rem', color: '${fg}', opacity: 0.8, fontFamily: 'system-ui', fontSize: 14 } },
                'Component crashed: ',
                String(this.state.err.message || this.state.err)
              );
            }
            return this.props.children;
          }
        }

        var root = ReactDOM.createRoot(rootEl);
        root.render(
          React.createElement(
            PreviewBoundary,
            null,
            React.createElement(ComponentToRender, MOCK_DATA)
          )
        );

        // Mark success once DOM has children
        var tries = 0;
        var poll = setInterval(function () {
          tries++;
          if (rootEl && rootEl.childElementCount > 0) {
            renderedOk = true;
            clearInterval(poll);
            // Hide non-fatal banner if UI is up
            if (errEl && !fatalShown) errEl.style.display = 'none';
          } else if (tries > 20) {
            clearInterval(poll);
            if (!renderedOk && rootEl && rootEl.childElementCount === 0) {
              showError('Render produced an empty tree. Open Code or try Fix from QA.', { fatal: true });
            }
          }
        }, 100);
      } catch (e) {
        showError((e && e.message) ? e.message : String(e), { fatal: true });
      }
    })();
  <\/script>
</body>
</html>`;
}
