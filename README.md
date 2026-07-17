# Shipboard

**Generate, preview, and ship React + Tailwind UI from chat.**

Chat → production-quality components → live preview + Monaco → versions → GitHub push → Pro upgrade.

**External beta users:** see **[BETA.md](./BETA.md)** for the full onboarding path, local CLI sync, multi-tenant access tokens, agent tool bus, and safety switches (quotas / maxSteps). It is also copied into ejected Next.js repos.

## Stack

- **Next.js 16** (App Router) + React 19  
- **Neon** Postgres (optional locally — in-memory fallback)  
- **GitHub OAuth** for accounts  
- **Stripe** free → Pro  
- **AI:** Groq (default free), xAI Grok, DeepSeek, OpenAI, Anthropic, Ollama (BYOK or server keys)

## Quick start

```bash
cd C:\Users\north\v0-app-creation
cp .env.example .env.local
# Set at least GROQ_API_KEY (or XAI_API_KEY) for cloud generation
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next prints if 3000 is busy).

| Path | What |
|------|------|
| `/` | Marketing landing |
| `/studio` | Builder (chat → preview → ship) |
| `/gallery` | Community showcase |
| `/share` | Read-only shared preview |

### Minimum env for generate

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Free-tier default (console.groq.com) |
| *or* `XAI_API_KEY` | Grok via xAI |
| *or* Ollama running locally | Settings → Ollama |

### Push to GitHub

After you generate a component, click **Push** in the preview toolbar.

1. **Personal Access Token (easiest locally)**  
   - Create a classic PAT with **`repo`** scope: [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=repo&description=Shipboard)  
   - In the Push dialog → **Access token** → paste → Connect  
   - Create a new repo or push into an existing one  

2. **OAuth app (production)**  
   - Create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers)  
   - Callback: `{NEXT_PUBLIC_APP_URL}/api/github/callback`  
   - Set `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` in `.env.local`  

Push sends a **full Next.js App Router + React + TypeScript + Tailwind project** (`app/`, `components/`, `package.json`, strict `tsconfig`, README). Clone into WSL and run `npm install && npm run dev`. (Pass `stack: "vite"` on the API for the legacy SPA scaffold.)

### Full product (auth + Pro + multi-user)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon |
| `GITHUB_CLIENT_ID` / `SECRET` | OAuth sign-in + push (optional if using PAT) |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | Pro checkout |
| `STRIPE_WEBHOOK_SECRET` | Plan upgrades |

## Features

- **Chat studio** with templates (SaaS landing, pricing, dashboards…)  
- **Live build view** while Grok streams code  
- **Multi-file projects** (`Component.tsx` + `Hero.tsx` / `Navbar.tsx` …) with file tree  

- **Live preview** + inline **Monaco** editor  
- **Version timeline** per project  
- **Brand kit** (colors, tone) injected into system prompt  
- **GitHub** create/push full **Next.js** project (escape hatch; OAuth or PAT)  
- **BYOB** Neon/Supabase: introspect → Drizzle + relations + drizzle-zod CRUD + preview intercept  
- **Tool Bus (Phase C):** auto DB agent tools + custom tools → Vercel AI SDK `app/api/chat` on ship  
- **Phase D:** Agent X-Ray telemetry + `npx shipboard` local sync CLI (`link` / `pull` / `push` / `dev`)  

### Local sync CLI (multi-tenant)

```bash
# 1. Studio: Settings → Access → Generate PAT (copy once)
# 2. From ejected app:
npx shipboard link --url https://shipboard.ca --session <session-id> --token sb_pat_…
npx shipboard pull
npx shipboard dev           # bi-di; PAT on every request
```

### Agent telemetry (multi-tenant)

```bash
# Studio: Settings → Access → Generate ingest key (for current project)
# Ejected .env.local:
SHIPBOARD_TELEMETRY_URL=https://shipboard.ca/api/telemetry/events
SHIPBOARD_PROJECT_ID=<session-id>
SHIPBOARD_INGEST_KEY=sb_ing_…
```

Ingest rejects requests without a valid `sb_ing_` key; events store `tenant_id` + `project_id`.  
X-Ray lists only the signed-in tenant’s rows.  

### Economic hard limits (billing protection)

Per-tenant daily budgets (UTC) + burst caps. Exceed → **HTTP 429** with `code` + usage.

| Plan | Telemetry/day | Tokens/day | Est. $/day | Sync/day |
|------|---------------|------------|------------|----------|
| Free | 200 | 50k | $1 | 80 |
| Builder | 2k | 400k | $8 | 400 |
| Pro | 15k | 2M | $40 | 2k |
| Max | 100k | 20M | $200 | 20k |

Also: telemetry & sync **burst/minute**, agent preview-tool quotas, ejected `SHIPBOARD_MAX_AGENT_STEPS` (default 8).  
`GET /api/usage` returns remaining budgets.  

Publish CLI: `cd packages/shipboard-cli && npm publish --access public`.




- **Shareable** preview links + **Remix** into a new project  
- **Ship** to GitHub + Vercel import (App Router scaffold)  
- **⌘K command palette** for ship / push / share / settings  
- **Free:** 5 generations/day · Groq / xAI / Ollama · GitHub push  
- **Pro:** unlimited · all providers · deploy helpers  

## Scripts

```bash
npm run dev      # local
npm run build    # production
npm run start    # after build
npm run lint
```

## Health

```bash
curl http://localhost:3000/api/health
```

## Deploy (Vercel)

1. Import this repo  
2. Set env vars from `.env.example`  
3. Deploy  
4. Stripe webhook → `https://YOUR_DOMAIN/api/stripe/webhook`  
5. GitHub OAuth callback → `https://YOUR_DOMAIN/api/github/callback`  

## License

Private — see repository settings.
