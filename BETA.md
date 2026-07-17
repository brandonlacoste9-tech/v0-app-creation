# Welcome to Shipboard Beta

Shipboard is an **AI compiler** for full-stack developers. It is not a no-code toy, and it does not lock you into a proprietary runtime.

You describe the UI, connect **your** database, and Shipboard generates **strict TypeScript**, **Tailwind**, **Next.js Server Actions**, and **Drizzle ORM** schemas—standard pieces you already know how to own.

When you are ready, you **eject** the repository, open it in WSL or VS Code, and keep building. Eject is the product, not the exit interview.

---

## Philosophy: accelerator, not a cage

| What Shipboard owns | What you own |
|---------------------|--------------|
| Deterministic scaffolding (schema → Zod → actions → agent tools) | The app, the DB, the repo |
| Live preview that adapts around production imports | Production code paths (`@/app/actions`, App Router) |
| Platform auth, quotas, and telemetry host | Your Neon/Supabase data and secrets |

We deliberately:

- **Do not** invent tables—the schema comes from introspection.
- **Do not** store your DB password after read-only introspection.
- **Do not** inject platform tables into your BYOB database.
- **Do** emit code a senior engineer would keep after clone.

If something feels locked in, open an issue. That is a bug in the product thesis.

---

## Who this beta is for

Developers already comfortable with:

- **Next.js App Router** + React  
- **Tailwind**  
- **Postgres** (Neon / Supabase) and ideally **Drizzle**  

…who are tired of rewiring the same admin table → Server Actions → Zod → agent tools for every project.

If you need a pure no-code builder, this will feel sharp-edged on purpose.

---

## The Golden Path (≈5 minutes to a real app)

Build a standard SaaS admin surface. That is the wedge.

### 1. Secure your access

1. Sign in (GitHub or Google).
2. Open **Settings → Access**.
3. **Generate a Personal Access Token (PAT)** (`sb_pat_…`).
4. Copy it **once**. It is hashed at rest and will not be shown again.

You need this PAT for local sync. Treat it like a Stripe secret.

### 2. Bring Your Own Database (BYOB)

1. Open **Settings → Database**.
2. Paste a **Neon or Supabase** `postgresql://` connection string.
3. **Connect & map schema**.

**Safety switch (read this):**

- We use the string for a **single read-only introspection** of `information_schema`.
- We **do not** store the connection string on our servers for later use.
- We **never** auto-migrate or write into your database.
- What we keep is a **schema map** (table/column/FK metadata) so generation and export stay accurate.

Shipboard maps public tables into the studio context. Invented tables are not part of the design.

### 3. Generate the UI

In Studio, try something like:

> Create an admin table of my users, with a form to create a new user. Import Server Actions from `@/app/actions` and use the real column names from my schema.

What actually happens:

- The model writes **UI that consumes** production APIs.
- Codegen (not the model) already owns **Drizzle tables**, **drizzle-zod** validators, and **CRUD Server Actions** from introspection.
- Live preview **intercepts** `@/app/actions` and runs an in-memory mock so you can click through without hitting Node/`pg` in the iframe.

You should not write dual-path “preview vs prod” imports. Production code only.

### 4. Eject the code

1. **Push** (or download ZIP) for a full **Next.js App Router** project.
2. Locally:

```bash
git clone <your-new-repo>
cd <your-new-repo>
npm install
cp .env.example .env.local
# set DATABASE_URL=postgresql://…
npm run dev
```

Open `http://localhost:3000`. The app talks to **your** database through the generated Server Actions.

Open the repo in WSL. You should recognize `app/`, `components/`, `lib/db/`, `app/actions.ts`—not a proprietary IR.

### 5. Two-way sync (optional, after eject)

If you still want the visual editor while coding business logic locally:

```bash
npx shipboard link \
  --url https://shipboard.ca \
  --session <your-studio-session-id> \
  --token sb_pat_…          # required — multi-tenant lockdown

npx shipboard pull          # studio → components/
npx shipboard dev           # bi-di: poll studio ↓ + watch components/ ↑
```

- Studio generations land on disk.
- Saves under `components/` push back as new studio versions (debounced).

Never commit `.shipboard/config.json` (it holds the PAT).

---

## The Agent Tool Bus

Shipboard turns your database into a **zero-configuration agent API**.

Because tables and Zod schemas are deterministic, export includes:

| Path | Role |
|------|------|
| `lib/db/schema.ts` | Drizzle tables, `relations()`, insert/update/select Zod |
| `app/actions.ts` | Typed CRUD Server Actions |
| `lib/agent/tools.ts` | Vercel AI SDK `tool()` bindings over those actions |
| `lib/agent/customTools.ts` | Tools you define under **Settings → Agents** |
| `app/api/chat/route.ts` | Your owned agent loop (`streamText`, `maxSteps`) |
| `lib/agent/telemetry.ts` | Tool + run tracing / cost estimates |

You do not invent tool JSON for every table. You pass `dbTools` (and `customTools`) into the AI SDK loop and ship.

**Custom tools** (HTTP, Stripe, open data, scrapers): define name, description, params, and execute body under **Settings → Agents**. They eject as readable TypeScript.

### Agent X-Ray

Status bar → **X-Ray**:

- Tool start / success / error  
- Latency  
- Args / result previews  
- **Run finish**: token usage and **estimated cost**  

Ejected apps (optional multi-tenant ingest):

```bash
# Settings → Access → Generate ingest key (current project)
SHIPBOARD_TELEMETRY_URL=https://shipboard.ca/api/telemetry/events
SHIPBOARD_PROJECT_ID=<session-id>
SHIPBOARD_INGEST_KEY=sb_ing_…
```

Ingest is authenticated; events are stored with `tenant_id` + `project_id` on **our** host DB—not written into your BYOB schema.

---

## Safety switches (beta limits & quotas)

We fail closed so a recursive agent loop does not burn your keys or our bill overnight.

### Generations (studio)

| Plan | Generations / day (approx.) |
|------|-----------------------------|
| Free | 5 |
| Builder | 40 |
| Pro | 120 |
| Max | Unlimited |

Exact entitlements live in-product; upgrade when you hit the wall.

### Agent recursion (ejected apps)

- Default **`maxSteps` is clamped** (platform default **8**).
- Override carefully: `SHIPBOARD_MAX_AGENT_STEPS` in the ejected app env.

Prefer short, deterministic playbooks over endless reasoning loops.

### Platform economic ceilings (per tenant / UTC day)

| Plan | Telemetry events | Agent tokens | Est. cost | CLI sync ops |
|------|------------------|--------------|-----------|--------------|
| Free | 200 | 50k | ~$1 | 80 |
| Builder | 2k | 400k | ~$8 | 400 |
| Pro | 15k | 2M | ~$40 | 2k |
| Max | 100k | 20M | ~$200 | 20k |

Also enforced:

- **Burst** limits (telemetry / sync per rolling minute)  
- **Agent preview-tool** daily caps in studio  

Over limit → **HTTP 429** with a clear `code` and usage payload.  
`GET /api/usage` and X-Ray show remaining budget.

---

## Mental model (how the compiler works)

```
Your Postgres ──introspection──► schema map (no password kept)
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   Drizzle + Zod              Server Actions                 Agent tools
   (deterministic)            (deterministic)                (deterministic)
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      ▼
                         LLM writes UI that *imports* them
                                      │
                    preview intercept (studio)  │  real Node (eject)
```

The model is kept away from inventing integrity layers. That is intentional.

---

## Feedback (what we need from you)

File issues or notes with labels when possible:

| Label | Examples |
|-------|----------|
| `escape-hatch` | Export broken, bad Next layout, TS errors on clone |
| `byob` | Wrong columns, FK/relations, introspection failures |
| `agent` | Tool bus, maxSteps, custom tools |
| `sync` | CLI link / pull / push / watch |
| `billing` | Quotas, 429s, cost display |

Good reports include: plan tier, whether you were signed in, session id (not secrets), and steps to reproduce.

---

## What this beta is not

- A guarantee of perfect multi-file generations every time—iterate, then **Continue** if a stream truncates.  
- A replacement for code review—you still own production.  
- A managed agent runtime you cannot leave—the repo is standard Next + AI SDK.

---

## One-liner

**Describe the UI. Bring your Neon. Get typed actions and tools. Eject. Keep coding.**

Welcome to the beta. Build something real—and if the cage reappears anywhere, tell us so we can burn it down.
