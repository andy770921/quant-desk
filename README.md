# QuantDesk — US Quant Strategy Platform

**QuantDesk** is a US-stock **quantitative strategy platform** for systematic, rules-based investing.
It backtests a curated library of 10 strategies across decades of US market data, compares two
contribution styles — **fixed monthly DCA** vs. a **one-time lump sum** — against QQQ/VOO benchmarks,
and evaluates every strategy's signal live to drive real-time buy/sell alerts.

**Live:**

- App — https://quant-desk-strategy.vercel.app/
- API — https://quant-desk-backend.vercel.app/

> The information provided by QuantDesk does not constitute investment advice. Investing involves
> risk, including the possible loss of principal, and past performance is not a guarantee of future results.

## Features

- **10 strategies, market-beating & honest** — `01` is the mandated leveraged flagship (3x Nasdaq, gated by the QQQ 20-day MA). `02–10` are **unleveraged, skill-based** strategies: `02–05` are survivorship-bias-free **index asset-allocation** (dual momentum / GEM, defensive-canary DAA, Nasdaq trend + bonds, dual-momentum bond-blend) and `06–10` are **individual-stock factor** strategies over the S&P 500 (cross-sectional momentum, multifactor momentum×low-vol, momentum + bond ballast, momentum-leader pullback, broad momentum). One editable file per strategy.
- **The headline promise is a test** — every strategy `02–10` beats dollar-cost-averaging into **QQQ or VOO by ≥20%** over its full history, with a Sharpe ≥ the QQQ benchmark **and a lower max drawdown than buy-and-hold Nasdaq** — all with **no leverage / no borrowing** (the same playing field as the DCA benchmark). This, plus the no-leverage and drawdown bounds, is locked by `backtest/strategy-eval.spec.ts` (the `strategy-eval.ts` harness scores every strategy vs the QQQ/VOO DCA benchmarks and reports Calmar = return ÷ maxDD).
- **Two backtest baselines** — DCA ($2,000/mo) and lump sum ($100,000), each vs. monthly/one-time QQQ & VOO.
- **Share-based, no-borrow engine** — tracks real shares + cash; weights always sum to ≤ 1. The only way to >1x exposure is holding a leveraged ETF (used solely by the flagship `01`); strategies `02–10` stay at ≤ 1x. Produces a concrete dollar/share trade ledger.
- **Dynamic grading** — risk level, leverage, and metric ratings (Sharpe / drawdown / volatility / return) are derived from backtests, not hardcoded; thresholds live in one shared module.
- **Live signals** — each strategy's current target allocation is computed from the latest data; an opt-in scheduler detects changes and dispatches alerts (email/LINE scaffold).
- **Free data** — Yahoo Finance (no key); daily OHLCV for 32 indices/ETFs/yields back to ~1990, **plus the ~500 current S&P 500 constituents** loaded into the engine as `STK_*` assets and used by the stock-selection strategies (`ctx.stocks()`).
- **Stack** — Next.js 15 (App Router) + TanStack Query + recharts; NestJS 11; `@repo/shared` types; Turborepo.

> **Survivorship-bias note:** the stock universe is *today's* S&P 500 membership, so backtests of the
> stock-selection strategies (`06–10`) are **optimistic** — they exclude companies that were dropped or
> went bankrupt. The bias-free claim rests on the index strategies (`02–05`). See
> [`documents/FEAT-1/development/DATA.md`](documents/FEAT-1/development/DATA.md).

## Quick Start

```bash
npm install            # install all workspaces
npm run dev            # FE http://localhost:3001  ·  BE http://localhost:3000 (Swagger at /)
npm run build          # build all
npm run test           # run all tests
npm run lint           # lint all
```

Market data is committed under `backend/data/`, so the app runs offline out of the box. To refresh it:

```bash
cd backend
node scripts/fetch-market-data.mjs          # 32 core index/ETF/yield series (daily OHLCV)
node scripts/fetch-stocks.mjs AAPL MSFT      # individual stocks → data/stocks/<SYMBOL>/<YEAR>.json
node scripts/refresh-all.mjs                 # cron entry point (see backend/scripts/README.md)
```

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard: market snapshot + strategy grid + the two-baseline explainer |
| `/strategies` | Strategy list (filterable by category) |
| `/strategies/[id]` | Live signal + backtest controls + charts + holdings & trade ledger + signal formula |
| `/market` | Index/gold/yield quotes + history charts |
| `/guide` | Glossary of every metric and the grading thresholds |

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/market/overview`, `/api/market/series/:symbol` | Market data |
| GET | `/api/strategies`, `/api/strategies/:id` | Strategy list / detail |
| GET | `/api/backtest?strategyId=&mode=&start=&monthly=&lump=` | Run a backtest |
| GET | `/api/signals`, `/api/signals/:id` | Live current target allocation |
| POST | `/api/signals/refresh?interval=1d\|1h\|1m` | Pull latest prices, re-evaluate, report changes |
| POST | `/api/notifications/subscribe` | [future] subscribe to trade alerts |

The frontend calls the backend through typed TanStack Query hooks (`frontend/src/queries/`); all
types come from `@repo/shared`. In dev, Next.js rewrites `/api/*` → the backend.

## Real-time signals (optional)

Enable the in-app scheduler to poll live data and dispatch alerts on signal changes (off by default):

```bash
# backend/.env
SIGNALS_LIVE=true
SIGNALS_INTERVAL_MS=60000     # 1 min (3600000 = hourly, 86400000 = daily)
SIGNALS_DATA_INTERVAL=1m      # 1d (EOD) | 1h | 1m
```

For the durable daily snapshot, run `backend/scripts/refresh-all.mjs` on cron instead (recommended:
weekdays ~18:30 ET). See [`backend/scripts/README.md`](backend/scripts/README.md).

## Project Structure

```
├── frontend/   # Next.js app (pages, queries, components, charts)
├── backend/    # NestJS app
│   ├── data/   # cached daily OHLCV JSON (generated, committed)
│   ├── scripts/# data fetchers + cron entry point (+ README)
│   └── src/    # market-data · strategies · backtest · signals · notifications
├── shared/     # @repo/shared TypeScript types (incl. ratings thresholds)
├── documents/  # work tracking by ticket (see FEAT-1)
└── CLAUDE.md   # Claude Code instructions
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture & conventions for contributors.
- [`documents/FEAT-1/plans/PRD.md`](documents/FEAT-1/plans/PRD.md) — full requirements & design.
- [`documents/FEAT-1/development/DATA.md`](documents/FEAT-1/development/DATA.md) — data inventory & dictionary (for adding data / strategies).
- [`documents/FEAT-1/development/realtime-signals.md`](documents/FEAT-1/development/realtime-signals.md) — live-signal architecture.

## Claude Code Commands

| Command | Description |
| ------- | ----------- |
| `/write-a-prd [TICKET]` | Create a PRD through systematic discovery |
| `/grill-me [TICKET]` | Stress-test a plan through questioning |
| `/tdd [TICKET]` | Implement with test-driven development |
| `/triage-issue [TICKET]` | Investigate bugs and create fix plans |
| `/improve-codebase-architecture [TICKET]` | Find architectural improvements |
| `/deploy-vercel [TICKET]` | Deploy to Vercel with step-by-step guidance |

## License

MIT
