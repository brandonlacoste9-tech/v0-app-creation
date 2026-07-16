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

Open [http://localhost:3000](http://localhost:3000).

### Minimum env for generate

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Free-tier default (console.groq.com) |
| *or* `XAI_API_KEY` | Grok via xAI |
| *or* Ollama running locally | Settings → Ollama |

### Full product (auth + Pro + multi-user)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon |
| `GITHUB_CLIENT_ID` / `SECRET` | Sign in + push |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | Pro checkout |
| `STRIPE_WEBHOOK_SECRET` | Plan upgrades |

## Features

- **Chat studio** with templates (SaaS landing, pricing, dashboards…)  
- **Live preview** + inline **Monaco** editor  
- **Version timeline** per project  
- **Brand kit** (colors, tone) injected into system prompt  
- **GitHub** create/push repo  
- **Deploy** dialog  
- **Free:** 5 generations/day · Groq / xAI / Ollama  
- **Pro:** unlimited · all providers  

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
