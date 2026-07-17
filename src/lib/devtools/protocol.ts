/**
 * Shipboard DevTools — parent ↔ iframe protocol.
 * Studio-only; never ejected into shipped apps.
 *
 * Push stream: console / action / runtime logs
 * RPC: database explorer against iframe `__previewDb`
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

export type DevtoolsPushMessage = {
  type: typeof SHIPBOARD_DEVTOOLS_MSG;
  entry: DevtoolsEntry;
};

export type DevtoolsDbCmd =
  | "db_list_tables"
  | "db_get_rows"
  | "db_upsert"
  | "db_delete";

export type DevtoolsRpcRequest = {
  type: typeof SHIPBOARD_DEVTOOLS_MSG;
  rpc: true;
  dir: "req";
  id: string;
  cmd: DevtoolsDbCmd;
  table?: string;
  row?: Record<string, unknown>;
  /** Primary key field for delete / upsert identity (default: "id") */
  idKey?: string;
  idValue?: string | number;
  limit?: number;
  search?: string;
};

export type DevtoolsRpcResponse = {
  type: typeof SHIPBOARD_DEVTOOLS_MSG;
  rpc: true;
  dir: "res";
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type DevtoolsMessage =
  | DevtoolsPushMessage
  | DevtoolsRpcRequest
  | DevtoolsRpcResponse;

export function isDevtoolsMessage(data: unknown): data is DevtoolsMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as { type?: string };
  return d.type === SHIPBOARD_DEVTOOLS_MSG;
}

export function isDevtoolsPush(data: unknown): data is DevtoolsPushMessage {
  if (!isDevtoolsMessage(data)) return false;
  return "entry" in data && (data as DevtoolsPushMessage).entry != null;
}

export function isDevtoolsRpcResponse(data: unknown): data is DevtoolsRpcResponse {
  if (!isDevtoolsMessage(data)) return false;
  const d = data as DevtoolsRpcResponse;
  return d.rpc === true && d.dir === "res" && typeof d.id === "string";
}

/** Iframe snippet: console + error + DB RPC on `__previewDb`. */
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

  function __dbReply(id, ok, data, error) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: '${SHIPBOARD_DEVTOOLS_MSG}',
          rpc: true,
          dir: 'res',
          id: id,
          ok: ok,
          data: data,
          error: error
        }, '*');
      }
    } catch (_) {}
  }

  function __ensureDb() {
    if (typeof __previewDb === 'undefined' || !__previewDb || typeof __previewDb !== 'object') {
      return null;
    }
    return __previewDb;
  }

  window.addEventListener('message', function(ev) {
    try {
      var d = ev.data;
      if (!d || d.type !== '${SHIPBOARD_DEVTOOLS_MSG}' || !d.rpc || d.dir !== 'req') return;
      var id = d.id;
      var cmd = d.cmd;
      var db = __ensureDb();

      if (cmd === 'db_list_tables') {
        if (!db) {
          __dbReply(id, true, { tables: [], note: 'no_preview_db' }, null);
          return;
        }
        var tables = Object.keys(db).map(function(name) {
          var rows = Array.isArray(db[name]) ? db[name] : [];
          var cols = rows[0] ? Object.keys(rows[0]) : [];
          return { name: name, rowCount: rows.length, columns: cols };
        });
        __dbReply(id, true, { tables: tables }, null);
        return;
      }

      if (!db) {
        __dbReply(id, false, null, 'No __previewDb in this preview (UI has no action intercept).');
        return;
      }

      var table = d.table;
      if (!table || !Object.prototype.hasOwnProperty.call(db, table)) {
        __dbReply(id, false, null, 'Unknown table: ' + table);
        return;
      }
      if (!Array.isArray(db[table])) db[table] = [];

      if (cmd === 'db_get_rows') {
        var rows = db[table].slice();
        var search = (d.search || '').toString().toLowerCase().trim();
        if (search) {
          rows = rows.filter(function(row) {
            try {
              return JSON.stringify(row).toLowerCase().indexOf(search) !== -1;
            } catch (_) { return false; }
          });
        }
        var limit = Math.min(Math.max(Number(d.limit) || 50, 1), 200);
        __dbReply(id, true, {
          table: table,
          total: rows.length,
          rows: rows.slice(0, limit),
          columns: rows[0] ? Object.keys(rows[0]) : (db[table][0] ? Object.keys(db[table][0]) : [])
        }, null);
        return;
      }

      var idKey = d.idKey || 'id';

      if (cmd === 'db_upsert') {
        var row = d.row || {};
        var pk = row[idKey];
        if (pk == null || pk === '') {
          row[idKey] = 'local-' + Date.now();
          db[table].unshift(row);
          __dbReply(id, true, { row: row, created: true }, null);
          return;
        }
        var found = -1;
        for (var i = 0; i < db[table].length; i++) {
          if (String(db[table][i][idKey]) === String(pk)) { found = i; break; }
        }
        if (found >= 0) {
          db[table][found] = Object.assign({}, db[table][found], row);
          __dbReply(id, true, { row: db[table][found], created: false }, null);
        } else {
          db[table].unshift(row);
          __dbReply(id, true, { row: row, created: true }, null);
        }
        return;
      }

      if (cmd === 'db_delete') {
        var val = d.idValue;
        var before = db[table].length;
        db[table] = db[table].filter(function(r) {
          return String(r[idKey]) !== String(val);
        });
        __dbReply(id, true, { deleted: before - db[table].length }, null);
        return;
      }

      __dbReply(id, false, null, 'Unknown cmd: ' + cmd);
    } catch (err) {
      try {
        if (ev.data && ev.data.id) {
          __dbReply(ev.data.id, false, null, String((err && err.message) || err));
        }
      } catch (_) {}
    }
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

/** Parent → iframe DB RPC helper */
export function requestDevtoolsDb(
  iframe: HTMLIFrameElement | null,
  cmd: DevtoolsDbCmd,
  payload: Omit<DevtoolsRpcRequest, "type" | "rpc" | "dir" | "id" | "cmd"> = {},
  timeoutMs = 2500
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!iframe?.contentWindow) {
      reject(new Error("No preview iframe"));
      return;
    }
    const id = `rpc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("DevTools DB timeout — is the preview loaded with action intercept?"));
    }, timeoutMs);

    function onMsg(ev: MessageEvent) {
      if (!isDevtoolsRpcResponse(ev.data) || ev.data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      if (ev.data.ok) resolve(ev.data.data);
      else reject(new Error(ev.data.error || "DB RPC failed"));
    }

    window.addEventListener("message", onMsg);
    const req: DevtoolsRpcRequest = {
      type: SHIPBOARD_DEVTOOLS_MSG,
      rpc: true,
      dir: "req",
      id,
      cmd,
      ...payload,
    };
    try {
      iframe.contentWindow.postMessage(req, "*");
    } catch (e) {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
