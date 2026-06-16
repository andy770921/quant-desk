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
