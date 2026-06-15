# FEAT-1 — Implementation Notes

## What was built

A full quant backtesting platform on top of the existing monorepo. New code only; the original
health endpoint/page wiring was reused as the integration pattern. 19 strategies, share-based
no-borrow engine, dynamic grading, live signals, and a refreshable OHLCV data layer.

### Backend (`backend/src`)

- `market-data/` — `MarketDataService` loads `backend/data/*.json`, builds the US trading calendar
  from `^GSPC`, composes logical assets (`assets.ts`, incl. synthetic leveraged ETFs), and supports
  **live refresh** (`refreshFromLive`, `yahoo.client.ts`). Endpoints: `/api/market/overview`, `/series/:symbol`.
- `strategies/` — `indicators.ts` (SMA, return, RSI, vol, 13612W, accel); `definitions/` with **one
  file per strategy** (`01-*.ts`…`10-*.ts` + `improved/*-plus.ts`) aggregated by `index.ts`;
  `strategies.service.ts` (registry; **derives** `riskLevel` + `leverage` from a canonical backtest).
- `backtest/` — `engine.ts` (pure, share-based, no-borrow simulation + trade ledger); `metrics.ts`
  (XIRR via bisection, CAGR, max drawdown, Sharpe, annualized vol); `backtest.service.ts` orchestrates
  strategy + QQQ/VOO benchmarks. `GET /api/backtest`.
- `signals/` — `signals.service.ts` (live current-signal eval + change detection), `signals.scheduler.ts`
  (opt-in interval poller), controller (`GET /api/signals`, `POST /api/signals/refresh`).
- `notifications/` — email/LINE alert scaffold (`POST /api/notifications/subscribe`), fed by the scheduler.
- `scripts/` — `fetch-market-data.mjs` (core OHLCV), `fetch-stocks.mjs` (per-year-partitioned stocks),
  `refresh-all.mjs` (cron entry point); see `scripts/README.md`.

### Shared (`shared/src/types`)

- `strategy.ts`, `market.ts`, `backtest.ts`, `ratings.ts` (grading thresholds — single source of truth), `signal.ts`.

### Frontend (`frontend/src`)

- Pages: `/`, `/strategies`, `/strategies/[id]`, `/market`, `/guide`.
- Components: `nav-bar`, `strategy-card`, `charts` (recharts equity/drawdown/price), `sparkline`,
  `current-signal`, `states`. Queries: one hook per endpoint. `lib/format.ts` helpers; dark theme in `globals.css`.

## Key decisions

- **Yahoo Finance** chosen after Stooq started requiring JS proof-of-work. Free, no key, adjusted
  close, OHLCV, history to the 1980s for indices.
- **Logical-asset layer** lets strategies reference stable assets while the service handles ETF
  splicing + bond/cash synthesis from Treasury yields → backtests reach 1990 even for assets whose
  ETFs launched later.
- **Share-based, no-borrow engine**: tracks actual shares + cash; weights sum ≤ 1. Leverage is only
  achieved by holding synthetic leveraged ETFs (TQQQ/UPRO/SSO), never margin — so the trade ledger and
  holdings show concrete shares/dollars and no "300% borrowed" position. The engine is a pure function
  (`engine.ts`) reused by both the backtest service and the risk/leverage profiler.
- **Monthly cash is the strategy's to deploy**: DCA deposits land in cash and are invested only when
  the strategy's signal is "in"; otherwise they wait. Trades are labeled by action (open / exit-to-cash / switch / monthly-deposit).
- **Dynamic grading**: `riskLevel` and `leverage` are derived from a canonical backtest (vol → risk
  band; peak exposure → leverage), not hardcoded. Thresholds live in `shared/.../ratings.ts`; the
  backend, the rating badges, and `/guide` all read the same module.
- **Live signals**: `decide()` runs at the latest data index (never precomputed); data is refreshable
  and an opt-in scheduler detects allocation changes and dispatches alerts.

## Validation

- `npm run build`, `npm run lint`, `npm run test` all pass (also fixed a pre-existing backend ESLint
  `tsconfigRootDir` path bug + ignored generated `next-env.d.ts`).
- Engine sanity-checked against reality: DCA into S&P 500 from 1990 → ~11% annualized; Nasdaq → ~14%.
- All 19 strategies run with plausible, differentiated risk/return; drawdown ordering is sensible;
  improved variants generally beat their base on Sharpe / drawdown.
- UI verified in a browser (home, strategy detail with charts + live signal + ledger, market, guide).

## Follow-ups

- Wire real Email (SES/Resend) + LINE Messaging API in `NotificationsService`; add auth; persist
  signal state + subscriptions.
- Wire the individual-stock universe into the engine; add **fundamentals** (SEC EDGAR / paid).
- Add transaction costs/slippage; move data to a DB with scheduled refresh.
