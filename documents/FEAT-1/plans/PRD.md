# FEAT-1 — US Quant Strategy Platform (QuantDesk) PRD

## 1. Goal

Transform the original Next.js + NestJS boilerplate into a **US-stock quantitative strategy
backtesting platform**, inspired by the [FinLab](https://ai.finlab.tw/strategies) strategy-list
experience but focused on US markets, with **two distinctive backtest baselines** (fixed monthly
dollar-cost averaging vs. a one-time lump sum).

## 2. Requirements → Implementation

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | Pull US market data via a free API and present it clearly | Yahoo Finance chart API (no key) → 32 daily OHLCV series cached as JSON; `/market` page shows quote cards + history charts |
| 2 | 10 backtest strategies, #1 = "3x leveraged Nasdaq + 20-day MA" | `backend/src/strategies/definitions/` — 10 strategies, #1 is the flagship; the other 9 are documented rules-based approaches (see §4) |
| 3 | Backtest from 1990 with two baselines | Engine supports (a) DCA $2,000/mo and (b) lump sum $100,000; benchmarks are monthly/one-time buy of QQQ and VOO respectively |
| 4 | Forward simulation from 2026 with a user-selectable start month + annualized return | Same engine, parameterized; the strategy detail page offers a start-month picker (incl. a "2026 forward" preset) and a monthly amount (default $2,000), showing annualized return vs. QQQ/VOO |
| 5 | At most 3 trades per month | Engine caps discretionary target changes at ≤3 per calendar month; excess deferred |
| 6 | (Future) logged-in users get email / LINE alerts when a strategy trades | `backend/src/notifications/` channel scaffold + the live signal pipeline (§9); real Email/LINE delivery is the next step |

## 3. Data Layer

- **Source:** Yahoo Finance chart API (`query1.finance.yahoo.com/v8/finance/chart/<symbol>`), free, no key, includes adjusted close.
- **Snapshot:** `backend/scripts/fetch-market-data.mjs` fetches 32 series (daily **OHLCV**) into `backend/data/<KEY>.json` + `manifest.json`. Individual stocks: `fetch-stocks.mjs` → `data/stocks/<SYMBOL>/<YEAR>.json` (partitioned by year). Periodic refresh: `refresh-all.mjs` (see `backend/scripts/README.md`).
- **Logical assets:** strategies operate on composed assets (`MarketDataService`): US large cap (S&P 500 TR), Nasdaq-100, small cap (Russell 2000), developed international (EAFE), cash (synth from 13-wk yield), intermediate/long Treasuries (synth from 10y/30y yields), gold, 9 SPDR sectors, and synthetic leveraged ETFs (TQQQ/UPRO/SSO).
- **Leverage:** modeled by holding synthetic leveraged ETFs (`L × index daily return − financing − ~0.9%/yr fee`), so backtests reach 1990 (before TQQQ existed). No margin/borrowing.
- **Benchmark proxies:** QQQ (listed 1999) uses Nasdaq-100; VOO (listed 2010) uses S&P 500 total return before inception.
- **Full data inventory, gaps (fundamentals, intraday) and how to extend:** `development/DATA.md`.

## 4. Strategies

Base (10):

1. **3x Nasdaq × 20-day MA** (flagship) — hold TQQQ when Nasdaq-100 > 20-day MA, else cash.
2. **Dual Momentum (GEM)** — 12-month absolute + relative momentum across US / international / bonds.
3. **200-day SMA trend filter** — hold S&P 500 above the 200-day MA, else intermediate Treasuries.
4. **Leverage for the Long Run (Gayed)** — hold UPRO (3x S&P) above the 200-day MA, else bonds.
5. **Accelerating Dual Momentum** — blended 1/3/6-month momentum across small cap / international, else long Treasuries.
6. **Sector momentum rotation** — top-3 SPDR sectors by 6-month return, equal weight; negative momentum → cash.
7. **Volatility targeting (S&P 500)** — scale equity exposure to a 15% vol target (0–2x via SSO blend).
8. **Defensive Asset Allocation (DAA)** — canary breadth signal switches between an offensive momentum sleeve and defensive bonds.
9. **RSI(2) mean reversion (Connors)** — buy dips above the 200-day MA when RSI(2) is oversold.
10. **All-Weather risk parity** — static stocks/long bonds/intermediate bonds/gold, periodically rebalanced.

Improved variants (9): one `*-plus` variant per strategy 2–10 (strategy 1 untouched), under
`definitions/improved/`. Levers: composite (13612W) momentum, volatility targeting / inverse-vol
risk parity, 200-day crash filters, dual safe-assets (best-trending Treasury), graduated entry.
1990 DCA backtests show most improve Sharpe and/or max drawdown (e.g. GEM Sharpe 0.62→0.75, DD
34%→22%; Leverage-for-the-Long-Run DD 81%→50% via vol-throttled leverage). **19 strategies total.**

Strategy files are independently editable (one `decide(ctx) → Weights` per file) plus a
`signalFormula` string surfaced in the UI. See `development/DATA.md` for the `decide(ctx)` toolbox.

## 5. Backtest Engine (`backtest/engine.ts`)

- **Model:** share-based, long-only, **no borrowing** — tracks actual share counts + a cash balance. Leverage comes only from holding leveraged ETFs (never margin).
- **Modes:** DCA (deposit a fixed amount monthly) and lump sum.
- **Monthly cash:** DCA deposits land in cash on the 1st; the cash is deployed only when the strategy's signal says to be invested (otherwise it waits in cash until the strategy enters).
- **Trade cap:** ≤3 discretionary (signal-driven) rebalances per calendar month; signals use the close (one-bar lag).
- **Outputs:** monthly equity curve (strategy + QQQ + VOO + contributed), drawdown curve, current holdings (shares/price/value/weight) + cash, a per-trade ledger (buy/sell legs with shares + dollars), and notes.

## 6. Metrics & Dynamic Grading

- **Metrics:** final value, total contributed, total/annualized return (XIRR for DCA, CAGR for lump sum), max drawdown, annualized volatility, Sharpe ratio, peak leverage, trade count.
- **Derived (not hardcoded):** `riskLevel` and `leverage` are computed by `StrategiesService` from a canonical full-history backtest (volatility → risk band; peak exposure → leverage multiple).
- **Single source of truth:** all grading thresholds (risk-by-vol, Sharpe/drawdown/vol/return quality bands) live in `shared/src/types/ratings.ts`; the backend classifier, the frontend rating badges, and the `/guide` page all read from it. Structural attributes (category, rebalance cadence, warm-up) remain manually declared.

## 7. API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/market/overview` | Snapshot of major indices, gold, 10y yield |
| GET | `/api/market/series/:symbol` | Monthly close series for charting |
| GET | `/api/strategies` | Strategy list (with derived risk/leverage) |
| GET | `/api/strategies/:id` | Strategy detail (rules, caveats, signal formula) |
| GET | `/api/backtest?strategyId=&mode=&start=&monthly=&lump=` | Run a backtest |
| GET | `/api/signals`, `/api/signals/:id` | Live current target allocation (computed from latest data) |
| POST | `/api/signals/refresh?interval=1d\|1h\|1m` | Pull latest prices, re-evaluate, report signal changes |
| POST | `/api/notifications/subscribe` | [future] subscribe to trade alerts |

## 8. Frontend

- `/` dashboard: hero + market snapshot + strategy grid + the two-baseline explanation.
- `/strategies` list (filterable by category).
- `/strategies/[id]` detail: live current-signal card; backtest controls (mode, start month, amount, quick presets); metric cards with rating badges; equity/drawdown charts; performance comparison; holdings table; trade ledger; signal formula; notes.
- `/market`: index cards + history chart selector.
- `/guide`: glossary of every metric + the grading thresholds (generated from `ratings.ts`).

## 9. Real-time Signals (current capability)

Signals are computed **live** — `SignalsService` runs each strategy's `decide()` at the latest data
index; nothing is precomputed by date. The data layer is refreshable (`MarketDataService.refreshFromLive`)
and an opt-in `SignalScheduler` polls on an interval, detects target-allocation changes, and dispatches
them to `NotificationsService`. Configure cadence (daily / hourly / minute) via env. Full design and
how to enable: `development/realtime-signals.md`.

## 10. Caveats / Disclaimer

- Index-type assets (NDX/RUT/sectors) are price-return mainly; long-run total return is slightly understated.
- Bonds/cash are synthesized from yields (approximations).
- Leverage simulation does not model intraday gaps or financing-spread variation.
- Educational/research use only; past performance does not predict future results — not investment advice.

## 11. Future Work

- User login + strategy subscriptions; a signal scheduler triggering Email (SES/Resend) and LINE
  Messaging API notifications (`NotificationsService` already has the channel abstraction).
- Richer data: individual-stock universe wired into the engine; **fundamentals** (SEC EDGAR / paid APIs); persisted intraday history.
- More realistic costs (commissions, slippage, taxes); move data to a DB with scheduled refresh; persist signal state + subscriptions.
