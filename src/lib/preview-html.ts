import type { PreviewTheme } from "./types";
import { mergeForPreview } from "./project-files";
import { getPreviewBridgeScript } from "./browser/preview-bridge";

/**
 * Strip syntax that breaks Babel-in-browser without (or despite) TS preset.
 * Keeps JSX and modern JS intact.
 */
export function sanitizePreviewSource(source: string): string {
  let s = source
    // imports / exports (preview has no module graph)
    .replace(/import\s+type\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/import\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/g, "({})")
    .replace(/export\s+type\s+\{[^}]*\}\s*;?\n?/g, "")
    .replace(/export\s+type\s+\w+\s*=\s*[^;]+;?\n?/g, "")
    .replace(
      /export\s+interface\s+\w+[\s\S]*?(?=\n(?:export\s+)?(?:function|const|let|var|class|interface|type)\b|\n*$)/g,
      ""
    )
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "")
    // interfaces / type aliases
    .replace(
      /^\s*interface\s+\w+[\s\S]*?(?=^\s*(?:export\s+)?(?:function|const|let|var|class|interface|type)\b)/gm,
      ""
    )
    .replace(/^\s*type\s+\w+[^=]*=\s*[^;]+;?\s*$/gm, "")
    // `as const` / `as Type` / satisfies
    .replace(/\s+as\s+const\b/g, "")
    .replace(/\s+as\s+[A-Za-z0-9_.<>,\s|&\[\]'"]+/g, "")
    .replace(/\s+satisfies\s+[A-Za-z0-9_.<>,\s|&\[\]]+/g, "")
    // simple param / var type annotations: (x: string) =>  /  const x: Foo =
    .replace(
      /(\(|,)\s*([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]?:]+(?=\s*[,)=])/g,
      "$1$2"
    )
    .replace(
      /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]]+\s*=/g,
      "$1 $2 ="
    )
    // tuple annotations on destructure: const [a, b]: [number, string] =
    .replace(
      /\b(const|let|var)\s+(\[[^\]]+\]|\{[^}]+\})\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]]+\s*=/g,
      "$1 $2 ="
    )
    // return types on functions: function Foo(): JSX.Element {
    .replace(/\)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]]+\s*\{/g, ") {")
    .replace(/\)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]]+\s*=>/g, ") =>")
    // non-null assertions only when followed by . [ (  (don't break Tailwind !flex)
    .replace(/([A-Za-z0-9_)\]]+)!(?=[.\[(])/g, "$1");

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
  mockData: string = "{}"
): string {
  // Multi-file projects merge into one script scope for the iframe
  let source = "";
  try {
    source = code.trim().startsWith("{") ? mergeForPreview(code) : code;
  } catch {
    source = code;
  }

  const cleaned = sanitizePreviewSource(source);
  const darkClass = theme.mode === "dark" ? "dark" : "";
  // Escape </script> in user code so it can't break out of the babel script tag
  const safeCode = cleaned.replace(/<\/script/gi, "<\\/script");

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
        var transformed = Babel.transform(source, {
          presets: [
            ['react', { runtime: 'classic' }],
            ['typescript', { isTSX: true, allExtensions: true }],
          ],
          filename: 'Component.tsx',
        }).code;

        // Hooks in global scope for generated code
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

        // Shims: models often leave Node/server helpers after imports are stripped
        // (e.g. import { write } from 'fs' → write is not defined).
        function __adgenNoop() { return undefined; }
        function __adgenStubFn(name) {
          return function () {
            try { console.warn('[AdGen preview] ' + name + '() is not available in the browser preview'); } catch (_) {}
            return undefined;
          };
        }
        var require = function (id) {
          try { console.warn('[AdGen preview] require("' + id + '") is not available'); } catch (_) {}
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
        // Bare identifiers frequently left behind after import stripping
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

        // Evaluate generated component(s)
        eval(transformed);

        var ComponentToRender = null;
        if (typeof Component !== 'undefined' && typeof Component === 'function') {
          ComponentToRender = Component;
        } else if (typeof App !== 'undefined' && typeof App === 'function') {
          ComponentToRender = App;
        } else {
          // Fallback: first PascalCase function on window from our eval scope
          // (multi-file sometimes only defines named sections + a non-Component entry)
          try {
            var keys = Object.keys(this || {});
          } catch (_) {}
        }

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
