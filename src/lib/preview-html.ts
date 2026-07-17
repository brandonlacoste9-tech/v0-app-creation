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
    .replace(/export\s+type\s+\{[^}]*\}\s*;?\n?/g, "")
    .replace(/export\s+type\s+\w+\s*=\s*[^;]+;?\n?/g, "")
    .replace(/export\s+interface\s+\w+[\s\S]*?(?=\n(?:export\s+)?(?:function|const|let|var|class|interface|type)\b|\n*$)/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "")
    // interfaces / type aliases
    .replace(/^\s*interface\s+\w+[\s\S]*?(?=^\s*(?:export\s+)?(?:function|const|let|var|class|interface|type)\b)/gm, "")
    .replace(/^\s*type\s+\w+[^=]*=\s*[^;]+;?\s*$/gm, "")
    // `as const` / `as Type` / satisfies
    .replace(/\s+as\s+const\b/g, "")
    .replace(/\s+as\s+[A-Za-z0-9_.<>,\s|&\[\]'"]+/g, "")
    .replace(/\s+satisfies\s+[A-Za-z0-9_.<>,\s|&\[\]]+/g, "")
    // simple param / var type annotations: (x: string) =>  /  const x: Foo =
    .replace(/(\(|,)\s*([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z0-9_.<>,\s|&\[\]?:]+(?=\s*[,)=])/g, "$1$2")
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
    // non-null assertions
    .replace(/([A-Za-z0-9_)\]]+)!/g, "$1")
    // generic arrows often ok; angle brackets on components fine
    ;

  return s.trim();
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
      background: ${theme.bg};
      color: ${theme.fg};
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
    * { box-sizing: border-box; }
    #root { min-height: 100vh; }
    #adgen-error {
      display: none;
      margin: 0;
      padding: 1rem 1.25rem;
      background: #18181b;
      color: #fca5a5;
      font: 12px/1.5 ui-monospace, monospace;
      white-space: pre-wrap;
      border-bottom: 1px solid #3f3f46;
    }
  </style>
</head>
<body class="${darkClass}">
  <pre id="adgen-error"></pre>
  <div id="root"></div>
  <script>${getPreviewBridgeScript().replace(/<\/script/gi, "<\\/script")}</script>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.26.9/babel.min.js"><\/script>
  <script>
    (function () {
      var errEl = document.getElementById('adgen-error');
      var rootEl = document.getElementById('root');
      function showError(msg) {
        if (!errEl) return;
        errEl.style.display = 'block';
        errEl.textContent = 'Preview error: ' + msg;
        if (rootEl && !rootEl.childElementCount) {
          rootEl.innerHTML = '<div style="padding:2rem;color:${theme.fg};opacity:0.7;font-family:system-ui;font-size:14px;">Could not render this version. Check Code tab or regenerate.</div>';
        }
      }
      window.addEventListener('error', function (e) {
        showError(e.message || String(e.error || 'Unknown error'));
      });
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        showError('React failed to load (CDN blocked?).');
        return;
      }
      if (typeof Babel === 'undefined') {
        showError('Babel failed to load (CDN blocked?).');
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

        // eslint-disable-next-line no-eval
        eval(transformed);

        var ComponentToRender =
          typeof Component !== 'undefined'
            ? Component
            : typeof App !== 'undefined'
              ? App
              : null;

        if (!ComponentToRender) {
          // Last export-like global that looks like a component
          showError('No function Component() found. Entry must define Component.');
          return;
        }

        var root = ReactDOM.createRoot(rootEl);
        root.render(React.createElement(ComponentToRender, MOCK_DATA));

        // If still empty after paint, surface a hint
        setTimeout(function () {
          if (rootEl && rootEl.childElementCount === 0) {
            showError('Render produced an empty tree. Try regenerating or open Code.');
          }
        }, 800);
      } catch (e) {
        showError((e && e.message) ? e.message : String(e));
      }
    })();
  <\/script>
</body>
</html>`;
}
