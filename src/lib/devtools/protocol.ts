/**
 * Shipboard DevTools — parent ↔ iframe protocol.
 * Studio-only; never ejected into shipped apps.
 */

export const SHIPBOARD_DEVTOOLS_MSG = "shipboard-devtools";

export type DevtoolsLogLevel = "log" | "info" | "warn" | "error";

export type DevtoolsEntry =
  | {
      kind: "console";
      level: DevtoolsLogLevel;
      message: string;
      ts: string;
    }
  | {
      kind: "action";
      name: string;
      args: unknown[];
      result?: unknown;
      error?: string;
      ok: boolean;
      ms: number;
      ts: string;
    }
  | {
      kind: "runtime";
      message: string;
      ts: string;
    };

export type DevtoolsMessage = {
  type: typeof SHIPBOARD_DEVTOOLS_MSG;
  entry: DevtoolsEntry;
};

export function isDevtoolsMessage(data: unknown): data is DevtoolsMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as DevtoolsMessage;
  return d.type === SHIPBOARD_DEVTOOLS_MSG && d.entry != null;
}

/** Iframe snippet: console + error → parent DevTools. */
export function getDevtoolsIframeBootstrap(): string {
  return `
(function(){
  if (window.__shipboardDevtoolsBoot) return;
  window.__shipboardDevtoolsBoot = true;
  function __dtSend(entry) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: '${SHIPBOARD_DEVTOOLS_MSG}', entry: entry }, '*');
      }
    } catch (_) {}
  }
  window.__devtoolsLog = __dtSend;
  function __safeStr(a) {
    try {
      if (a == null) return String(a);
      if (typeof a === 'string') return a;
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    } catch (_) { return '[unserializable]'; }
  }
  ['log','info','warn','error'].forEach(function(level) {
    var orig = console[level] ? console[level].bind(console) : function(){};
    console[level] = function() {
      try {
        var args = Array.prototype.slice.call(arguments).map(__safeStr);
        __dtSend({ kind: 'console', level: level, message: args.join(' '), ts: new Date().toISOString() });
      } catch (_) {}
      return orig.apply(null, arguments);
    };
  });
  window.addEventListener('error', function(e) {
    try {
      __dtSend({ kind: 'runtime', message: String((e && e.message) || e || 'error'), ts: new Date().toISOString() });
    } catch (_) {}
  });
  window.addEventListener('unhandledrejection', function(e) {
    try {
      var r = e && e.reason;
      __dtSend({ kind: 'runtime', message: 'Unhandled rejection: ' + __safeStr(r), ts: new Date().toISOString() });
    } catch (_) {}
  });
})();
`;
}

/**
 * Wrap preview Server Actions so each call is logged to parent DevTools.
 * Append after action function declarations.
 */
export function getDevtoolsActionWrapSnippet(actionNames: string[]): string {
  const unique = [...new Set(actionNames.filter(Boolean))];
  if (!unique.length) return "";

  const reassigns = unique
    .map(
      (n) =>
        `try { if (typeof ${n} === "function") ${n} = __wrapAction(${JSON.stringify(n)}, ${n}); } catch(_e) {}`
    )
    .join("\n");

  return `
function __wrapAction(name, fn) {
  return async function() {
    var args = Array.prototype.slice.call(arguments);
    var t0 = Date.now();
    try {
      var result = await fn.apply(this, args);
      if (typeof __devtoolsLog === "function") {
        __devtoolsLog({
          kind: "action",
          name: name,
          args: args,
          result: result,
          ok: true,
          ms: Date.now() - t0,
          ts: new Date().toISOString()
        });
      }
      return result;
    } catch (err) {
      if (typeof __devtoolsLog === "function") {
        __devtoolsLog({
          kind: "action",
          name: name,
          args: args,
          error: String((err && err.message) || err),
          ok: false,
          ms: Date.now() - t0,
          ts: new Date().toISOString()
        });
      }
      throw err;
    }
  };
}
${reassigns}
`;
}
