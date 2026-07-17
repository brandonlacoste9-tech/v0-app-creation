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

### 4b. Continue in Cursor (or VS Code)

Shipboard is a **generator**, not a second IDE. Cursor users typically:

1. **Bootstrap** a feature or full app in Shipboard (Admin CRUD, Auth, Kanban, BYOB actions).
2. **Eject** (Push / ZIP) — standard Next.js, no proprietary runtime.
3. **Open the folder in Cursor** and iterate: business logic, design polish, tests, deploys.

```bash
# After clone
cursor .          # or: code .
npm install
cp .env.example .env.local
# DATABASE_URL=…
npm run dev
```

Why this works for Cursor workflows:

| Shipboard owns | Cursor owns |
|----------------|-------------|
| Scaffold + production-shaped UI | Surgical edits, refactors, multi-file agent work |
| Drizzle schema + Server Actions from your DB | Domain logic, edge cases, integrations |
| Trustworthy preview (mocks / intercept) | Real runtime, tests, PR review |

Optional: keep studio in the loop with `npx shipboard dev` while you edit in Cursor.

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

## Core contract (production dialect only)

Shipboard does **not** ask the model for a second “preview dialect.”

| Path | What runs |
|------|-----------|
| **Ship / eject** | Your real Next app: `@/app/actions`, Drizzle, `DATABASE_URL` |
| **Studio preview** | Same source, projected into an iframe: TS stripped, actions mocked, cuts healed |

**Write production code only.** Example that is correct:

```tsx
import { listUsers, createUser } from "@/app/actions";

export function Component() {
  // listUsers / createUser work in preview (in-memory) and on eject (Postgres)
}
```

Deep dive (pipeline, tokens, `test:preview`): **[docs/DEVELOPERS.md](./docs/DEVELOPERS.md)**.

---

## Prompt recipes (copy/paste)

High-signal prompts that exercise preview + eject parity. Connect BYOB first when a recipe uses Server Actions.

### What makes a prompt work well here

| Do | Don’t |
|----|--------|
| Name Server Actions under `@/app/actions` | Dual-path `if (preview) mock…` |
| Specify data shapes, loading / error / empty states | Vague “make a nice table” |
| Multi-file when the surface is large | One giant file for a full SaaS settings page |
| `function Component()` entry | Only anonymous default export |
| Inline SVG / Tailwind icons | `lucide-react`, `next/image` (not in iframe CDN) |
| Real `useState` / form submit UX | Dead buttons and lorem |

---

### 1. Admin CRUD — Users *(best all-rounder)*

Tests preview intercept + real eject parity (list → create → list again).

```text
Build an admin Users page for a SaaS dashboard.

Import Server Actions from @/app/actions:
- listUsers(): Promise<User[]>
- createUser(input: { name: string; email: string; role?: string }): Promise<User>
- deleteUser(id: string): Promise<{ ok: boolean }>

User shape: { id: string; name: string; email: string; role: string }

UI requirements:
- Dense dark table: name, email, role badge, delete action
- "Add user" opens a modal form (name, email, role select)
- Optimistic or refresh-after-create so the new row appears
- Loading, error, and empty states
- Multi-file: UserTable.tsx, UserForm.tsx, Component.tsx as entry
- function Component() entry. Inline SVG only—no lucide/next/image.
```

---

### 2. Landing page + waitlist

Marketing surface with a form that hits a server action.

```text
Dark SaaS marketing landing for "Shipfast".

Sections: sticky Navbar, Hero (headline + dual CTAs), 3 feature cards,
social proof strip, waitlist email form, Footer.

Waitlist form:
- import { joinWaitlist } from "@/app/actions"
- joinWaitlist({ email: string }): Promise<{ ok: boolean; message?: string }>
- On submit: loading state, then success message ("You're on the list")
- Client-side email validation before submit

Multi-file: Navbar, Hero, Features, WaitlistForm, Footer, Component entry.
Mobile nav with useState. Inline SVG icons only. No lorem—benefit-driven copy.
```

---

### 3. Dashboard with real data + mutations

List + refresh pattern after mutations.

```text
Operations dashboard shell (dark, dense).

Import from @/app/actions:
- listUsers(): Promise<User[]>
- listPosts(): Promise<Post[]>
- createPost(input: { title: string; body: string }): Promise<Post>

Layout:
- Left sidebar nav (Overview, Users, Posts)
- Top bar with "Refresh" that re-fetches lists
- Overview: KPI cards (user count, post count) + recent posts list
- Posts: table + "New post" form; after create, refresh the list

Multi-file: Sidebar, KpiCards, PostsPanel, Component entry.
Loading skeletons and empty states. function Component() entry.
```

---

### 4. 3-step onboarding wizard

Multi-step state — good stress test for long generations / truncation.

```text
3-step onboarding wizard for a B2B SaaS (dark, polished).

Steps:
1) Account — name + email fields
2) Workspace — workspace name + plan radio (Free / Pro)
3) Invite — optional teammate emails (tag-style chips)

Behavior:
- Back / Next; disable Next until step is valid
- Progress indicator (1/2/3)
- Final step: import { completeOnboarding } from "@/app/actions"
  completeOnboarding(payload): Promise<{ ok: boolean }>
- Success screen after submit ("You're in. Redirecting…")

Keep all wizard state in the parent Component with useState.
Multi-file: StepAccount, StepWorkspace, StepInvite, Success, Component entry.
Inline SVG only.
```

---

### 5. Full SaaS settings page *(Continue workflow)*

Larger surface — raise Max tokens or use **Continue** if the stream cuts.

```text
Full Settings page with tabs: Profile | API Keys | Billing | Danger zone.

Profile: name, email, avatar placeholder, save via updateProfile from @/app/actions
API Keys: list mock keys, reveal/copy, create/revoke via listApiKeys / createApiKey / revokeApiKey from @/app/actions
Billing: plan badge, usage meter, "Manage billing" button (can be stub)
Danger zone: delete account with confirm modal

Multi-file: SettingsTabs, ProfilePanel, ApiKeysPanel, BillingPanel, DangerZone, Component entry.
Dark dashboard aesthetic, focus rings, loading/error states.
If generation hits the token limit, I will send Continue—prefer complete files over partial ones.
```

---

### 6. Auth screens — sign-in / sign-up toggle

Glass auth surface without third-party auth packages in the iframe (UI only + optional action).

```text
Polished auth UI: toggle between Sign in and Sign up (useState).

Sign in: email, password, show/hide password, "Forgot password?" link, primary Submit.
Sign up: name, email, password, confirm password, terms checkbox.
OAuth row: GitHub + Google as outline buttons (no real OAuth SDK — onClick can call stub actions).

Import optional stubs from @/app/actions:
- signIn({ email, password }): Promise<{ ok: boolean; error?: string }>
- signUp({ name, email, password }): Promise<{ ok: boolean; error?: string }>

On submit: loading state, then success panel ("Welcome back" / "Check your email") or inline field errors.
Split layout: form left, marketing panel right (product pitch + 3 bullets) on md+.
Dark glass aesthetic, focus rings, mobile stacks.
Multi-file: AuthForm, AuthMarketing, Component entry. Inline SVG brand mark — no lucide/next/image.
function Component() entry.
```

---

### 7. Kanban board *(interactive density)*

Client-heavy state — good dogfood for preview mount + local mutations (actions optional).

```text
Project Kanban board (dark, dense ops UI).

Columns: Backlog | In Progress | Done — with counts in headers.
Cards: title, tag chips (bug/feature/chore), assignee initials avatar, priority dot.
Interactions (useState required):
- "Add card" on a column appends a card
- Click card opens a side detail drawer (title, description, status select)
- Optional: move card between columns via status change in the drawer

Optional Server Actions from @/app/actions (if BYOB connected):
- listCards(): Promise<Card[]>
- createCard(input): Promise<Card>
- updateCard(id, input): Promise<Card>

Card shape: { id, title, description?, column: "backlog"|"progress"|"done", tags: string[], assignee: string, priority: "low"|"med"|"high" }

Multi-file: Board, Column, Card, CardDrawer, Component entry.
Empty column state, keyboard-focusable buttons. Inline SVG only.
function Component() entry.
```

---

### Continue (when generation cuts off)

**When it happens:** long multi-file gens (settings pages, wizards, full dashboards) hit **Max tokens** mid-string or mid-tag.

**What you’ll see:**
1. Toast: *Generation hit the token limit mid-stream* with **Continue with context**
2. Or the preview panel card with the same primary action  
3. While still streaming: soft “Continuing / building preview…” shell (not a dead end)

**Best path:** click **Continue with current context** → chat is prefilled → **Send**. Shipboard keeps product/layout context and asks for full closed files.

```text
The previous generation was CUT OFF mid-file (unterminated string / incomplete JSX).
Continue and complete every incomplete file from where it stopped.
Return FULL complete sources for each file (not only the missing tail).
Keep the same product, layout, and design language.
Entry must define function Component(). Close all strings, tags, and braces.
```

**Tips for fewer cuts:** raise Max tokens in Settings; prefer multi-file over one huge file; recipes **4 (wizard)**, **5 (settings)**, and **7 (Kanban)** are the usual Continue candidates.

**Avoid:** starting a totally new prompt when Continue would finish the same product.

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| Preview red panel / “could not compile” | Open Code tab; often mid-file cut → **Continue with context** or raise **Max tokens** |
| Token limit toast / truncation card | Primary: **Continue with context**; secondary: Max tokens in Settings; last resort: regenerate |
| Infinite “Building…” after gen finished | Hard refresh; finished cuts should show the Continue card, not a spinner |
| Empty list / action “not defined” | Import from `@/app/actions` with real names; connect BYOB for schema-driven mocks |
| Icons missing / crash on lucide | Use inline SVG or Tailwind—no npm icon packages in studio preview |
| Works in preview, wrong on eject | Set `DATABASE_URL` in `.env.local`; run real Server Actions against your DB |
| Preview ≠ production data | Expected: preview is an in-memory projection; eject uses your Postgres |

---

## After eject

1. `npm install` → `cp .env.example .env.local` → set `DATABASE_URL`  
2. `npm run dev` — same `@/app/actions` imports now hit **your** database  
3. Optional: `npx shipboard link …` + `npx shipboard dev` for studio ↔ disk sync  
4. Never commit `.shipboard/config.json`  

---

## Feedback (what we need from you)

File issues or notes with labels when possible:

| Label | Examples |
|-------|----------|
| `escape-hatch` | Export broken, bad Next layout, TS errors on clone |
| `byob` | Wrong columns, FK/relations, introspection failures |
| `preview` | Red panel, truncation, action intercept, empty iframe |
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
