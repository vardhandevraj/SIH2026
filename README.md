# ChainTrace — Blockchain Intelligence for Wallet Attribution

**Smart India Hackathon 2026 · Problem Statement SIH26182**

> Automated Attribution of Unknown Cryptocurrency Wallets to Nearest Virtual Asset Service Providers (VASPs) through Blockchain Intelligence APIs.

ChainTrace is a **fully working** end-to-end application: an investigator enters an unknown Ethereum wallet address, and the system collects real on-chain activity, normalises transactions, builds an address relationship graph, compares interacting addresses against a VASP known-address database, computes an **explainable, deterministic attribution confidence score**, shows the supporting evidence, and generates a downloadable investigation report.

> The system never claims that an unknown wallet *belongs* to a VASP. Results are labelled **"Likely VASP"**, **"Attribution Confidence"**, **"Supporting Evidence"** and **"Probabilistic Attribution"**, exactly as the problem statement requires: automated attribution is treated as supporting evidence, not proof.

---

## 1. Project Overview

```
Investigator enters address
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  React frontend (Vite + TS + Tailwind)                     │
│  landing · dashboard · wallet · graph · report · VASPs     │
│  history · settings                                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Node/Express backend (TypeScript)                         │
│  • address validation  • CORS  • rate limiting  • errors   │
│  ├── SQLite (Node built-in node:sqlite) — VASPs,          │
│  │      Investigations, Reports (local file, no server)   │
│  ├── Blockchain clients        Alchemy → Etherscan (RPC)   │
│  │      DEMO_MODE generator (deterministic sample data)    │
│  ├── Graph builder (BFS relationship graph, fund flow)     │
│  ├── Attribution engine (5 weighted deterministic signals)│
│  ├── Evidence engine (H/M/L evidence cards from real data)│
│  ├── Report generator (11-section structured report)      │
│  └── AI explainer (Groq LLM, constrained to computed      │
│         evidence only — deterministic template fallback)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ optional enrichment
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Python analysis service (Flask + NetworkX + scikit-learn) │
│  PageRank, betweenness, shortest VASP distances,           │
│  community (modularity) clustering signals                 │
└─────────────────────────────────────────────────────────────┘
```

Three core SIH capabilities are demonstrated visibly:

1. **Automated Wallet Intelligence** — fetch + normalise real on-chain data.
2. **Transaction & VASP Attribution** — deterministic, explainable scoring.
3. **Risk Analysis & Investigation Dashboard** — evidence, fund flow, risk indicators, report.

---

## 2. Features

- Ethereum address validation (regex + EIP-55 checksum)
- Real data collection via **Alchemy** (`alchemy_getAssetTransfers`, `eth_getBalance`) with **Etherscan** (`txlist`, `tokentx`, `balance`) fallback
- Normalised internal transaction model (hash, from, to, value, token, timestamp, direction, block, gas)
- Transaction relationship graph (React Flow: zoom / pan / node+edge selection / filtering)
- VASP known-address DB with full CRUD API and clear **"DEMO / SAMPLE ADDRESS"** labelling
- Deterministic attribution scoring engine — **5 configurable weighted factors**:
  | Factor | Weight |
  |---|---|
  | A. Known VASP Address Interaction | 30% |
  | B. Graph Distance / Transaction Proximity | 25% |
  | C. Fund Flow Relationship | 20% |
  | D. Wallet Cluster Similarity | 15% |
  | E. Transaction Behaviour Similarity | 10% |
- Evidence engine — every evidence item is derived from computed structures only (type, description, strength H/M/L, source, related tx hashes)
- Fund-flow path visualisation (chain walk to candidate)
- Suspicious-pattern detection (peel-chain splitting, rapid pass-through, fan-out)
- Investigation reports (view + download as PDF via jsPDF) with explicit probabilistic disclaimer
- Optional **Groq** explanation constrained to supplied structured evidence; deterministic template fallback
- Investigation history with re-open of previous analyses
- **Demo Mode** — complete end-to-end demonstration with clearly labelled synthetic data, no API keys required
- Security: no API keys in the browser, CORS config, rate limiting, request timeouts, sanitised logging, input validation, central error handling

---

## 3. Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, React Router 6, Recharts, React Flow (`@xyflow/react`), Lucide icons, jsPDF |
| Backend | Node.js, Express 4, TypeScript, ethers.js, express-rate-limit, cors |
| Database | SQLite via Node's built-in `node:sqlite` (zero extra dependencies, local file) |
| Blockchain | Alchemy API, Etherscan API, Ethereum JSON-RPC (via ethers) |
| Analysis | Python 3, Flask, NetworkX, scikit-learn, NumPy |
| AI | Groq (OpenAI-compatible chat API — Llama models), optional & constrained |

---

## 4. Folder Structure

```
bokka/
├── .env.example                 # all environment variables, documented
├── README.md
├── analysis/                    # Python graph-analysis service
│   ├── app.py                   # Flask + NetworkX /analyze + /health
│   └── requirements.txt
├── backend/                     # Node/Express API
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # server bootstrap + /api/health + error middleware
│       ├── config/env.ts        # env parsing (root .env or backend/.env)
│       ├── types.ts             # shared domain types
│       ├── db/                  # sql.ts (node:sqlite init + schema), store, seed
│       ├── routes/index.ts      # REST endpoints
│       ├── services/
│       │   ├── blockchain/      # alchemy, etherscan, demo generator, http helper
│       │   ├── normalize.ts     # raw → internal model + wallet overview
│       │   ├── graph.ts         # adjacency + BFS graph builder
│       │   ├── behavior.ts      # feature vectors, cosine similarity, clustering
│       │   ├── attribution.ts   # 5-factor deterministic scoring engine
│       │   ├── evidence.ts      # H/M/L evidence generation
│       │   ├── fundflow via attribution.ts
│       │   ├── aiExplainer.ts   # Groq (constrained) + template fallback
│       │   ├── pythonClient.ts  # calls /analysis service
│       │   ├── report.ts        # 11-section investigation report
│       │   └── pipeline.ts      # analyzeWallet orchestration
│       └── utils/               # validation, errors, logger
└── frontend/                    # React SPA
    ├── package.json
    ├── vite.config.ts           # dev server :5174, /api proxy
    ├── tailwind.config.js
    └── src/
        ├── api/                 # typed client + types mirroring backend
        ├── components/          # Sidebar, GraphExplorer, ConfidenceMeter,
        │                        # EvidenceCard, TransactionTable, FundFlowView,
        │                        # SummaryPanel, ReportView, AnalyzeForm, State, ...
        ├── context/DemoContext  # demo mode toggle (localStorage)
        ├── pages/               # Landing, Dashboard, WalletDetail,
        │                        # InvestigationDetail, GraphPage, VaspsPage,
        │                        # HistoryPage, SettingsPage
        ├── AppLayout.tsx        # sidebar + routed outlet
        └── main.tsx             # router setup
```

---

## 5. Environment Variables

Copy `.env.example` to `.env` (root or `backend/`):

| Variable | Description | Default |
|---|---|---|
| `DEMO_MODE` | `true` = deterministic seeded demo data (no keys needed) | `true` |
| `PORT` | Backend port | `4000` |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins | `http://localhost:5173,http://localhost:5174` |
| `DATABASE_PATH` | SQLite database file path (relative to backend cwd; `:memory:` for ephemeral) | `./data/chaintrace.db` |
| `ALCHEMY_API_KEY` | Alchemy key (https://dashboard.alchemy.com) | empty |
| `ETHERSCAN_API_KEY` | Etherscan key (https://etherscan.io/apis) | empty |
| `GROQ_API_KEY` | For human-readable explanation generation (https://console.groq.com/keys) | empty → template |
| `GROQ_MODEL` | Groq model id | `llama-3.3-70b-versatile` |
| `PYTHON_ANALYSIS_URL` | Python analysis service | `http://127.0.0.1:5090` |
| `ATTRIBUTION_WEIGHTS` | JSON override of the five factor weights | optional |
| `LOG_LEVEL` | `debug`/`info`/`warn`/`error` | `info` |

**Security:** API keys are read only by the backend process. The React frontend never receives them.

---

## 6. External Service Setup

### SQLite (local database)
- No server required. The database is a single SQLite file created on first start at `backend/data/chaintrace.db` (set `DATABASE_PATH` to change the location, or `:memory:` for an ephemeral database).
- Uses **Node's built-in `node:sqlite`** module (Node 22.5+/24 recommended) — no native dependencies to install.
- Tables are created automatically: `vasps`, `investigations`, `reports`. Schema is tiny and type-safe (parameterised queries, JSON-encoded nested fields).
- Data persists across backend restarts.

### Alchemy
1. Create a free account at https://dashboard.alchemy.com.
2. Create an app on the **Ethereum** network (Mainnet).
3. Copy the API key into `ALCHEMY_API_KEY` and set `DEMO_MODE=false`.

### Etherscan
1. Register at https://etherscan.io/register and create an API key.
2. Copy it into `ETHERSCAN_API_KEY` as a fallback provider.

Provider priority: **Alchemy → Etherscan → error (or demo fallback if demo mode is on).**

### Groq (optional)
1. Create a key at https://console.groq.com/keys (free tier available).
2. Set `GROQ_API_KEY`.
3. The AI is used **only** to summarise already-computed structured evidence. It cannot invent transactions, addresses, percentages, or override the scoring engine. If the key is absent or the call fails, a deterministic template explanation is used.

### Python analysis service (optional enrichment)
1. `python3 -m venv .venv && source .venv/bin/activate`
2. `pip install -r analysis/requirements.txt`
3. `python analysis/app.py` (default port `5090` → mirrors `PYTHON_ANALYSIS_URL`).

If the service is down, the backend gracefully continues with its built-in graph engine.

---

## 7. Demo Mode

`DEMO_MODE=true` makes the whole product demonstrable with **zero external credentials**:

- The demo data generator produces a deterministic, scenario-rich & clearly-labelled synthetic wallet dataset (ETH transfers, USDT/WETH/UNI ERC-20 transfers, direct deposits, intermediary chains, shared counterparty clusters, a peel-chain pattern, noise).
- The entire UI flow works: dashboard → graph → attribution → evidence → fund flow → report.
- Every demo dataset displays a **"DEMO DATA"** banner, and seeded addresses carry **"DEMO / SAMPLE ADDRESS"** labels. Demo data is never presented as verified on-chain evidence.

"Run Demo Investigation" on the landing/dashboard runs the example investigation end-to-end. Any other valid address in demo mode also produces a coherent (deterministically derived) analysis.

---

## 8. Installation

Prerequisites: **Node 18+** (Node 22.5+/24 recommended for `node:sqlite`), **npm**, **Python 3.9+** (optional analysis service).

```bash
# 1) Configure environment
cp .env.example .env            # edit values (demo works as-is)

# 2) Backend
cd backend
npm install
npm run build                   # typecheck + compile
npm run dev                     # dev server with watch (port 4000)

# 3) Analysis service (optional)
cd ../analysis
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py                   # http://127.0.0.1:5090

# 4) Frontend
cd ../frontend
npm install
npm run dev                     # http://localhost:5174
```

Open **http://localhost:5174**.

---

## 9. Running

| Piece | Command (from its folder) | URL |
|---|---|---|
| Backend | `npm run dev` | `http://localhost:4000/api/health` |
| Python analysis | `python app.py` | `http://127.0.0.1:5090/health` |
| Frontend | `npm run dev` | `http://localhost:5174` |

Frontend build check: `npm run build` (typecheck + production bundle).

---

## 10. API Documentation

Base URL: `http://localhost:4000/api` · JSON responses: `{ ok, ... }`, errors: `{ ok:false, error:{ code, message } }`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service status, demo mode, configured providers, attribution weights, DB stats |
| POST | `/wallet/analyze` | Body `{ address, forceDemo?, investigator? }` — run full analysis pipeline and store investigation |
| GET | `/wallet/:address` | Wallet overview + latest investigation |
| GET | `/wallet/:address/transactions` | Normalised transactions |
| GET | `/wallet/:address/graph` | Transaction relationship graph |
| GET | `/wallet/:address/attribution` | Scored candidates, likely VASP, confidence, factors |
| GET | `/wallet/:address/evidence` | Evidence items (H/M/L) |
| POST | `/report/generate` | Body `{ investigationId }` → structured report (11 sections) |
| GET | `/report/:id` | Fetch a generated report |
| GET | `/investigations` | Investigation history rows |
| GET | `/investigations/:id` | Investigation + its reports |
| GET | `/vasps?search=` | List/search VASP entities |
| POST | `/vasps` | Create entity + known addresses |
| PUT | `/vasps/:id` | Update entity/addresses |
| DELETE | `/vasps/:id` | Delete entity |
| GET | `/vasps/:id` | Single entity |

### Example analysis

```bash
curl -X POST http://localhost:4000/api/wallet/analyze \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc454e4438f44e","forceDemo":true}'
```

Example wallet: `0x742d35Cc6634C0532925a3b844Bc454e4438f44e` (also the demo wallet, pre-wired into the UI).

---

## 11. Investigation Dashboard (main flow)

1. Enter wallet → `POST /wallet/analyze`.
2. Pipeline: validate → fetch → normalise → graph → VASP match → score → evidence → explanation → persist.
3. Dashboard shows: wallet overview, circular **Attribution Confidence** meter, Likely VASP + candidate ranking with factor breakdown, interactive transaction graph, evidence cards, fund-flow paths, transaction table, risk summary, AI explanation banner.
4. **Generate Investigation Report** → view + **Download PDF**.
   The report states explicitly:
   > "Attribution is probabilistic and intended to support investigation. It should not be treated as definitive proof of ownership or control."

---

## 12. Error States

Graceful, user-friendly messages for: invalid address, no transactions, provider unavailable, rate limit, timeout, unknown network, no attribution above threshold, Groq unavailable (template fallback). The UI surfaces these with retry affordances and a hint to enable Demo Mode.

---

## 13. Troubleshooting

| Issue | Fix |
|---|---|
| `localhost:5174` blank / older app served on 5173 | A different Vite app may own `:5173`. ChainTrace uses `:5174`; if that is taken, edit `frontend/vite.config.ts` and add the port to `CORS_ORIGIN`. |
| Backend stuck / DB file locked | SQLite WAL mode is used; if the DB file was copied mid-write, delete `backend/data/chaintrace.db*` and restart. |
| "Blockchain data could not be retrieved" | Keys are missing/invalid. Enable `DEMO_MODE`, or add `ALCHEMY_API_KEY`/`ETHERSCAN_API_KEY`. |
| Python enrichment not shown in `method` | Analysis service not running (port 5090) — backend continues without it. |
| Groq explanation is the template | `GROQ_API_KEY` unset or network blocked — deterministic fallback is automatic. |
| Rate limited | Free providers throttle; wait or enable demo. |
| Report PDF looks off | Uses jsPDF; ensure `jspdf` installed (`npm install` in frontend). |

---

## 14. Verification (what was tested)

- Backend: `npm run build` and `npm run typecheck` clean; all endpoints exercised (analyze, report, investigations, vasps CRUD, health, invalid-address rejection).
- Database: SQLite file created at `backend/data/chaintrace.db`; seeded VASPs, investigations and reports **persist across backend restarts** (verified).
- Frontend: `npm run build` (typecheck + bundle) clean; dev server serves the app.
- Full E2E in a real Chromium browser (headless): landing loads → Run Demo Investigation → graph renders (21 nodes) → attribution confidence displayed → evidence cards → 44-row transaction table → fund flow → report generation (with disclaimer) → history / VASPs / settings pages — all pass, no JS runtime errors.