# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QuantDesk** — a US-stock quantitative strategy backtesting platform (FinLab-style) built on a
Next.js + NestJS monorepo (npm workspaces + Turborepo). It fetches free US market data, runs 10
rules-based strategies through a backtest engine, and compares two contribution modes (monthly DCA
vs lump sum) against QQQ/VOO benchmarks. See `documents/FEAT-1/plans/PRD.md` for full requirements.

```
├── frontend/           # Next.js 15 (App Router) + TanStack Query + recharts — port 3001
├── backend/            # NestJS 11 + nodemon — port 3000
│   ├── data/           # Cached daily price JSON (generated, committed)
│   ├── scripts/        # fetch-market-data.mjs (Yahoo Finance fetcher)
│   └── src/
│       ├── market-data/  # loads JSON + live refresh (Yahoo), composes logical assets
│       ├── strategies/   # strategy definitions + indicators + registry (derives risk/leverage)
│       ├── backtest/     # pure share-based engine + metrics (XIRR/CAGR/maxDD/Sharpe)
│       ├── signals/      # live current-signal eval + change detection + opt-in scheduler
│       └── notifications/ # [future] email/LINE trade-alert scaffold
├── shared/             # Shared TypeScript types (@repo/shared)
├── .claude/commands/   # Custom slash commands
├── documents/          # Work tracking (organized by ticket)
├── turbo.json          # Turborepo configuration
└── package.json        # npm workspaces root
```

## Commands

```bash
npm install              # Install all dependencies
npm run dev              # Start FE (:3001) + BE (:3000) in parallel
npm run build            # Build all workspaces
npm run test             # Run all tests
npm run lint             # Lint all code
```

**Refresh market data** (re-fetches all series from Yahoo Finance into `backend/data/`):

```bash
cd backend && node scripts/fetch-market-data.mjs          # 32 core index/ETF/yield series (daily OHLCV)
cd backend && node scripts/fetch-stocks.mjs AAPL MSFT      # individual stocks → data/stocks/<SYM>/<YEAR>.json
```

**Data inventory for strategy research** — `documents/FEAT-1/development/DATA.md`: what data exists
(daily OHLCV for indices/ETFs/yields + a demo stock universe), the logical-asset layer, the
`decide(ctx)` toolbox, and what's missing (fundamentals, intraday history) + how to add it.

**Backend tests:**

```bash
cd backend && npm run test          # Jest unit tests
cd backend && npm run test:watch    # Watch mode
cd backend && npm run test:cov      # Coverage report
cd backend && npm run test:e2e      # E2E tests
```

**Run a single test file:**

```bash
cd frontend && npx jest src/path/to/file.spec.ts
cd backend  && npx jest src/path/to/file.spec.ts
```

## Architecture

### Request Flow

The TanStack Query default `queryFn` turns the query key into the request path, so `GET`
endpoints map directly to query keys. Example: strategy detail page → `useBacktest({...})`
→ key `['api','backtest', { strategyId, mode, start, monthly }]` → `GET /api/backtest?...`
→ `BacktestService.run()` returns a `BacktestResult` (shared type) → charts render via recharts.

- **API client**: `frontend/src/utils/fetchers/fetchers.client.ts` constructs URLs from `NEXT_PUBLIC_API_URL` (default: `http://localhost:3000`); query-key→path in `vendors/tanstack-query/provider.utils.ts`
- **Query hooks**: `frontend/src/queries/` — `use-strategies`, `use-strategy`, `use-backtest`, `use-market-overview`, `use-market-series`
- **Pages**: `/` dashboard, `/strategies` list, `/strategies/[id]` detail (backtest controls + charts), `/market`, `/guide` (指標說明 — metric/threshold glossary)
- **Ratings**: `shared/src/types/ratings.ts` is the single source of truth for grading thresholds (risk-by-vol, Sharpe/drawdown/vol/return quality bands). Backend derives `riskLevel` + `leverage`; frontend renders rating badges + the guide page from the same module.

### Backend data & engine

- **Data**: `market-data/market-data.service.ts` loads `backend/data/*.json` at startup, builds the
  canonical US trading calendar (from `^GSPC`), and composes **logical assets** (`ASSET.*` in
  `market-data/assets.ts`) — splicing ETF/index histories and synthesizing bond/cash returns from
  Treasury yields so strategies can backtest to 1990. Leverage is modeled via portfolio weights >1.
- **Strategies**: `strategies/definitions/` — one editable file per strategy (`01-*.ts`…`10-*.ts`),
  aggregated by `definitions/index.ts`. Each is a pure
  `decide(ctx) → Weights` using indicators in `strategies/indicators.ts`, plus a `signalFormula`
  string shown on the UI (keep this string in sync with `decide` — it is the displayed math).
  `coreAssets` + `warmupDays` drive the data-inception date; `riskLevel`
  and `leverage` are NOT hardcoded — `StrategiesService` derives them from a canonical backtest
  (volatility → risk band; peak exposure → leverage). To add/tune a strategy, edit its file (or add
  one and register it in `index.ts`). 10 strategies ship: strategy 1 is the flagship (3x Nasdaq
  gated by QQQ's 20-day MA); strategies 2-10 are research-driven rules-based approaches.
- **Engine**: `backtest/engine.ts` — share-based, NO-borrow daily simulation (leverage only via
  leveraged-ETF assets); ≤3 trades/month; DCA & lump-sum modes; produces a share/dollar trade
  ledger + holdings. `backtest/backtest.service.ts` orchestrates it (strategy + QQQ/VOO benchmarks);
  metrics (XIRR/CAGR/maxDD, Sharpe, vol, peak leverage) in `backtest/metrics.ts`. The engine is a
  pure function so `StrategiesService` can reuse it for risk/leverage profiling.

### Shared Types

`shared/src/types/` — `strategy.ts` (StrategySummary/Detail), `market.ts` (MarketOverview/PriceSeries),
`backtest.ts` (BacktestRequest/Result), plus the original `health.ts` / `api.ts`.
Import as: `import { BacktestResult } from '@repo/shared'`

### Backend Structure

- `src/main.ts` — bootstraps NestJS, enables CORS (`origin: true, credentials: true`), mounts Swagger UI at `/` and JSON at `/api-json`
- `src/app.module.ts` — root module; imports MarketData/Strategies/Backtest/Notifications modules, loads global `ConfigModule`
- DTOs in `src/dto/` implement shared interfaces and add Swagger decorators

### Live signals (real-time buy/sell)

Signals are computed live (`SignalsService` runs each strategy's `decide()` at the latest data
index — never precomputed). Data is refreshable: `MarketDataService.refreshFromLive(range, interval)`
pulls the latest bars from Yahoo and atomically rebuilds. Endpoints: `GET /api/signals`,
`GET /api/signals/:id`, `POST /api/signals/refresh?interval=1d|1h|1m`. `SignalScheduler` (opt-in)
polls on an interval, detects target-allocation changes, and dispatches them to `NotificationsService`.
See `documents/FEAT-1/development/realtime-signals.md`.

### Environment Variables

Copy `.env.example` to `.env` in each workspace before running:

- `backend/.env` — `NODE_ENV`, `PORT` (default 3000)
- Live signals (optional): `SIGNALS_LIVE=true`, `SIGNALS_INTERVAL_MS` (default 3600000),
  `SIGNALS_DATA_INTERVAL` (`1d`/`1h`/`1m`), `SIGNALS_DATA_RANGE`
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`)

## Code Style

- **Prettier**: semi, 2-space tabs, 100 print width, single quotes, trailing commas
- **ESLint**: unified root `.eslintrc.js` — TypeScript, Next.js, Prettier; all packages at root
- **TypeScript**: strict mode; frontend uses `moduleResolution: bundler`; backend uses CommonJS + decorators; shared uses CommonJS

## Documentation Pattern

Work is tracked in `documents/[TICKET-NUMBER]/`:

```
documents/FEAT-1/
├── plans/        # PRDs, RFCs, design decisions
└── development/  # Implementation docs
```

## Custom Slash Commands

Located in `.claude/commands/[skill-name]/SKILL.md`. Replace `[TICKET]` with ticket ID (e.g., `FEAT-1`).

| Command                                   | Description                                     |
| ----------------------------------------- | ----------------------------------------------- |
| `/write-a-prd [TICKET]`                   | Create a PRD through systematic discovery       |
| `/grill-me [TICKET]`                      | Stress-test a plan through questioning          |
| `/tdd [TICKET]`                           | Implement features with test-driven development |
| `/triage-issue [TICKET]`                  | Investigate bugs and create fix plans           |
| `/improve-codebase-architecture [TICKET]` | Find architectural improvements                 |
| `/deploy-vercel [TICKET]`                 | Deploy to Vercel with step-by-step guidance     |

## Deployment (Vercel)

- **Frontend**: set root directory `frontend`, auto-detected as Next.js
- **Backend**: set root directory `backend`, runs as serverless function via `backend/api/index.ts`
- Backend serverless limitations: cold starts, no WebSockets, 10s timeout
