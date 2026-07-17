/**
 * Run: npx tsx src/lib/devtools/protocol.test.ts
 */
import {
  getDevtoolsActionWrapSnippet,
  getDevtoolsIframeBootstrap,
  isDevtoolsMessage,
  isDevtoolsPush,
  isDevtoolsRpcResponse,
  SHIPBOARD_DEVTOOLS_MSG,
} from "./protocol";
import { getDefaultActionMockSource } from "../byob/preview-intercept";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

{
  const boot = getDevtoolsIframeBootstrap();
  assert(boot.includes(SHIPBOARD_DEVTOOLS_MSG), "boot has protocol type");
  assert(boot.includes("console"), "boot patches console");
  assert(boot.includes("__devtoolsLog"), "boot exposes __devtoolsLog");
  assert(boot.includes("db_list_tables"), "boot has DB RPC");
  assert(boot.includes("__previewDb"), "boot reads previewDb");
}

{
  assert(
    isDevtoolsRpcResponse({
      type: SHIPBOARD_DEVTOOLS_MSG,
      rpc: true,
      dir: "res",
      id: "x",
      ok: true,
      data: { tables: [] },
    }),
    "rpc response shape"
  );
  assert(
    !isDevtoolsPush({
      type: SHIPBOARD_DEVTOOLS_MSG,
      rpc: true,
      dir: "res",
      id: "x",
      ok: true,
    }),
    "rpc is not push"
  );
}

{
  const wrap = getDevtoolsActionWrapSnippet(["listUsers", "createUser"]);
  assert(wrap.includes("__wrapAction"), "wrap helper");
  assert(wrap.includes("listUsers"), "listUsers wrap");
  assert(wrap.includes("createUser"), "createUser wrap");
}

{
  assert(
    isDevtoolsMessage({
      type: SHIPBOARD_DEVTOOLS_MSG,
      entry: {
        kind: "console",
        level: "log",
        message: "hi",
        ts: new Date().toISOString(),
      },
    }),
    "valid message"
  );
  assert(!isDevtoolsMessage({ type: "nope" }), "reject other");
}

// default intercept includes wrap
{
  const src = getDefaultActionMockSource();
  assert(src.includes("__wrapAction"), "default mock wraps actions");
  assert(src.includes("listUsers = __wrapAction"), "listUsers reassigned");
}

console.log("devtools protocol tests: all passed");
