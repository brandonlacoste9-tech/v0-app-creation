# Shipboard Browser Worker

Playwright worker for **open-web** tasks (inspiration scrape). Runs **outside** Netlify.

The Shipboard Next app calls this via:

```bash
ADGEN_BROWSER_WORKER_URL=https://your-worker.example.com
ADGEN_BROWSER_SECRET=shared-secret
```

## Local

```bash
cd workers/adgen-browser
npm install
npx playwright install chromium
npm run dev
# → http://127.0.0.1:8787
```

### Health

```bash
curl http://127.0.0.1:8787/health
```

### Scrape

```bash
curl -X POST http://127.0.0.1:8787/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADGEN_BROWSER_SECRET" \
  -d '{"url":"https://stripe.com","screenshot":false}'
```

### CLI

```bash
npm run scrape -- https://linear.app
```

## Docker

```bash
docker build -t adgen-browser-worker .
docker run -p 8787:8787 -e ADGEN_BROWSER_SECRET=devsecret adgen-browser-worker
```

## Optional: browser-use later

Keep this worker as the AdGen boundary. For multi-step agent jobs, spawn browser-use **inside** this process (Python sidecar) without putting it in the Next app.

## Security

- Require `ADGEN_BROWSER_SECRET` in production
- Only allow `http(s)` URLs
- Do not scrape private IPs (add SSRF guard before public deploy)
