# FEAT-1 — Implementation Notes

## What was built

A full quant backtesting platform on top of the existing monorepo. New code only; the original
health endpoint/page wiring was reused as the integration pattern. 10 strategies, share-based
no-borrow engine, dynamic grading, live signals, and a refreshable OHLCV data layer.

### Backend (`backend/src`)

- `market-data/` — `MarketDataService` loads `backend/data/*.json`, builds the US trading calendar
  from `^GSPC`, composes logical assets (`assets.ts`, incl. synthetic leveraged ETFs), and supports
  **live refresh** (`refreshFromLive`, `yahoo.client.ts`). Endpoints: `/api/market/overview`, `/series/:symbol`.
- `strategies/` — `indicators.ts` (SMA, return, RSI, vol, 13612W, accel); `definitions/` with **one
  file per strategy** (`01-*.ts`…`10-*.ts`, shared math in `_helpers.ts`) aggregated by `index.ts`;
  `strategies.service.ts` (registry; **derives** `riskLevel` + `leverage` from a canonical backtest).
  10 strategies ship: `01` is the flagship (3x Nasdaq gated by the **QQQ / Nasdaq-100** 20-day MA —
  the signal is the *unleveraged* index, not TQQQ); `02`–`10` are research-driven rules-based
  approaches (composite 13612W momentum, vol targeting, inverse-vol risk parity, etc.). Each
  definition carries a `signalFormula` string that is **the math rendered on the UI** and must stay
  in lockstep with its `decide()` — treat them as one unit when editing.
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
- All 10 strategies run with plausible, differentiated risk/return; drawdown ordering is sensible.
- UI verified in a browser (home, strategy detail with charts + live signal + ledger, market, guide).

## Changelog — strategy consolidation & fixes

Post-initial-build refinements (the registry previously shipped 19 strategies: 10 base + 9
`*-plus` "improved" variants):

- **Collapsed 19 → 10 strategies.** The 9 research-improved variants were promoted to *be*
  strategies `02`–`10`: each base file now carries the improved `decide()` logic under the **base
  identity** (clean `id` without `-plus`, name without「改良版／+」, and prose rewritten so it no
  longer reads as a variant of an "original"). The `definitions/improved/` folder was deleted and
  `index.ts` now registers exactly the 10 files. `coreAssets`/`warmupDays` were carried over from the
  promoted logic, so data-inception dates are unchanged. Strategy `01` (the mandated flagship) was
  left logically untouched.
- **Flagship signal clarified (`01`).** `decide()` already evaluated the 20-day MA on `ASSET.NASDAQ`
  (the unleveraged Nasdaq-100 index that QQQ tracks) and only *traded* TQQQ — it was never signalling
  off TQQQ's own MA. No logic change was needed; the `signalFormula`, rules, and description were
  reworded to state this explicitly ("NASDAQ = QQQ／Nasdaq-100, not TQQQ"). The `NASDAQ` asset key is
  retained in the formula so it stays consistent with the code and the other definitions.
- **`signalFormula` ↔ `decide()` audit.** All 10 formulas were checked against their code. One real
  drift was fixed in `04-leverage-long-run`: the formula claimed a pure UPRO blend, but the code calls
  `equityExposureWeights(…, USLC2X, USLC3X)`, i.e. **SSO (2x) up to 2x exposure, UPRO (3x) above**.
  The formula was corrected to match, and `USLC2X` (which the code allocates to) was added to the
  strategy's declared `assets`/`universe`.
- **Mobile nav fix.** The top-right `.nav-tag` pill ("美股 · 回測 · 教育用途") was wrapping into a
  vertical strip and overflowing the bar on narrow screens. Added `white-space: nowrap` + `flex-shrink: 0`
  and hide it under the existing 620px breakpoint (`frontend/src/app/globals.css`).
- **Verification.** `npm run build` and the backend test suite pass; a runtime smoke test confirms the
  registry resolves to 10 strategies with sensible derived risk/leverage and that backtests + live
  signals run. (The frontend `provider.utils.spec.ts` failure is a pre-existing Jest-runtime version
  issue, unrelated to these changes.)

## Follow-ups

- Wire real Email (SES/Resend) + LINE Messaging API in `NotificationsService`; add auth; persist
  signal state + subscriptions.
- Wire the individual-stock universe into the engine; add **fundamentals** (SEC EDGAR / paid).
- Add transaction costs/slippage; move data to a DB with scheduled refresh.
