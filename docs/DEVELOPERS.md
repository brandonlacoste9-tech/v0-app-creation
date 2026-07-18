# Shipboard — Developer Handbook

Everything you need to **build with** Shipboard (studio → eject → own the repo) and to **extend** the platform (preview, fixtures, intercept).

**Start here if you are a beta user:** [BETA.md](../BETA.md)  
**Platform overview:** [README.md](../README.md)  
**Cursor / AI-IDE users:** [CURSOR.md](./CURSOR.md) — complementary workflow + messaging

## Security ops (production)

| Env | Purpose |
|-----|---------|
| `MIGRATE_SECRET` or `ADMIN_SECRET` | Required for `GET /api/migrate` and `GET /api/analytics/summary` (Bearer or `?secret=`) |
| `STRIPE_WEBHOOK_SECRET` | Required in production — webhook fails closed without it |
| `PROMO_CODES` | Comma-separated Pro unlock codes (builtins off in production unless `ALLOW_BUILTIN_PROMO_CODES=1`) |
| `NEXT_PUBLIC_ANALYTICS=1` | Force first-party pageview beacon on localhost / deploy previews (optional) |

Session messages/versions require ownership (signed-in user id or anon cookie session list). Gallery publish requires sign-in.

### First-party visitor analytics

- Beacon: `VisitorBeacon` in root layout → `POST /api/analytics/pageview`
- Paths tracked: `/`, `/studio`, `/gallery`, `/share` (bots filtered)
- Summary (auth required):

```bash
curl -H "Authorization: Bearer $MIGRATE_SECRET" \
  "https://shipboard.ca/api/analytics/summary?days=14"
```

Optional: enable Netlify Analytics in the site dashboard for bandwidth graphs.

---

## 1. Hybrid single-pass (the contract)

| Layer | Job | You write / ship |
|--------|-----|------------------|
| **LLM** | One generation of **production** TSX | Real types, multi-file, `@/app/actions` |
| **Preview** | Lossy **browser projection** | Same call sites; mocks / strip / heal in the iframe |
| **Ship / eject** | Full Next.js source of truth | Drizzle, Server Actions, agent tools — unchanged |

**Rule:** Do not write a “preview dialect.” Prefer production imports. Studio intercepts and sanitizes for the iframe.

```
Postgres (BYOB) ──introspect──► schema map (password not stored)
        │
        ├─► Drizzle + drizzle-zod     (codegen)
        ├─► app/actions.ts            (codegen)
        └─► agent tools + /api/chat   (codegen)
                │
                ▼
        LLM writes UI that *imports* those surfaces
                │
     studio preview intercept │ eject = real Node + your DATABASE_URL
```

---

## 2. Studio golden path (data app)

1. Sign in → **Settings → Access** → PAT `sb_pat_…` (copy once).
2. **Settings → Database** → Neon/Supabase URL → **Connect & map schema**.
3. Prompt like:

```text
Build an admin table for my users with create form.
Import Server Actions from @/app/actions.
Use real column names from my schema.
Multi-file: Navbar, UserTable, UserForm, Component entry.
```

4. Click through the **live preview** (actions are in-memory mocks).
5. **Push** or ZIP → clone → `npm install` → set `DATABASE_URL` → `npm run dev`.

### After eject — local sync

```bash
npx shipboard link \
  --url https://shipboard.ca \
  --session <studio-session-id> \
  --token sb_pat_…

npx shipboard pull
npx shipboard dev    # studio ↔ components/ bi-di
```

Never commit `.shipboard/config.json` (contains the PAT).

---

## 3. Prompt patterns that work

Copy-paste recipes (Admin CRUD, waitlist, dashboard, wizard, settings, **auth**, **Kanban**, Continue):
**[BETA.md → Prompt recipes](../BETA.md#prompt-recipes-copypaste)**.

| Do | Don’t |
|----|--------|
| `import { listUsers, createUser } from "@/app/actions"` | Dual-path `if (preview) mock…` |
| Multi-file landings (`Hero`, `Pricing`, `Component`) | One 2k-line file when you can split |
| TypeScript props / hooks (preview strips types) | `lucide-react` / `next/image` (not in iframe CDN) |
| Real interactive state (`useState` toggles, forms) | Dead forms / lorem / “Feature 1” |
| Named actions + data shapes + empty/loading states | Vague “make a nice table” |
| `function Component()` entry | Only `export default` with no Component/App/Page |

### If generation cuts mid-file

1. Raise **Max tokens** in Settings, or  
2. Click **Continue** in chat (see Continue recipe in BETA.md), or  
3. Ask: “Finish incomplete files; full sources; close all strings/tags.”

Preview shows a **Continue** card when the stream is done but unhealable; while still streaming you may see **Building…** (soft heal).

---

## 4. Ejected repo layout (what you own)

```
app/
  page.tsx              # entry UI
  actions.ts            # Server Actions (BYOB)
  api/chat/route.ts     # agent loop (if tools enabled)
components/             # UI pieces from multi-file gen
lib/
  db/schema.ts          # Drizzle + relations + Zod
  db/client.ts
  agent/tools.ts
  agent/customTools.ts
  agent/telemetry.ts
BETA.md                 # this product thesis (copy)
package.json            # Next + Tailwind + Drizzle…
```

Stack is standard **Next App Router + React + TypeScript + Tailwind**. No proprietary runtime.

---

## 5. Tokens & multi-tenant APIs

| Credential | Prefix | Use |
|------------|--------|-----|
| Personal Access Token | `sb_pat_…` | CLI sync (`link` / `pull` / `push` / `dev`) |
| Ingest key | `sb_ing_…` | Agent telemetry → platform host |

```bash
# Telemetry (ejected app .env.local)
SHIPBOARD_TELEMETRY_URL=https://shipboard.ca/api/telemetry/events
SHIPBOARD_PROJECT_ID=<session-id>
SHIPBOARD_INGEST_KEY=sb_ing_…
```

Events are stored on **Shipboard’s** DB with `tenant_id` + `project_id` — never written into your BYOB schema.

Usage / ceilings: `GET /api/usage` (authenticated). Over limit → **429** + clear `code`.

---

## 6. Preview architecture (platform contributors)

Pipeline inside `wrapCodeForPreview`:

```
mergeForPreview
  → applyPreviewActionIntercept   # @/app/actions → __previewDb mocks
  → sanitizePreviewSource         # strip TS / imports (string-aware)
  → makePreviewSafeSource         # truncation heal or fallback UI
  → iframe HTML (Tailwind CDN + React UMD + Babel)
       → new Function loader → Component | App | Page
```

| Module | Responsibility |
|--------|----------------|
| `src/lib/preview-html.ts` | Sanitize + iframe document |
| `src/lib/code-truncation.ts` | Detect / heal / soft vs hard fallback |
| `src/lib/byob/preview-intercept.ts` | Action intercept + default users/posts store |
| `src/lib/preview-fixtures/` | Defense fixtures against model dialect drift |

### Tests (run before claiming preview green)

```bash
npm run test:preview
# = unit sanitize + truncation SM + BYOB intercept + mock data + preview metrics
#   + fixture catalog + STARTER_SEEDS audit
```

### Preview metrics (dogfood)

Open **`/internal/preview-metrics`** after generating in Studio.

Tracks (localStorage, no PII): mount success/fallback, truncation, Continue clicks, BYOB schema usage, share/publish.

```bash
# disable
# localStorage.shipboard_preview_metrics = "0"
# or NEXT_PUBLIC_PREVIEW_METRICS=0
```

### DevTools (studio-only)

In the preview toolbar, click **Dev** (or open `/studio?dev=1`).

| Tab | Shows |
|-----|--------|
| **Data** | DB Explorer on iframe `__previewDb` (schema-aware mocks): tables, filter, edit/delete rows |
| **Actions** | Server Action calls (`listUsers`, `createUser`, …) with args, result, latency |
| **Logs** | `console.*` + runtime errors from the preview |

RPC protocol: parent `requestDevtoolsDb()` ↔ iframe `db_list_tables` / `db_get_rows` / `db_upsert` / `db_delete`.  
Uses the same postMessage bridge as preview metrics. **Not** included in ejected apps.

Add a fixture when a red panel appears in the wild: paste source into `src/lib/preview-fixtures/catalog.ts`, fix the layer, re-run `test:preview`.

Sync beta doc into ship export (no `fs` in client):

```bash
node scripts/sync-beta-md.mjs
```

---

## 7. BYOB intercept behavior (what preview fakes)

When UI imports `@/app/actions` (or `./actions`, etc.):

1. Import lines removed  
2. In-memory `__previewDb` + CRUD functions injected  
3. With schema: **schema-aware seed rows** (names, emails, FKs, dates) via `mock-data-generator.ts` + table CRUD from introspection  
4. Without schema: default **users + posts** mocks  
5. Singular/plural aliases (`createUser` ↔ `createUsers`)  
6. Unknown action names → safe async no-op via Proxy  

Mutations persist for the life of the iframe document (create then list works). After eject, the **same imports** hit real Server Actions + your DB.

Mock generation is fixture-tested (`mock-data-generator.test.ts`); seeds are not production data.

---

## 8. Safety switches (beta)

| Concern | Control |
|---------|---------|
| Studio gens / day | Plan tier (in-product) |
| Agent recursion | `SHIPBOARD_MAX_AGENT_STEPS` (default clamp ~8) |
| Telemetry / tokens / sync | Economic ceilings → HTTP 429 |
| BYOB password | Used only for one-shot introspection; not stored |

---

## 9. Feedback labels

| Label | Use for |
|-------|---------|
| `escape-hatch` | Export / clone / TS on eject |
| `byob` | Schema map, FKs, actions codegen |
| `preview` | Red panel, truncation, intercept |
| `agent` | Tool bus, maxSteps, X-Ray |
| `sync` | CLI link/pull/push/dev |
| `billing` | Quotas, 429, cost |

Include: plan, signed-in?, session id (**not** secrets), steps to reproduce.

---

## 10. One-liner

**Describe the UI. Bring your Neon. Get typed actions and tools. Preview without dual-path. Eject. Keep coding.**
