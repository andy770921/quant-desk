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
  10 strategies ship: `01` is the mandated leveraged flagship (3x Nasdaq gated by the **QQQ /
  Nasdaq-100** 20-day MA — the signal is the *unleveraged* index, not TQQQ); `02`–`10` are
  **unleveraged** skill-based strategies (see the changelog below for the current lineup). The UI's
  buy/sell "formula" is generated from the real `decide()` source by `scripts/generate-signal-source.mjs`
  into `definitions/signal-source.generated.ts` (guarded by `signal-source.spec.ts`), so the displayed
  math can never drift from the code.
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

## Changelog — unleveraged rewrite, S&P 500 stock universe, drawdown-aware

The brief: strategies `02–10` must beat dollar-cost-averaging into QQQ or VOO **on a level playing
field** — i.e. **no borrowing** (the benchmark doesn't borrow, and leveraged ETFs embed borrowing),
**low drawdown as a tracked metric**, and **less survivorship bias** in any stock selection. The
result is a clean rewrite of `02–10` from leveraged asset-allocation to unleveraged, skill-based
strategies.

- **Eval harness (new).** `backtest/strategy-eval.ts` + `strategy-eval.spec.ts` score every strategy
  against the QQQ/VOO **DCA** benchmarks over its full history and report annualized return, Sharpe,
  **max drawdown, and Calmar (return ÷ maxDD)**. The spec is the locked contract: each `02–10` must
  (1) beat QQQ **or** VOO final value by **≥20%**, (2) have Sharpe ≥ QQQ − 0.1, (3) be **unleveraged**
  (`peakLeverage === 1`), and (4) draw down **less than buy-and-hold Nasdaq**. The flagship `01` is
  exempt from (3)/(4).
- **Strategies `02–10` rewritten, all unleveraged (gross ≤ 1, peak exposure ≤ 1x):**
  - `02–05` — **survivorship-bias-free index asset-allocation**: `02` dual momentum / GEM
    (relative + absolute momentum across Nasdaq/S&P/small/intl, bonds when risk-off), `03` defensive
    asset allocation (Keller-style dual "canary"), `04` Nasdaq time-series-momentum + Treasury ballast,
    `05` dual momentum with a 50/50 bond-blend brake.
  - `06–10` — **individual-stock factor strategies** over the S&P 500: `06` cross-sectional 12-1
    momentum (top 50), `07` multifactor momentum × low-volatility (top-40 → lowest-vol 15), `08`
    momentum + 35% bond ballast (lowest drawdown), `09` momentum-leader pullback (short-term reversal
    among long-term winners), `10` broad momentum (top 75). All trend-gated to bonds when the market is
    below its 200-day average.
  - Full-history DCA result: **all 10 beat QQQ or VOO by ≥20%**, all unleveraged, all with lower
    drawdown than buy-and-hold Nasdaq; Sharpe 0.52–0.89 (vs QQQ ≈ 0.55); the bias-free `02–05` beat
    VOO by 25–50% (DAA's drawdown only ~31%).
- **Individual stocks wired into the engine.** `AssetKey` was widened to allow `STK_<SYM>` keys;
  `MarketDataService.loadStocks()` reads `data/stocks/`, builds a per-stock total-return level
  (adjusted close) aligned to the calendar, and registers each as an asset. `StrategyContext` gained
  `stocks()` (the `STK_*` keys with data on the signal day), and `_helpers.ts` gained
  `momentum12_1`, `topStocksByMomentum`, `equalWeight`, `bestDefensive`.
- **Universe expanded 67 → ~500.** `fetch-stocks.mjs` was run for the full current **S&P 500
  constituents** (vs the earlier hand-picked mega-caps), giving real cross-sectional breadth and far
  less cherry-picking. Survivorship bias is *reduced, not eliminated* (today's membership) — flagged
  in each stock strategy's `caveats` and in DATA.md.
- **Engine no-borrow rule documented.** `decide()` weights must sum to ≤ 1; returning a gross weight
  > 1 does **not** create real leverage — the engine floors cash at 0 and silently inflates value
  (a bug). >1x exposure is only legitimate via the leveraged-ETF assets, used solely by `01`.
- **Removed** the interim leveraged lineup (incl. a transient `11-leveraged-stock-momentum.ts` and the
  reliance on synthetic `*2X/*3X` ETFs in `02–10`).
- **Validation.** `npm run test` (backend), `npm run lint`, `npm run build`, and the
  `signal-source --check` guard all pass.

## Follow-ups

- Wire real Email (SES/Resend) + LINE Messaging API in `NotificationsService`; add auth; persist
  signal state + subscriptions.
- **Reduce stock survivorship bias properly**: add point-in-time S&P 500 membership so stock
  strategies only pick from names listed *on each date*; add **fundamentals** (SEC EDGAR / paid) for
  quality/value factors.
- Add transaction costs/slippage (momentum has real turnover); move data to a DB with scheduled refresh.
