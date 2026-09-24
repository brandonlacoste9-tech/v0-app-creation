# Shipboard Agent API

Build and manage stores programmatically — for AI assistants, scripts, and integrations.

**Base URL:** `https://shipboard.ca/api/agent`

## Auth

All endpoints require a Personal Access Token:

```
Authorization: Bearer sb_pat_...
```

Create one (signed in): `POST /api/auth/tokens` with `{ "name": "My agent" }`.
The raw token is shown once — copy it immediately.

## Endpoints

### Build a store — `POST /api/agent/stores`

One call builds a whole store from a brief. Waits for generation (~30-60s).

```json
{
  "storeName": "Harbor Goods",
  "tagline": "Goods for the modern harbor",
  "vibe": "street",
  "products": [
    { "name": "Harbor Cap", "price": 32 },
    { "name": "Harbor Tote", "price": 28, "description": "Canvas tote" }
  ],
  "provider": "xai",
  "model": "grok-4"
}
```

- `vibe`: `clean` | `atelier` | `street` (default: `clean`)
- `price`: dollars as number or string (`32`, `"32"`, `"$32.00"`); or `priceCents`
- `provider`: `groq` | `xai` | `deepseek` | `openai` | `anthropic` (default: `xai`)
- `model`: override (default: provider default)
- `apiKey`: provider API key override (default: server env var)

**Response:**
```json
{
  "storeId": "uuid",
  "title": "Harbor Goods",
  "versionId": "uuid",
  "code": "...serialized project...",
  "previewUrl": "/studio?p=uuid",
  "integrity": { "ok": true, "repaired": [], "issues": [] }
}
```

### List stores — `GET /api/agent/stores`

```json
{
  "stores": [
    {
      "id": "uuid",
      "title": "Harbor Goods",
      "versions": 3,
      "latestVersionId": "uuid",
      "previewUrl": "/studio?p=uuid"
    }
  ]
}
```

### Get store — `GET /api/agent/stores/:id`

Returns store details + latest code.

### Update store — `POST /api/agent/stores/:id/update`

Iterate with a natural-language message. Regenerates from latest code.

```json
{
  "message": "Change the hero background to navy blue",
  "provider": "xai"
}
```

### Eject to GitHub — `POST /api/agent/stores/:id/eject`

```json
{
  "repoName": "harbor-goods",
  "isPrivate": false,
  "githubToken": "ghp_...",
  "stack": "next"
}
```

- `githubToken`: GitHub PAT with `repo` scope. Falls back to connected OAuth.
- `stack`: `next` (default) | `vite`

**Response:** `{ "url": "https://github.com/...", "fullName": "...", "filesWritten": 24 }`

## Example: curl

```bash
# Build
curl -X POST https://shipboard.ca/api/agent/stores \
  -H "Authorization: Bearer sb_pat_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Harbor Goods",
    "vibe": "street",
    "products": [
      {"name": "Harbor Cap", "price": 32},
      {"name": "Harbor Tote", "price": 28}
    ]
  }'

# List
curl https://shipboard.ca/api/agent/stores \
  -H "Authorization: Bearer sb_pat_YOUR_KEY"

# Update
curl -X POST https://shipboard.ca/api/agent/stores/STORE_ID/update \
  -H "Authorization: Bearer sb_pat_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Make the header sticky"}'

# Eject
curl -X POST https://shipboard.ca/api/agent/stores/STORE_ID/eject \
  -H "Authorization: Bearer sb_pat_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"repoName": "harbor-goods", "githubToken": "ghp_..."}'
```

## Limits

- Generation timeout: 120s per request
- Project caps follow the API key owner's plan
- Generation counts against the owner's plan limits
