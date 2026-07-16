import type { PreviewTheme } from "./types";

/** Wrap TSX component source into a self-contained preview HTML document. */
export function wrapCodeForPreview(
  code: string,
  theme: PreviewTheme,
  mockData: string = "{}"
): string {
  const cleaned = code
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  const darkClass = theme.mode === "dark" ? "dark" : "";

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
    body { background: ${theme.bg}; color: ${theme.fg}; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 0; min-height: 100vh; }
    * { box-sizing: border-box; }
  </style>
</head>
<body class="${darkClass}">
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, createContext, useContext } = React;
    const MOCK_DATA = ${mockData};
    try {
      ${cleaned}
      const ComponentToRender = typeof Component !== 'undefined' ? Component :
        (typeof App !== 'undefined' ? App :
        (() => React.createElement('div', {style:{color:'${theme.fg}',padding:'2rem',textAlign:'center'}}, 'Component rendered')));
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ComponentToRender, MOCK_DATA));
    } catch(e) {
      document.getElementById('root').innerHTML = '<pre style="color:#ef4444;padding:1rem;font-size:12px;white-space:pre-wrap;">Error: ' + e.message + '</pre>';
    }
  <\/script>
</body>
</html>`;
}
