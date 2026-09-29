# Deploying ChainTrace

Stack: **Node/Express + SQLite** backend, **Vite/React** frontend, optional Python service.

## The three things that break a naive deploy

1. **Node 24 is mandatory for the backend.** Storage uses `node:sqlite`
   (`DatabaseSync`), which is only stable in Node 24. `backend/package.json`
   declares `engines.node >= 24.0.0` and `render.yaml` sets `NODE_VERSION=24`.
   If you host the API anywhere defaulting to Node 20, it will crash on boot.
2. **The frontend is a SPA.** It uses `BrowserRouter`, so a refresh on
   `/wallet/0x...` must serve `index.html`. Render's `render.yaml` does this with
   a `rewrite /* -> /index.html` route. On another host, add the equivalent
   rewrite (Netlify `_redirects`, Vercel `vercel.json`, nginx `try_files`).
3. **The two services must be told about each other.** CORS and the API base URL
   are separate settings, and the API URL is baked in at **build** time.

## Deploy to Render (blueprint)

1. Push the repo (already done) and go to <https://render.com> → **New → Blueprint**.
2. Select this repository. Render reads `render.yaml` and creates both services.
3. Wait for the first build. Note the two URLs, e.g.
   `https://chaintrace-api.onrender.com` and `https://chaintrace-web.onrender.com`.
4. Wire them up (this step is required, the blueprint leaves them blank):
   - On **chaintrace-api** → Environment → set
     `CORS_ORIGIN = https://chaintrace-web.onrender.com` → Save (restarts).
   - On **chaintrace-web** → Environment → set
     `VITE_API_URL = https://chaintrace-api.onrender.com/api` → Save, then
     **Manual Deploy → Deploy latest commit** so the value is baked into the bundle.
5. Open `https://chaintrace-web.onrender.com` and check
   `https://chaintrace-api.onrender.com/api/health` returns `"ok": true`.

## Free-tier caveats (read before demoing)

- **Ephemeral disk.** `DATABASE_PATH=./data/chaintrace.db` lives on a temporary
  filesystem, so investigations, watchlist entries, cases and annotations are
  **wiped on every redeploy or restart**. The VASP seed data is re-created at boot,
  so the app always works; only your saved work is lost. For durable data, add a
  Render disk mounted at `backend/data` and keep `DATABASE_PATH=./data/chaintrace.db`.
- **Cold starts.** Free web services idle out after ~15 minutes and the next
  request can take up to ~50s. Before a live demo, open the app a couple of
  minutes ahead to wake it.
- **Rate limit.** The API allows 120 requests/minute per IP.

## Going live instead of demoing

Set `DEMO_MODE=false` and supply real keys on **chaintrace-api**:

| Variable | Purpose |
| --- | --- |
| `ALCHEMY_API_KEY` | Fetches live on-chain activity |
| `ETHERSCAN_API_KEY` | Enriches transaction/token metadata |
| `GROQ_API_KEY` | AI explanations (optional; falls back to a deterministic template) |

`DEMO_MODE=true` needs **no API keys at all**, which makes it the safest choice for
a hackathon demo.

## Running locally

```bash
# backend - http://localhost:4000  (Node 24 required)
cd backend && npm install && npm run dev

# frontend - http://localhost:5173
cd frontend && npm install && npm run dev
```

If the frontend runs on a port other than 5173/5174, add it to the backend's
`CORS_ORIGIN` or browser requests will be blocked.

## The optional Python service

`analysis/` is a Flask + NetworkX service used to enrich attribution. It is
**not required** - `backend/src/services/pythonClient.ts` has a 6s timeout and
falls back to the built-in TypeScript graph engine. It is disabled in
`render.yaml` via `PYTHON_ANALYSIS_URL=""`. To run it locally:

```bash
cd analysis && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python app.py   # serves on :5090
```
