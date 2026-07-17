#!/usr/bin/env node
/**
 * Shipboard CLI — Phase D local sync
 *
 *   npx shipboard link --url https://shipboard.ca --session <id> [--token <secret>]
 *   npx shipboard pull
 *   npx shipboard push
 *   npx shipboard dev          # poll studio + write components/ on change
 *   npx shipboard status
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import path from "node:path";

const CONFIG_DIR = ".shipboard";
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const STATE_FILE = path.join(CONFIG_DIR, "state.json");

function cwd() {
  return process.cwd();
}

function configPath() {
  return path.join(cwd(), CONFIG_FILE);
}

async function loadConfig() {
  const p = configPath();
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

async function saveConfig(cfg) {
  await mkdir(path.join(cwd(), CONFIG_DIR), { recursive: true });
  await writeFile(configPath(), JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

async function loadState() {
  const p = path.join(cwd(), STATE_FILE);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return {};
  }
}

async function saveState(state) {
  await mkdir(path.join(cwd(), CONFIG_DIR), { recursive: true });
  await writeFile(
    path.join(cwd(), STATE_FILE),
    JSON.stringify(state, null, 2) + "\n",
    "utf8"
  );
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function apiGet(cfg, pathname) {
  const base = cfg.url.replace(/\/$/, "");
  const u = new URL(base + pathname);
  if (cfg.token) u.searchParams.set("token", cfg.token);
  const headers = { Accept: "application/json" };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
  const res = await fetch(u, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(cfg, pathname, body) {
  const base = cfg.url.replace(/\/$/, "");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
  const res = await fetch(base + pathname, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function writeFiles(files) {
  for (const f of files) {
    const dest = path.join(cwd(), f.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, f.content, "utf8");
    console.log(`  wrote ${f.path}`);
  }
}

async function collectLocalComponents() {
  const root = path.join(cwd(), "components");
  if (!existsSync(root)) return [];
  const out = [];

  async function walk(dir, prefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, rel);
      else if (/\.(tsx?|jsx?)$/i.test(e.name)) {
        out.push({
          path: `components/${rel}`.replace(/\\/g, "/"),
          content: await readFile(full, "utf8"),
        });
      }
    }
  }
  await walk(root, "");
  return out;
}

async function cmdLink(args) {
  const url = args.url || args.host || "http://localhost:3000";
  const session = args.session || args.sessionId;
  if (!session) {
    console.error("Usage: shipboard link --url <host> --session <sessionId> [--token <secret>]");
    process.exit(1);
  }
  const cfg = {
    url: String(url).replace(/\/$/, ""),
    sessionId: String(session),
    token: args.token ? String(args.token) : undefined,
    linkedAt: new Date().toISOString(),
  };
  await saveConfig(cfg);
  console.log(`Linked to ${cfg.url} session ${cfg.sessionId}`);
  console.log(`Config: ${CONFIG_FILE}`);
}

async function cmdPull() {
  const cfg = await loadConfig();
  if (!cfg) {
    console.error("Not linked. Run: shipboard link --url … --session …");
    process.exit(1);
  }
  console.log(`Pulling latest from ${cfg.url} …`);
  const data = await apiGet(
    cfg,
    `/api/sync/latest?sessionId=${encodeURIComponent(cfg.sessionId)}`
  );
  await writeFiles(data.files || []);
  await saveState({
    lastVersionId: data.versionId,
    lastPullAt: new Date().toISOString(),
    title: data.title,
  });
  console.log(`✓ ${data.files?.length || 0} files (version ${data.versionId})`);
}

async function cmdPush() {
  const cfg = await loadConfig();
  if (!cfg) {
    console.error("Not linked. Run: shipboard link --url … --session …");
    process.exit(1);
  }
  const files = await collectLocalComponents();
  if (!files.length) {
    console.error("No files under components/");
    process.exit(1);
  }
  console.log(`Pushing ${files.length} file(s) to studio …`);
  const data = await apiPost(cfg, "/api/sync/push", {
    sessionId: cfg.sessionId,
    files,
    title: `CLI push ${new Date().toISOString().slice(0, 16)}`,
  });
  console.log(`✓ version ${data.versionId}`);
}

async function cmdDev(args) {
  const cfg = await loadConfig();
  if (!cfg) {
    console.error("Not linked. Run: shipboard link --url … --session …");
    process.exit(1);
  }
  const interval = parseInt(args.interval || "3000", 10);
  const noWatch = Boolean(args["no-watch"]);
  console.log(`shipboard dev — studio→disk poll ${interval}ms`);
  if (!noWatch) console.log(`  disk→studio: watching components/ (debounce 800ms)`);
  console.log(`  host: ${cfg.url}`);
  console.log(`  session: ${cfg.sessionId}`);
  console.log(`  (Ctrl+C to stop)\n`);

  let lastId = (await loadState()).lastVersionId;
  let applyingRemote = false;
  let pushTimer = null;
  let lastLocalPush = 0;

  async function tick() {
    try {
      const data = await apiGet(
        cfg,
        `/api/sync/latest?sessionId=${encodeURIComponent(cfg.sessionId)}`
      );
      if (data.versionId && data.versionId !== lastId) {
        console.log(`[${new Date().toLocaleTimeString()}] ↓ studio ${data.versionId}`);
        applyingRemote = true;
        await writeFiles(data.files || []);
        applyingRemote = false;
        lastId = data.versionId;
        await saveState({
          lastVersionId: lastId,
          lastPullAt: new Date().toISOString(),
          title: data.title,
        });
      }
    } catch (e) {
      console.error(`[sync↓] ${e.message}`);
    }
  }

  async function pushLocal(reason) {
    if (applyingRemote) return;
    const now = Date.now();
    if (now - lastLocalPush < 500) return;
    try {
      const files = await collectLocalComponents();
      if (!files.length) return;
      const data = await apiPost(cfg, "/api/sync/push", {
        sessionId: cfg.sessionId,
        files,
        title: `Local edit ${new Date().toISOString().slice(0, 19)}`,
      });
      lastLocalPush = Date.now();
      lastId = data.versionId;
      await saveState({
        lastVersionId: lastId,
        lastPushAt: new Date().toISOString(),
      });
      console.log(
        `[${new Date().toLocaleTimeString()}] ↑ ${reason} → version ${data.versionId}`
      );
    } catch (e) {
      console.error(`[sync↑] ${e.message}`);
    }
  }

  function schedulePush(reason) {
    if (applyingRemote || noWatch) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushLocal(reason), 800);
  }

  await tick();
  setInterval(tick, interval);

  // Bi-di: watch components/ for VS Code saves → push to studio
  const componentsDir = path.join(cwd(), "components");
  if (!noWatch && existsSync(componentsDir)) {
    try {
      watch(componentsDir, { recursive: true }, (event, filename) => {
        if (!filename || applyingRemote) return;
        if (!/\.(tsx?|jsx?)$/i.test(String(filename))) return;
        schedulePush(`${event} ${filename}`);
      });
      console.log("  watching components/ (native fs.watch)");
    } catch (e) {
      console.warn(`  watch unavailable: ${e.message} — poll-only mode`);
    }
  } else if (!noWatch) {
    console.log("  no components/ yet — run pull or generate first");
  }
}

async function cmdStatus() {
  const cfg = await loadConfig();
  const state = await loadState();
  if (!cfg) {
    console.log("Not linked.");
    return;
  }
  console.log(JSON.stringify({ config: cfg, state }, null, 2));
}

function help() {
  console.log(`
Shipboard CLI — local sync bridge (Phase D)

  shipboard link --url <host> --session <id> [--token <secret>]
  shipboard pull
  shipboard push
  shipboard dev [--interval 3000] [--no-watch]
  shipboard status

  dev: poll studio → disk; watch components/ → push local saves (bi-di)

Typical flow after eject:
  cd my-app
  npx shipboard link --url https://shipboard.ca --session <studio-session-id>
  npx shipboard pull
  npx shipboard dev     # two-way: studio gens + VS Code saves
`.trim());
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || "help";

try {
  if (cmd === "link") await cmdLink(args);
  else if (cmd === "pull") await cmdPull();
  else if (cmd === "push") await cmdPush();
  else if (cmd === "dev") await cmdDev(args);
  else if (cmd === "status") await cmdStatus();
  else help();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
