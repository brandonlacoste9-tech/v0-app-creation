# AdGenAI

**Generate, preview, and ship React + Tailwind UI from chat.**

Chat → production-quality components → live preview + Monaco → versions → GitHub push → Pro upgrade.

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

### Minimum env for generate

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Free-tier default (console.groq.com) |
| *or* `XAI_API_KEY` | Grok via xAI |
| *or* Ollama running locally | Settings → Ollama |

### Push to GitHub

After you generate a component, click **Push** in the preview toolbar.

1. **Personal Access Token (easiest locally)**  
   - Create a classic PAT with **`repo`** scope: [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=repo&description=AdGenAI)  
   - In the Push dialog → **Access token** → paste → Connect  
   - Create a new repo or push into an existing one  

2. **OAuth app (production)**  
   - Create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers)  
   - Callback: `{NEXT_PUBLIC_APP_URL}/api/github/callback`  
   - Set `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` in `.env.local`  

Push sends a **full Vite + React + Tailwind project** (`src/Component.tsx`, `package.json`, configs, README). Clone and run `npm install && npm run dev`.

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
- **Live preview** + inline **Monaco** editor  
- **Version timeline** per project  
- **Brand kit** (colors, tone) injected into system prompt  
- **GitHub** create/push full Vite project (OAuth or PAT)  
- **Shareable** preview links + **Remix** into a new project  
- **Ship** to GitHub + Vercel import (full Vite scaffold)  
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
