# FEAT-2 — Strategy Redesign (02–10): Concentrated, Leverage-Aware, QQQ-Beating

## Goal

Rework strategies `02–10` in `backend/src/strategies/definitions/` to satisfy four requirements:

1. **Cap concentration** — at most **10 distinct holdings** per strategy and at most **3 trading
   days per month**, using ETFs and leveraged instruments for diversification (lower the
   psychological burden of tracking dozens of single names).
2. **Better, non-overfit signals** — research robust indicators; the lineup must simulate investing
   **$2,000/month** and, backtested from **1990 or 2010**, **beat dollar-cost-averaging (DCA) into
   QQQ by ≥15%** (a **≥10%** floor is acceptable for the hardest book), with the **highest Sharpe
   possible** and no overfitting.
3. **Fetch more data only if needed** (it wasn't).
4. **Frontend fix** — the "建議持有:" (suggested holdings) line rendered internal keys like
   `STK_AAPL`; it must show the plain US ticker (`AAPL`).

## Baseline (why the old lineup failed the new bar)

The previous `02–10` were unleveraged: `02–05` index asset-allocation, `06–10` were stock-factor
books holding **50/40/30/15/75 names**. Measured as DCA $2,000/mo over full history:

- The **index strategies all LOST to QQQ DCA** (`vsQQQ` ≈ 0.52–0.63) — they only beat VOO. QQQ
  (Nasdaq-100) compounded far above the S&P over these windows, so beating it is the hard part.
- Only the **many-name stock-momentum** books beat QQQ — but they hold far more than 10 names and
  rely on survivorship bias.
- From a **2010 start, essentially nothing unleveraged beats QQQ** — the Nasdaq-100 was the best
  asset of the 2010s. Beating QQQ from 2010 requires leverage or stock selection.

## Research summary (FinLab + literature)

A research agent reviewed FinLab's strategy taxonomy and the supporting literature. The **robust,
low-overfitting archetypes** (durable out-of-sample, few parameters) are:

- **Cross-sectional momentum (12-1)** — rank by trailing 12-month return skipping the last month.
- **Low-volatility / low-beta** — the most academically durable anomaly; smoother equity curve.
- **Time-series momentum / trend-following** — price vs the 200-day MA; the main drawdown lever.
- **Momentum × low-vol composite** — FinLab's recommended core pairing (return × stability).

**Avoid:** heavily parameter-swept multi-factor blends, short-horizon RSI mean-reversion (turnover /
threshold sensitive), and chip/institutional-flow factors (no free US data). Drawdown control should
come from a **trend overlay**, not parameter tuning.

We also leaned on **Michael Gayed's "Leverage for the Long Run"**: a leveraged ETF only works long
term if you *gate it by trend* (hold leverage above the 200-day MA, step aside below) so the
volatility decay of down-trends is avoided.

## Key insight that shaped the design

- **Leveraged ETFs are bias-free and the only credible way to beat QQQ DCA from BOTH 1990 and 2010.**
  Trend-gating + volatility-targeting keeps drawdowns moderate enough that DCA compounding survives.
- **Capping stock books to ≤10 names amplifies survivorship bias.** With 50 names the bias is spread
  out (`vsQQQ` ≈ 1.9); concentrating into the top-10 momentum of *today's* S&P 500 members produces
  fantasy figures (`vsQQQ` ≈ 274). We **rejected** raw top-N momentum and instead tame stock books
  with a low-vol / index / bond / gold overlay so magnitudes stay credible (~1.5–2x) — and we rely
  on the bias-free leveraged strategies for the honest 2010-window claim.

## Final lineup (5 leveraged + 4 stock; each ≤10 holdings, ≤3 trade-days/month)

Leverage is held with cash via synthetic daily-reset leveraged-ETF assets — **never on margin**
(the engine has no borrowing).

| # | id | Style | Leverage | DCA vsQQQ 1990 | DCA vsQQQ 2010 | Sharpe 1990/2010 |
|---|----|-------|----------|---------------:|---------------:|------------------|
| 02 | `vol-target-leveraged-nasdaq` | Vol-targeted leveraged Nasdaq trend (≤2x) | yes | 1.95 | 1.23 | 0.60 / 0.67 |
| 03 | `leveraged-dual-momentum` | Dual-momentum, 2x winner of Nasdaq/S&P | yes | 1.83 | 1.45 | 0.52 / 0.68 |
| 04 | `balanced-leveraged-growth` | 65% 2x Nasdaq + 35% long Treasury | yes | 1.31 | 1.30 | 0.57 / 0.85 |
| 05 | `aggressive-leveraged-nasdaq` | Aggressive vol-targeted leveraged Nasdaq (≤3x) | yes | 7.55 | 2.32 | 0.62 / 0.67 |
| 06 | `leveraged-risk-parity` | Trend-gated HFEA: 3x Nasdaq + gold-hedged 3x LTT | yes | 7.23 | 2.16 | 0.68 / 0.93 |
| 07 | `stock-momentum-lowvol-10` | 80% 2x-Nasdaq core + 20% low-vol momentum stocks | yes (≤2x) | 4.67 | 1.13 | 0.72 / 0.74 |
| 08 | `stock-momentum-gold` | 70% 2x core + 15% stocks + 15% gold hedge | yes (≤2x) | 5.65 | 1.12 | 0.75 / 0.75 |
| 09 | `stock-momentum-index-core` | 85% 2x core + 15% stocks (most index-like) | yes (≤2x) | 4.59 | 1.12 | 0.71 / 0.72 |
| 10 | `stock-momentum-bond-ballast` | 75% 2x core + 15% stocks + 12% Treasury cushion | yes (≤2x) | 6.10 | 1.14 | 0.72 / 0.73 |

- **All nine beat QQQ DCA by ≥15% over full history** (the canonical eval window, ~1990).
- The **bias-free leveraged 02–06 clear ≥15% from a 2010 start**; the **revised 07–10 clear the
  ≥10% bar from 2010 too** (+11–14%) — so every `02–10` beats QQQ in BOTH windows (see the
  "07–10 revision" follow-up below).

Every `02–10` strategy uses a **200-day trend gate** (no leverage below it — rotate to the
best-trending Treasury/gold/cash) and, where relevant, **volatility targeting** (a single-knob,
non-overfit risk control). `01` (3x Nasdaq × 20-MA flagship) is unchanged.

## Code changes

- **`strategies/definitions/_helpers.ts`** — helpers:
  - `lowVolMomentumStocks(ctx, pool, keep)` — momentum×low-vol composite picker.
  - `volTargetExposure(ctx, asset, target, cap, volDays)` — single-knob volatility targeting.
  - `capHoldings(w, maxN)` — safety net guaranteeing ≤ `maxN` positions (renormalized).
  - `leveragedNasdaqCore(ctx, budget, target, cap)` — shared, bias-free leveraged-Nasdaq core
    (vol-targeted, 1x/2x ETF blend, scaled to `budget`); powers the revised `07–10`.
- **`strategies/definitions/02..10-*.ts`** — fully rewritten (file names kept stable; exports and
  ids renamed). `index.ts` updated to import/register the new exports.
- **`backtest/strategy-eval.spec.ts`** — the locked promise updated to the new design: every `02-10`
  beats QQQ DCA by ≥15% (≥10% floor) at a Sharpe ≥ QQQ, holds ≤10 instruments, and ≥5 of the
  leveraged books also beat QQQ from 2010. The old "unleveraged / lower-drawdown-than-Nasdaq"
  assertions were removed because leverage is now an approved lever for `02-06`.
- **Signal-source generator** — re-run (`npm run gen:signals`); `signal-source.generated.ts`
  regenerated so the UI formula matches the code (drift guard still green).

### Frontend `STK_` fix (requirement 4)

- **`market-data/assets.ts`** — new `assetLabel(a)` resolver: logical assets use their Chinese
  label; **individual stocks render as their plain ticker** (`STK_AAPL` → `AAPL`).
- Applied in `signals/signals.service.ts` (the "建議持有" line), `backtest/engine.ts` (trade ledger),
  and `backtest/backtest.service.ts` (holdings table). Verified live:
  `建議持有：WBD 10%、GOOG 10%、GOOGL 10%、CAT 10%…`

## Data

No new fetch was required. The existing universe already covers everything: ~496 S&P 500 stocks in
`data/stocks/`, indices/ETFs/yields, and the synthesized leveraged-ETF + bond assets that backtest
to 1990.

## Verification

- `npm run lint` — 4/4 workspaces pass.
- `npm run build` — 3/3 workspaces pass.
- `cd backend && npx jest` — 3 suites / 8 tests pass (scoreboard, ≤10-holdings, 2010-window,
  signal-source drift guard).

## Caveats / honest limitations

- **Leveraged strategies (02–06)** carry real volatility decay; max drawdowns range ~40% (vol-target
  2x) to ~77% (HFEA 3x in the dot-com era). Disclosed in each strategy's `caveats`.
- **Stock satellites (07–10)** use *today's* S&P 500 membership → **survivorship bias**, but it is now
  confined to the ≤20% stock sleeve; the dominant leveraged index core is bias-free, so the figures
  are credible (they replaced ~50x pure-momentum mirages). See `documents/FEAT-1/development/DATA.md`.
- **2010-window Sharpe (07–10)** ~0.72–0.75 vs QQQ's exceptional 0.85 that decade — the gap is the
  cost of leverage, the same trade-off as `02–06`, and is judged acceptable.

## Follow-up: 07–10 revision (beat QQQ in BOTH windows)

The first FEAT-2 cut shipped `07–10` as **unleveraged** stock-factor books. They beat QQQ over full
history but **lost badly from a 2010 start** (`vsQQQ` ≈ 0.43–0.49) — an equal-weight basket of S&P
names cannot out-compound the cap-weighted, tech-heavy Nasdaq-100 of the 2010s, and the only
unleveraged way to "win" that decade was survivorship-biased concentration (the old strategy 10's
`vsQQQ` ≈ 49 mirage). That violated the refined goal: **beat QQQ DCA by ≥10% in BOTH the 1990 and
2010 windows, without overfitting, at an acceptable Sharpe.**

**Fix — rebuild `07–10` as leveraged-core + stock-satellite books.** A dominant (70–85%)
vol-targeted leveraged-Nasdaq **core** (`leveragedNasdaqCore`, the *same bias-free lever as `02`/`05`*,
held with cash via 1x/2x ETFs, never on margin) drives the return and carries both windows; a ≤20%
low-vol-momentum **satellite** (and gold/bond sleeve) adds an honest, high-Sharpe factor tilt.

- `07` — 80% 2x core + 20% low-vol momentum stocks (8 names; stock-tilted).
- `08` — 70% 2x core + 15% stocks + 15% **gold** hedge (the higher-vol-target core funds the gold drag).
- `09` — 85% 2x core + 15% stocks (most index-like / anchored).
- `10` — 75% 2x core + 15% stocks + 12% intermediate-**Treasury** cushion (replaces the 49x book).

All four switched to **daily cadence** (the engine still enforces ≤3 trade-days/month) so the
vol-target/trend gate stay responsive. Results (DCA $2,000/mo): full-history `vsQQQ` 4.6–6.1, 2010
`vsQQQ` 1.12–1.14 (+12–14%), Sharpe 0.71–0.75 (≫ QQQ 0.55 full history), peak leverage ~1.7–1.9x,
max DD ~42–46%.

**Anti-overfitting discipline:** the three knobs (vol target, leverage cap, core/satellite split)
reuse the proven `02`/`05` settings and round numbers — no per-window parameter mining. Survivorship
bias is moved out of the performance engine into the small stock sleeve. Trade-off accepted: strategy
`10` loses its old "lowest-drawdown" identity (now ~46% DD) because a low-drawdown bond-heavy book is
structurally incompatible with beating QQQ in the 2010s.
