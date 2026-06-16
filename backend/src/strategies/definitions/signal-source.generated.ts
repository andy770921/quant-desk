/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * The verbatim source of each strategy's decide() (and the helper / indicator
 * functions it calls), surfaced to the UI as the buy/sell signal formula so the
 * displayed math can never drift from the code that runs.
 *
 * Regenerate after editing any decide():
 *   cd backend && node scripts/generate-signal-source.mjs
 *
 * signal-source.spec.ts fails CI if this file is stale.
 */
import type { SignalSource } from '@repo/shared';

export const SIGNAL_SOURCE: Record<string, SignalSource> = {
  "nasdaq-3x-20dma": {
    decide: "decide(ctx: StrategyContext): Weights {\n    const price = ctx.level(ASSET.NASDAQ);\n    const ma = ctx.sma(ASSET.NASDAQ, 20);\n    if (price === undefined || ma === undefined) return {};\n    return price > ma ? { [ASSET.NASDAQ3X]: 1 } : {};\n  }",
    refs: [
      { name: "level", source: "export function level(lv: Levels, i: number, lag = 0): number | undefined {\n  const idx = i - lag;\n  return idx >= 0 ? lv[idx] : undefined;\n}" },
      { name: "sma", source: "export function sma(lv: Levels, i: number, period: number): number | undefined {\n  if (i - period + 1 < 0) return undefined;\n  let sum = 0;\n  for (let k = i - period + 1; k <= i; k++) {\n    const v = lv[k];\n    if (v === undefined) return undefined;\n    sum += v;\n  }\n  return sum / period;\n}" },
    ],
  },
  "dual-momentum-gem": {
    decide: "decide(ctx: StrategyContext): Weights {\n    const best = bestBy(\n      [ASSET.NASDAQ, ASSET.USLC, ASSET.INTL, ASSET.SMALL],\n      (a) => ctx.ret(a, DAYS.YEAR),\n      ASSET.USLC,\n    );\n    const rBest = ctx.ret(best, DAYS.YEAR) ?? -1;\n    const rCash = ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0;\n    return rBest <= rCash ? { [bestDefensive(ctx)]: 1 } : { [best]: 1 };\n  }",
    refs: [
      { name: "bestBy", source: "export function bestBy(\n  assets: AssetKey[],\n  score: (a: AssetKey) => number | undefined,\n  fallback: AssetKey,\n): AssetKey {\n  return rankBy(assets, score)[0]?.asset ?? fallback;\n}" },
      { name: "ret", source: "export function ret(lv: Levels, i: number, period: number): number | undefined {\n  const now = lv[i];\n  const then = lv[i - period];\n  if (now === undefined || then === undefined) return undefined;\n  return now / then - 1;\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
    ],
  },
  "defensive-asset-allocation": {
    decide: "decide(ctx: StrategyContext): Weights {\n    const riskOn =\n      (ctx.score13612W(ASSET.USLC) ?? -1) > 0 && (ctx.score13612W(ASSET.INTL) ?? -1) > 0;\n    if (riskOn) {\n      return {\n        [bestBy([ASSET.NASDAQ, ASSET.USLC, ASSET.SMALL], (a) => ctx.score13612W(a), ASSET.USLC)]: 1,\n      };\n    }\n    return { [bestDefensive(ctx)]: 1 };\n  }",
    refs: [
      { name: "score13612W", source: "export function score13612W(lv: Levels, i: number): number | undefined {\n  const r1 = ret(lv, i, DAYS.MONTH);\n  const r3 = ret(lv, i, DAYS.QUARTER);\n  const r6 = ret(lv, i, DAYS.HALF_YEAR);\n  const r12 = ret(lv, i, DAYS.YEAR);\n  if (r1 === undefined || r3 === undefined || r6 === undefined || r12 === undefined)\n    return undefined;\n  return 12 * r1 + 4 * r3 + 2 * r6 + r12;\n}" },
      { name: "bestBy", source: "export function bestBy(\n  assets: AssetKey[],\n  score: (a: AssetKey) => number | undefined,\n  fallback: AssetKey,\n): AssetKey {\n  return rankBy(assets, score)[0]?.asset ?? fallback;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
    ],
  },
  "nasdaq-trend-bonds": {
    decide: "decide(ctx: StrategyContext): Weights {\n    return trendUp(ctx, ASSET.NASDAQ, 200) ? { [ASSET.NASDAQ]: 1 } : { [bestDefensive(ctx)]: 1 };\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
    ],
  },
  "dual-momentum-bond-blend": {
    decide: "decide(ctx: StrategyContext): Weights {\n    const best = bestBy(\n      [ASSET.NASDAQ, ASSET.USLC, ASSET.SMALL],\n      (a) => ctx.ret(a, DAYS.YEAR),\n      ASSET.USLC,\n    );\n    if ((ctx.ret(best, DAYS.YEAR) ?? -1) <= (ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0)) {\n      return { [bestDefensive(ctx)]: 1 };\n    }\n    return trendUp(ctx, best, 200) ? { [best]: 1 } : { [best]: 0.5, [ASSET.ITT]: 0.5 };\n  }",
    refs: [
      { name: "bestBy", source: "export function bestBy(\n  assets: AssetKey[],\n  score: (a: AssetKey) => number | undefined,\n  fallback: AssetKey,\n): AssetKey {\n  return rankBy(assets, score)[0]?.asset ?? fallback;\n}" },
      { name: "ret", source: "export function ret(lv: Levels, i: number, period: number): number | undefined {\n  const now = lv[i];\n  const then = lv[i - period];\n  if (now === undefined || then === undefined) return undefined;\n  return now / then - 1;\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
    ],
  },
  "stock-momentum-50": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    const top = topStocksByMomentum(ctx, 50);\n    return top.length < 10 ? { [ASSET.NASDAQ]: 1 } : equalWeight(top);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "topStocksByMomentum", source: "export function topStocksByMomentum(ctx: StrategyContext, n: number): AssetKey[] {\n  return rankBy(ctx.stocks(), (a) => momentum12_1(ctx, a))\n    .slice(0, n)\n    .map((x) => x.asset);\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "stock-multifactor-lowvol": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    const ranked = topStocksByMomentum(ctx, 40)\n      .map((s) => ({ s, v: ctx.vol(s, DAYS.HALF_YEAR) }))\n      .filter((x): x is { s: typeof x.s; v: number } => x.v !== undefined)\n      .sort((a, b) => a.v - b.v);\n    const top = ranked.slice(0, 15).map((x) => x.s);\n    return top.length < 8 ? { [ASSET.NASDAQ]: 1 } : equalWeight(top);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "topStocksByMomentum", source: "export function topStocksByMomentum(ctx: StrategyContext, n: number): AssetKey[] {\n  return rankBy(ctx.stocks(), (a) => momentum12_1(ctx, a))\n    .slice(0, n)\n    .map((x) => x.asset);\n}" },
      { name: "vol", source: "export function vol(lv: Levels, i: number, period: number): number | undefined {\n  if (i - period < 0) return undefined;\n  const rets: number[] = [];\n  for (let k = i - period + 1; k <= i; k++) {\n    const a = lv[k];\n    const b = lv[k - 1];\n    if (a === undefined || b === undefined) return undefined;\n    rets.push(Math.log(a / b));\n  }\n  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;\n  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);\n  return Math.sqrt(variance) * Math.sqrt(DAYS.YEAR);\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "stock-momentum-bond-ballast": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    const top = topStocksByMomentum(ctx, 40);\n    if (top.length < 10) return { [ASSET.NASDAQ]: 0.65, [ASSET.ITT]: 0.35 };\n    return { ...equalWeight(top, 0.65), [ASSET.ITT]: 0.35 };\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "topStocksByMomentum", source: "export function topStocksByMomentum(ctx: StrategyContext, n: number): AssetKey[] {\n  return rankBy(ctx.stocks(), (a) => momentum12_1(ctx, a))\n    .slice(0, n)\n    .map((x) => x.asset);\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "momentum-pullback": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    const dipped = topStocksByMomentum(ctx, 100)\n      .map((s) => ({ s, r: ctx.ret(s, DAYS.MONTH) }))\n      .filter((x): x is { s: typeof x.s; r: number } => x.r !== undefined)\n      .sort((a, b) => a.r - b.r)\n      .slice(0, 30)\n      .map((x) => x.s);\n    return dipped.length < 10 ? { [ASSET.NASDAQ]: 1 } : equalWeight(dipped);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "topStocksByMomentum", source: "export function topStocksByMomentum(ctx: StrategyContext, n: number): AssetKey[] {\n  return rankBy(ctx.stocks(), (a) => momentum12_1(ctx, a))\n    .slice(0, n)\n    .map((x) => x.asset);\n}" },
      { name: "ret", source: "export function ret(lv: Levels, i: number, period: number): number | undefined {\n  const now = lv[i];\n  const then = lv[i - period];\n  if (now === undefined || then === undefined) return undefined;\n  return now / then - 1;\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "stock-momentum-broad-75": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    const top = topStocksByMomentum(ctx, 75);\n    return top.length < 10 ? { [ASSET.NASDAQ]: 1 } : equalWeight(top);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "topStocksByMomentum", source: "export function topStocksByMomentum(ctx: StrategyContext, n: number): AssetKey[] {\n  return rankBy(ctx.stocks(), (a) => momentum12_1(ctx, a))\n    .slice(0, n)\n    .map((x) => x.asset);\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
};
