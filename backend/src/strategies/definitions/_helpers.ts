import { ASSET, AssetKey } from '../../market-data/assets';
import { StrategyContext, Weights } from '../strategy.types';

/** Rank assets by a scoring function (descending), skipping undefined scores. */
export function rankBy(
  assets: AssetKey[],
  score: (a: AssetKey) => number | undefined,
): { asset: AssetKey; score: number }[] {
  return assets
    .map((asset) => ({ asset, score: score(asset) }))
    .filter((x): x is { asset: AssetKey; score: number } => x.score !== undefined)
    .sort((a, b) => b.score - a.score);
}

/** Best asset among `assets` by a score (e.g. trending safe asset). */
export function bestBy(
  assets: AssetKey[],
  score: (a: AssetKey) => number | undefined,
  fallback: AssetKey,
): AssetKey {
  return rankBy(assets, score)[0]?.asset ?? fallback;
}

/**
 * Inverse-volatility weights over the top-k assets by `score`, normalized to
 * `budget` (default 1.0). Used by the risk-parity / DAA strategies.
 */
export function inverseVolWeights(
  ctx: StrategyContext,
  assets: AssetKey[],
  k: number,
  volDays: number,
  budget = 1,
): Weights {
  const ranked = rankBy(assets, (a) => ctx.score13612W(a)).slice(0, k);
  const raw = ranked.map(({ asset }) => {
    const v = ctx.vol(asset, volDays);
    return { asset, inv: v && v > 0 ? 1 / v : 0 };
  });
  const total = raw.reduce((s, r) => s + r.inv, 0);
  const weights: Weights = {};
  if (total === 0) {
    // Fall back to equal weight if vol unavailable.
    for (const { asset } of ranked) weights[asset] = budget / Math.max(1, ranked.length);
    return weights;
  }
  for (const r of raw) if (r.inv > 0) weights[r.asset] = (r.inv / total) * budget;
  return weights;
}

/** Clamp helper. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Uptrend filter: true when the asset's level is above its `period`-day SMA. */
export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {
  const p = ctx.level(asset);
  const ma = ctx.sma(asset, period);
  return p !== undefined && ma !== undefined && p > ma;
}

/**
 * Scale every weight by `k`. Used to de-leverage in high volatility. Keep
 * `k ≤ 1` so the gross weight stays ≤ 1 (the engine has no borrowing; gross > 1
 * is not real leverage — leverage comes only from the leveraged-ETF assets).
 */
export function scaleWeights(w: Weights, k: number): Weights {
  const out: Weights = {};
  for (const a of Object.keys(w) as AssetKey[]) out[a] = Number(((w[a] ?? 0) * k).toFixed(4));
  return out;
}

/** Equal-weight a set of assets to `budget` (default 1, i.e. fully invested). */
export function equalWeight(assets: AssetKey[], budget = 1): Weights {
  const w: Weights = {};
  if (assets.length === 0) return w;
  for (const a of assets) w[a] = budget / assets.length;
  return w;
}

/** Sum any number of weight maps into one (overlapping assets accumulate). */
export function addW(...weights: Weights[]): Weights {
  const out: Weights = {};
  for (const w of weights) {
    for (const a of Object.keys(w) as AssetKey[]) out[a] = (out[a] ?? 0) + (w[a] ?? 0);
  }
  return out;
}

/**
 * Plain inverse-volatility (risk-parity) weights over `assets`, normalized to
 * `budget` (default 1) using trailing realized vol over `volDays`. Each asset's
 * weight is proportional to 1/σ so every sleeve contributes roughly equal risk.
 * Falls back to equal weight if no volatility is available. (Distinct from
 * `inverseVolWeights`, which first ranks/slices by 13612W momentum.)
 */
export function invVol(
  ctx: StrategyContext,
  assets: AssetKey[],
  volDays: number,
  budget = 1,
): Weights {
  const raw = assets.map((asset) => {
    const v = ctx.vol(asset, volDays);
    return { asset, inv: v && v > 0 ? 1 / v : 0 };
  });
  const total = raw.reduce((s, r) => s + r.inv, 0);
  const w: Weights = {};
  if (total === 0) {
    for (const a of assets) w[a] = budget / Math.max(1, assets.length);
    return w;
  }
  for (const r of raw) if (r.inv > 0) w[r.asset] = Number(((r.inv / total) * budget).toFixed(4));
  return w;
}

/**
 * Graduated trend exposure in [0, 1]: the fraction of the moving-average windows
 * the asset's price currently sits above. Replaces a binary 0%/100% trend gate
 * with a stepwise one (default 5 windows ⇒ 20% steps) so no single day flips the
 * whole book in or out — the realism lever behind "Leverage for the Long Run".
 */
export function trendExposure(
  ctx: StrategyContext,
  asset: AssetKey,
  windows: number[] = [50, 100, 150, 200, 250],
): number {
  let up = 0;
  let n = 0;
  const p = ctx.level(asset);
  for (const w of windows) {
    const ma = ctx.sma(asset, w);
    if (p !== undefined && ma !== undefined) {
      n++;
      if (p > ma) up++;
    }
  }
  return n ? up / n : 0;
}

/**
 * Vol-targeted leveraged equity sleeve scaled to `budget`, expressed as a
 * 1x/2x(/3x) ETF blend (held with cash, never on margin). Generalizes
 * `leveragedNasdaqCore` to any index family (Nasdaq or S&P): exposure =
 * target ÷ recent realized vol, capped, then scaled to the caller's budget. The
 * caller owns any trend gate. Reuses the shared `target`/`cap` lever so the
 * S-series books avoid per-strategy parameter mining.
 */
export function leveragedEquity(
  ctx: StrategyContext,
  oneX: AssetKey,
  twoX: AssetKey | undefined,
  threeX: AssetKey | undefined,
  budget: number,
  target = 0.3,
  cap = 2,
): Weights {
  const exposure = volTargetExposure(ctx, oneX, target, cap);
  return scaleWeights(equityExposureWeights(exposure, oneX, twoX, threeX), budget);
}

/**
 * 12-1 price momentum: trailing 12-month return skipping the most recent month
 * (level 1m ago ÷ level 12m ago − 1). Skipping the last month is the classic
 * Jegadeesh-Titman formation window that avoids short-term reversal noise.
 */
export function momentum12_1(ctx: StrategyContext, a: AssetKey): number | undefined {
  const recent = ctx.level(a, 21);
  const old = ctx.level(a, 252);
  return recent !== undefined && old !== undefined && old > 0 ? recent / old - 1 : undefined;
}

/** Best-trending defensive sleeve (intermediate/long Treasuries, gold, or cash). */
export function bestDefensive(ctx: StrategyContext): AssetKey {
  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);
}

/** The `n` individual stocks with the highest 12-1 momentum on the signal day. */
export function topStocksByMomentum(ctx: StrategyContext, n: number): AssetKey[] {
  return rankBy(ctx.stocks(), (a) => momentum12_1(ctx, a))
    .slice(0, n)
    .map((x) => x.asset);
}

/**
 * Momentum × low-volatility composite (FinLab's recommended core pairing):
 * take the `pool` strongest 12-1 momentum names, then keep the `keep` with the
 * LOWEST trailing 6-month realized volatility. Combining the momentum and
 * low-volatility anomalies tames single-name risk and lifts risk-adjusted return.
 */
export function lowVolMomentumStocks(ctx: StrategyContext, pool: number, keep: number): AssetKey[] {
  return topStocksByMomentum(ctx, pool)
    .map((s) => ({ s, v: ctx.vol(s, 126) }))
    .filter((x): x is { s: AssetKey; v: number } => x.v !== undefined)
    .sort((a, b) => a.v - b.v)
    .slice(0, keep)
    .map((x) => x.s);
}

/**
 * Volatility-targeted equity exposure: scale exposure so that
 * exposure × recent volatility ≈ `target` annualized vol, clamped to [0, cap].
 * A robust, single-knob risk control (no parameter sweeping) that keeps a
 * leveraged sleeve from over-gearing in turbulent markets.
 */
export function volTargetExposure(
  ctx: StrategyContext,
  asset: AssetKey,
  target: number,
  cap: number,
  volDays = 63,
): number {
  const v = ctx.vol(asset, volDays) ?? 0.25;
  return clamp(target / Math.max(v, 0.06), 0, cap);
}

/**
 * Trend-gated, vol-targeted leveraged Nasdaq core, scaled to `budget`. Reuses the
 * EXACT non-overfit lever proven by strategies 02/05 — exposure = target ÷ recent
 * realized vol, capped, expressed as a 1x/2x Nasdaq-ETF blend (held with cash,
 * never on margin). The caller owns the 200-day trend gate. This lets the
 * otherwise-unleveraged stock books (07-09) earn a credible 2010-window edge from
 * the same principled index lever instead of leaning on survivorship-biased
 * single-name concentration. `target`/`cap` are shared across the three books
 * (only the core/satellite split differs) to avoid per-strategy parameter mining.
 */
export function leveragedNasdaqCore(
  ctx: StrategyContext,
  budget: number,
  target = 0.3,
  cap = 2,
): Weights {
  const exposure = volTargetExposure(ctx, ASSET.NASDAQ, target, cap);
  return scaleWeights(equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X), budget);
}

/**
 * Safety net: keep only the `maxN` largest-weight holdings and renormalize to
 * the original gross. Guarantees a strategy never returns more than `maxN`
 * distinct positions (the platform caps every strategy at 10 to keep the book
 * easy to follow). Most strategies are already ≤ maxN by construction; this
 * makes the bound explicit and defensive.
 */
export function capHoldings(w: Weights, maxN: number): Weights {
  const entries = (Object.entries(w) as [AssetKey, number][]).filter(([, x]) => (x ?? 0) > 0);
  if (entries.length <= maxN) return w;
  entries.sort((a, b) => b[1] - a[1]);
  const kept = entries.slice(0, maxN);
  const grossAll = entries.reduce((s, [, x]) => s + x, 0);
  const grossKept = kept.reduce((s, [, x]) => s + x, 0);
  const scale = grossKept > 0 ? grossAll / grossKept : 1;
  const out: Weights = {};
  for (const [a, x] of kept) out[a] = Number((x * scale).toFixed(4));
  return out;
}

/**
 * Express a target equity *exposure* E (in "x" of the index) as long-only,
 * no-borrow weights by blending a 1x index with a leveraged ETF — exactly how a
 * retail investor gets >1x without margin (buy TQQQ/UPRO/SSO):
 *   E ≤ 1            → E in 1x, rest cash
 *   1 < E ≤ 2 (2x)   → (E−1) in 2x ETF + (2−E) in 1x   (fully invested, exposure E)
 *   2 < E ≤ 3 (3x)   → (E−1)/2 in 3x ETF + (3−E)/2 in 1x
 */
export function equityExposureWeights(
  E: number,
  oneX: AssetKey,
  twoX?: AssetKey,
  threeX?: AssetKey,
): Weights {
  const maxE = threeX ? 3 : twoX ? 2 : 1;
  const e = clamp(E, 0, maxE);
  if (e <= 1) return e > 0 ? { [oneX]: Number(e.toFixed(4)) } : {};
  if (e <= 2 && twoX) {
    const x = e - 1;
    return { [twoX]: Number(x.toFixed(4)), [oneX]: Number((1 - x).toFixed(4)) };
  }
  if (threeX) {
    const x = (e - 1) / 2;
    return { [threeX]: Number(x.toFixed(4)), [oneX]: Number((1 - x).toFixed(4)) };
  }
  return { [oneX]: 1 };
}
