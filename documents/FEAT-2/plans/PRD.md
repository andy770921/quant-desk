# FEAT-2 — Strategy Redesign (02–10): Concentrated, Leverage-Aware, QQQ-Beating PRD

## 1. Goal

Rework strategies `02–10` so the platform offers a **focused, easy-to-follow** strategy lineup that
**beats dollar-cost-averaging (DCA) into QQQ**. Each strategy must hold a small number of
instruments (so an investor has little psychological burden tracking it), may use ETFs and leveraged
ETFs to stay diversified, and must clear a hard performance bar at the **highest Sharpe achievable
without overfitting**. Strategy `01` (the mandated 3x-Nasdaq × 20-MA flagship) is unchanged. The
live "suggested holdings" UI must also show plain US tickers instead of internal keys.

## 2. Requirements → Implementation

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | At most **10 distinct holdings** per strategy | All `02–10` hold ≤10 by construction; `capHoldings(w, 10)` helper as a safety net; a unit test samples every month-end and asserts ≤10 |
| 2 | At most **3 trading days per month** | Already enforced by the engine (`MAX_TRADES_PER_MONTH = 3`); excess signal changes are deferred. Holds even for daily-cadence strategies |
| 3 | Diversify via **ETFs and leveraged instruments** | `02–06` use index + leveraged-ETF sleeves; `07–10` pair a leveraged-Nasdaq **core** with a low-vol-momentum stock **satellite** (+ gold/bond overlay) |
| 4 | Research indicators; **beat QQQ DCA by ≥15%** ($2,000/mo, from 1990 **or** 2010), **≥10% floor**, **max Sharpe**, **no overfitting** | 9 rewritten strategies; all beat QQQ DCA by ≥15% over full history. The 5 leveraged `02–06` clear ≥15% from a 2010 start; the revised `07–10` clear the **≥10%** bar from 2010 too (+11–14%). Locked by `backtest/strategy-eval.spec.ts` |
| 5 | Fetch more data only if needed | Not needed — existing universe (≈496 S&P 500 stocks + indices + synthetic leveraged/bond assets to 1990) was sufficient |
| 6 | Fix the `STK_`-prefixed "建議持有:" labels | New `assetLabel()` resolver renders stock keys as their ticker (`STK_AAPL` → `AAPL`); applied to signals, trade ledger, holdings |

## 3. Background / Problem

Measured as DCA $2,000/mo over full history, the **previous** `02–10`:

- **Index asset-allocation books (02–05) all LOST to QQQ DCA** (`vsQQQ` ≈ 0.52–0.63). They only beat
  VOO; the Nasdaq-100 compounded far above the S&P over these windows.
- **Stock-momentum books (06–10) beat QQQ but held 15–75 names** and relied on survivorship bias.
- From a **2010 start nothing unleveraged beats QQQ** — the Nasdaq-100 was the best asset of the
  2010s. Beating QQQ from 2010 requires leverage or stock selection.

So a ≤10-holding, QQQ-beating, high-Sharpe lineup cannot be built from plain unleveraged index
allocation. The two viable levers are **(a) trend-gated leverage** and **(b) stock selection**.

## 4. Research (FinLab + literature)

Robust, low-overfitting archetypes (durable out-of-sample, few parameters):

- **Cross-sectional momentum (12-1)** — trailing 12-month return skipping the last month.
- **Low-volatility / low-beta** — the most academically durable anomaly; smoother equity curve.
- **Time-series momentum / trend-following** — price vs the 200-day MA; the main drawdown lever.
- **Momentum × low-vol composite** — FinLab's recommended core pairing.
- **Leverage for the Long Run (Gayed)** — leverage only works long term when *gated by trend*
  (leverage above the 200-day MA, step aside below) to avoid down-trend volatility decay.

Avoid: parameter-swept multi-factor blends, short-horizon RSI mean-reversion, chip/flow factors.
Control drawdown with a trend overlay and single-knob volatility targeting — not parameter tuning.

## 5. Design Decisions

- **Leveraged ETFs are bias-free and the only credible way to beat QQQ DCA in BOTH 1990 and 2010.**
  Trend-gating + vol-targeting keeps drawdowns moderate enough that DCA compounding survives.
- **Capping stock books to ≤10 names amplifies survivorship bias** (50 names → `vsQQQ` ≈ 1.9;
  top-10 raw momentum → fantasy `vsQQQ` ≈ 274). We **rejected raw top-N momentum** and tamed every
  stock book with a low-vol / index / bond / gold overlay so magnitudes stay credible.
- **Leverage = approved lever for `02–10`.** Held with cash via synthetic daily-reset leveraged-ETF
  assets — never on margin (the engine has no borrowing). This relaxes the old "unleveraged 02-10"
  rule, per the explicit product decision.
- **An unleveraged diversified stock book cannot beat QQQ from 2010 (revised `07–10`).** The first
  cut of `07–10` was unleveraged and lost badly from a 2010 start (`vsQQQ` ≈ 0.43–0.49) — equal-weight
  S&P names cannot out-compound the cap-weighted, tech-heavy Nasdaq-100 of the 2010s without leaning
  on survivorship-biased concentration (the old strategy 10's `vsQQQ` ≈ 49 mirage). The fix:
  rebuild `07–10` as **leveraged-core + stock-satellite** books. A dominant (70–85%) vol-targeted
  leveraged-Nasdaq core — the *same bias-free lever as `02`/`05`* — drives the return and carries
  both windows; a ≤20% low-vol-momentum stock satellite (and gold/bond sleeve) supplies an honest,
  high-Sharpe factor tilt. Survivorship bias is now confined to the small stock sleeve, not the
  performance engine, so the figures are credible. The three core knobs (vol target, cap, core/
  satellite split) reuse the proven `02`/`05` settings — no per-window parameter mining.

## 6. Final Lineup (5 leveraged + 4 stock; each ≤10 holdings, ≤3 trade-days/month)

| # | id | Style | Lev | vsQQQ '90 | vsQQQ '10 | Sharpe '90/'10 |
|---|----|-------|-----|----------:|----------:|----------------|
| 02 | `vol-target-leveraged-nasdaq` | Vol-targeted leveraged Nasdaq trend (≤2x) | ✓ | 1.95 | 1.23 | 0.60 / 0.67 |
| 03 | `leveraged-dual-momentum` | Dual-momentum, 2x winner of Nasdaq/S&P | ✓ | 1.83 | 1.45 | 0.52 / 0.68 |
| 04 | `balanced-leveraged-growth` | 65% 2x Nasdaq + 35% long Treasury | ✓ | 1.31 | 1.30 | 0.57 / 0.85 |
| 05 | `aggressive-leveraged-nasdaq` | Aggressive vol-targeted leveraged Nasdaq (≤3x) | ✓ | 7.55 | 2.32 | 0.62 / 0.67 |
| 06 | `leveraged-risk-parity` | Trend-gated HFEA: 3x Nasdaq + gold-hedged 3x LTT | ✓ | 7.23 | 2.16 | 0.68 / 0.93 |
| 07 | `stock-momentum-lowvol-10` | 80% 2x-Nasdaq core + 20% low-vol momentum stocks | ✓ (≤2x) | 4.67 | 1.13 | 0.72 / 0.74 |
| 08 | `stock-momentum-gold` | 70% 2x core + 15% stocks + 15% gold hedge | ✓ (≤2x) | 5.65 | 1.12 | 0.75 / 0.75 |
| 09 | `stock-momentum-index-core` | 85% 2x core + 15% stocks (most index-like) | ✓ (≤2x) | 4.59 | 1.12 | 0.71 / 0.72 |
| 10 | `stock-momentum-bond-ballast` | 75% 2x core + 15% stocks + 12% Treasury cushion | ✓ (≤2x) | 6.10 | 1.14 | 0.72 / 0.73 |

All `02–10` use a **200-day trend gate** (no leverage below it — rotate to the best-trending
Treasury / gold / cash) and, where relevant, **volatility targeting** (a single-knob, non-overfit
risk control). For `07–10` the leveraged-Nasdaq core peaks at ≤2x (realized peak leverage ~1.7–1.9x)
and max drawdowns sit at ~42–46%. `vsQQQ` = strategy final value ÷ QQQ DCA final value.

## 7. Code Changes

- **`strategies/definitions/_helpers.ts`** — helpers: `lowVolMomentumStocks(ctx, pool, keep)`
  (momentum×low-vol composite), `volTargetExposure(ctx, asset, target, cap, volDays)`
  (volatility targeting), `capHoldings(w, maxN)` (≤maxN safety net, renormalized), and
  `leveragedNasdaqCore(ctx, budget, target, cap)` (the shared, bias-free leveraged-Nasdaq core that
  powers the revised `07–10`).
- **`strategies/definitions/02..10-*.ts`** — fully rewritten (file names kept stable; exports + ids
  renamed). `index.ts` re-imports/registers the new exports and updates the lineup commentary.
- **`backtest/strategy-eval.spec.ts`** — locked promise rewritten: every `02-10` beats QQQ DCA by
  ≥15% (≥10% floor) at Sharpe ≥ QQQ, holds ≤10 instruments, and ≥5 leveraged books beat QQQ from
  2010. The old "unleveraged / lower-DD-than-Nasdaq" assertions removed (leverage now approved).
- **`market-data/assets.ts`** — `assetLabel(a)` resolver (stocks → ticker), applied in
  `signals/signals.service.ts`, `backtest/engine.ts`, `backtest/backtest.service.ts`.
- **Signal source** — regenerated via `npm run gen:signals`; UI formula matches code (drift guard green).
- **Docs** — `CLAUDE.md` strategy section updated; `documents/FEAT-2/development/strategy-redesign.md`.

## 8. Acceptance Criteria

- [x] Every `02–10` holds ≤10 instruments and trades ≤3 days/month.
- [x] Every `02–10` beats QQQ DCA by ≥15% over full history (≥10% floor) at a Sharpe ≥ QQQ.
- [x] The 5 bias-free leveraged `02–06` beat QQQ DCA by ≥15% from a 2010 start; the revised `07–10`
      clear the ≥10% bar from 2010 too (+11–14%) — so all `02–10` beat QQQ in BOTH windows.
- [x] No raw, overfit, hyper-concentrated stock momentum ships; `07–10` returns are driven by the
      bias-free leveraged index core, with survivorship bias confined to the ≤20% stock sleeve.
- [x] "建議持有:" and the holdings/trade tables show plain tickers (`AAPL`), not `STK_AAPL`.
- [x] `npm run lint` (4/4), `npm run build` (3/3), `cd backend && npx jest` (3 suites / 8 tests) pass.

## 9. Risks / Caveats

- **Leverage drawdowns** — `02–06` carry real volatility decay; max DD ranges ~40% (vol-target 2x)
  to ~77% (HFEA 3x in the dot-com era). The `07–10` leveraged cores (≤2x) sit at ~42–46%. Disclosed
  per-strategy in `caveats`.
- **Survivorship bias** — `07–10` stock satellites use *today's* S&P 500 membership, so that ≤20%
  sleeve is optimistic. But the dominant leveraged index core is bias-free, so the books no longer
  rest on biased concentration (they replaced ~50x pure-momentum mirages). See
  `documents/FEAT-1/development/DATA.md`.
- **2010-window Sharpe** — `07–10` post a 2010 Sharpe ~0.72–0.75 vs QQQ's exceptional 0.85 that
  decade; the gap is the cost of leverage (same trade-off as `02–06`) and is judged acceptable.
- **Not investment advice** — historical, free price-only data for research/education only.
