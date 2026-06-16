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
  "vol-target-leveraged-nasdaq": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };\n    const exposure = volTargetExposure(ctx, ASSET.NASDAQ, 0.3, 2, DAYS.QUARTER);\n    return equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "volTargetExposure", source: "export function volTargetExposure(\n  ctx: StrategyContext,\n  asset: AssetKey,\n  target: number,\n  cap: number,\n  volDays = 63,\n): number {\n  const v = ctx.vol(asset, volDays) ?? 0.25;\n  return clamp(target / Math.max(v, 0.06), 0, cap);\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "equityExposureWeights", source: "export function equityExposureWeights(\n  E: number,\n  oneX: AssetKey,\n  twoX?: AssetKey,\n  threeX?: AssetKey,\n): Weights {\n  const maxE = threeX ? 3 : twoX ? 2 : 1;\n  const e = clamp(E, 0, maxE);\n  if (e <= 1) return e > 0 ? { [oneX]: Number(e.toFixed(4)) } : {};\n  if (e <= 2 && twoX) {\n    const x = e - 1;\n    return { [twoX]: Number(x.toFixed(4)), [oneX]: Number((1 - x).toFixed(4)) };\n  }\n  if (threeX) {\n    const x = (e - 1) / 2;\n    return { [threeX]: Number(x.toFixed(4)), [oneX]: Number((1 - x).toFixed(4)) };\n  }\n  return { [oneX]: 1 };\n}" },
    ],
  },
  "leveraged-dual-momentum": {
    decide: "decide(ctx: StrategyContext): Weights {\n    const best = bestBy([ASSET.NASDAQ, ASSET.USLC], (a) => ctx.ret(a, DAYS.YEAR), ASSET.USLC);\n    const beatsCash = (ctx.ret(best, DAYS.YEAR) ?? -1) > (ctx.ret(ASSET.CASH, DAYS.YEAR) ?? 0);\n    if (!beatsCash || !trendUp(ctx, best, 200)) return { [bestDefensive(ctx)]: 1 };\n    return { [best === ASSET.NASDAQ ? ASSET.NASDAQ2X : ASSET.USLC2X]: 1 };\n  }",
    refs: [
      { name: "bestBy", source: "export function bestBy(\n  assets: AssetKey[],\n  score: (a: AssetKey) => number | undefined,\n  fallback: AssetKey,\n): AssetKey {\n  return rankBy(assets, score)[0]?.asset ?? fallback;\n}" },
      { name: "ret", source: "export function ret(lv: Levels, i: number, period: number): number | undefined {\n  const now = lv[i];\n  const then = lv[i - period];\n  if (now === undefined || then === undefined) return undefined;\n  return now / then - 1;\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
    ],
  },
  "balanced-leveraged-growth": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };\n    return { [ASSET.NASDAQ2X]: 0.65, [ASSET.LTT]: 0.35 };\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
    ],
  },
  "aggressive-leveraged-nasdaq": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };\n    const exposure = volTargetExposure(ctx, ASSET.NASDAQ, 0.45, 3, DAYS.QUARTER);\n    return equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X, ASSET.NASDAQ3X);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "volTargetExposure", source: "export function volTargetExposure(\n  ctx: StrategyContext,\n  asset: AssetKey,\n  target: number,\n  cap: number,\n  volDays = 63,\n): number {\n  const v = ctx.vol(asset, volDays) ?? 0.25;\n  return clamp(target / Math.max(v, 0.06), 0, cap);\n}" },
      { name: "DAYS", source: "export const DAYS = {\n  WEEK: 5,\n  MONTH: 21,\n  QUARTER: 63,\n  HALF_YEAR: 126,\n  YEAR: 252,\n};" },
      { name: "equityExposureWeights", source: "export function equityExposureWeights(\n  E: number,\n  oneX: AssetKey,\n  twoX?: AssetKey,\n  threeX?: AssetKey,\n): Weights {\n  const maxE = threeX ? 3 : twoX ? 2 : 1;\n  const e = clamp(E, 0, maxE);\n  if (e <= 1) return e > 0 ? { [oneX]: Number(e.toFixed(4)) } : {};\n  if (e <= 2 && twoX) {\n    const x = e - 1;\n    return { [twoX]: Number(x.toFixed(4)), [oneX]: Number((1 - x).toFixed(4)) };\n  }\n  if (threeX) {\n    const x = (e - 1) / 2;\n    return { [threeX]: Number(x.toFixed(4)), [oneX]: Number((1 - x).toFixed(4)) };\n  }\n  return { [oneX]: 1 };\n}" },
    ],
  },
  "leveraged-risk-parity": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.NASDAQ, 200)) return { [bestDefensive(ctx)]: 1 };\n    const bond = trendUp(ctx, ASSET.LTT, 100) ? ASSET.LTT3X : ASSET.GOLD;\n    return { [ASSET.NASDAQ3X]: 0.55, [bond]: 0.45 };\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
    ],
  },
  "stock-momentum-lowvol-10": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    // Core (80%): vol-targeted leveraged Nasdaq (the 02/05 lever) — a bias-free\n    // index engine that carries BOTH the 1990 and 2010 windows. Satellite (20%):\n    // 8 low-vol momentum names for an honest, high-Sharpe factor tilt. The core\n    // does the heavy lifting so the book never leans on survivorship-biased\n    // single-name concentration to beat QQQ.\n    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 8);\n    if (top.length < 5) return leveragedNasdaqCore(ctx, 1);\n    return capHoldings({ ...equalWeight(top, 0.2), ...leveragedNasdaqCore(ctx, 0.8) }, 10);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "vol", source: "export function vol(lv: Levels, i: number, period: number): number | undefined {\n  if (i - period < 0) return undefined;\n  const rets: number[] = [];\n  for (let k = i - period + 1; k <= i; k++) {\n    const a = lv[k];\n    const b = lv[k - 1];\n    if (a === undefined || b === undefined) return undefined;\n    rets.push(Math.log(a / b));\n  }\n  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;\n  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);\n  return Math.sqrt(variance) * Math.sqrt(DAYS.YEAR);\n}" },
      { name: "lowVolMomentumStocks", source: "export function lowVolMomentumStocks(ctx: StrategyContext, pool: number, keep: number): AssetKey[] {\n  return topStocksByMomentum(ctx, pool)\n    .map((s) => ({ s, v: ctx.vol(s, 126) }))\n    .filter((x): x is { s: AssetKey; v: number } => x.v !== undefined)\n    .sort((a, b) => a.v - b.v)\n    .slice(0, keep)\n    .map((x) => x.s);\n}" },
      { name: "leveragedNasdaqCore", source: "export function leveragedNasdaqCore(\n  ctx: StrategyContext,\n  budget: number,\n  target = 0.3,\n  cap = 2,\n): Weights {\n  const exposure = volTargetExposure(ctx, ASSET.NASDAQ, target, cap);\n  return scaleWeights(equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X), budget);\n}" },
      { name: "capHoldings", source: "export function capHoldings(w: Weights, maxN: number): Weights {\n  const entries = (Object.entries(w) as [AssetKey, number][]).filter(([, x]) => (x ?? 0) > 0);\n  if (entries.length <= maxN) return w;\n  entries.sort((a, b) => b[1] - a[1]);\n  const kept = entries.slice(0, maxN);\n  const grossAll = entries.reduce((s, [, x]) => s + x, 0);\n  const grossKept = kept.reduce((s, [, x]) => s + x, 0);\n  const scale = grossKept > 0 ? grossAll / grossKept : 1;\n  const out: Weights = {};\n  for (const [a, x] of kept) out[a] = Number((x * scale).toFixed(4));\n  return out;\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "stock-momentum-gold": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    // The diversified book: a vol-targeted leveraged Nasdaq core (40% target vol,\n    // 2x cap — geared near-fully in uptrends) FUNDS a permanent 15% gold hedge.\n    // The core overcomes gold's structural drag so the book still beats QQQ in\n    // BOTH the 1990 and 2010 windows, while the permanent gold sleeve genuinely\n    // diversifies (low correlation to stocks/bonds, a real tail/inflation hedge).\n    // 70% core + 15% low-vol momentum stocks + 15% gold.\n    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 5);\n    if (top.length < 5) {\n      return capHoldings({ ...leveragedNasdaqCore(ctx, 0.85, 0.4, 2), [ASSET.GOLD]: 0.15 }, 10);\n    }\n    return capHoldings(\n      { ...equalWeight(top, 0.15), [ASSET.GOLD]: 0.15, ...leveragedNasdaqCore(ctx, 0.7, 0.4, 2) },\n      10,\n    );\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "vol", source: "export function vol(lv: Levels, i: number, period: number): number | undefined {\n  if (i - period < 0) return undefined;\n  const rets: number[] = [];\n  for (let k = i - period + 1; k <= i; k++) {\n    const a = lv[k];\n    const b = lv[k - 1];\n    if (a === undefined || b === undefined) return undefined;\n    rets.push(Math.log(a / b));\n  }\n  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;\n  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);\n  return Math.sqrt(variance) * Math.sqrt(DAYS.YEAR);\n}" },
      { name: "lowVolMomentumStocks", source: "export function lowVolMomentumStocks(ctx: StrategyContext, pool: number, keep: number): AssetKey[] {\n  return topStocksByMomentum(ctx, pool)\n    .map((s) => ({ s, v: ctx.vol(s, 126) }))\n    .filter((x): x is { s: AssetKey; v: number } => x.v !== undefined)\n    .sort((a, b) => a.v - b.v)\n    .slice(0, keep)\n    .map((x) => x.s);\n}" },
      { name: "capHoldings", source: "export function capHoldings(w: Weights, maxN: number): Weights {\n  const entries = (Object.entries(w) as [AssetKey, number][]).filter(([, x]) => (x ?? 0) > 0);\n  if (entries.length <= maxN) return w;\n  entries.sort((a, b) => b[1] - a[1]);\n  const kept = entries.slice(0, maxN);\n  const grossAll = entries.reduce((s, [, x]) => s + x, 0);\n  const grossKept = kept.reduce((s, [, x]) => s + x, 0);\n  const scale = grossKept > 0 ? grossAll / grossKept : 1;\n  const out: Weights = {};\n  for (const [a, x] of kept) out[a] = Number((x * scale).toFixed(4));\n  return out;\n}" },
      { name: "leveragedNasdaqCore", source: "export function leveragedNasdaqCore(\n  ctx: StrategyContext,\n  budget: number,\n  target = 0.3,\n  cap = 2,\n): Weights {\n  const exposure = volTargetExposure(ctx, ASSET.NASDAQ, target, cap);\n  return scaleWeights(equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X), budget);\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "stock-momentum-index-core": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    // Index-anchored core/satellite: 85% vol-targeted leveraged Nasdaq core\n    // anchors the book to the broad market (the bias-free engine that wins both\n    // the 1990 and 2010 windows); 15% low-vol momentum stock satellite (6 names)\n    // supplies a modest selection tilt without survivorship-biased concentration.\n    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 6);\n    if (top.length < 5) return leveragedNasdaqCore(ctx, 1);\n    return capHoldings({ ...equalWeight(top, 0.15), ...leveragedNasdaqCore(ctx, 0.85) }, 10);\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "vol", source: "export function vol(lv: Levels, i: number, period: number): number | undefined {\n  if (i - period < 0) return undefined;\n  const rets: number[] = [];\n  for (let k = i - period + 1; k <= i; k++) {\n    const a = lv[k];\n    const b = lv[k - 1];\n    if (a === undefined || b === undefined) return undefined;\n    rets.push(Math.log(a / b));\n  }\n  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;\n  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);\n  return Math.sqrt(variance) * Math.sqrt(DAYS.YEAR);\n}" },
      { name: "lowVolMomentumStocks", source: "export function lowVolMomentumStocks(ctx: StrategyContext, pool: number, keep: number): AssetKey[] {\n  return topStocksByMomentum(ctx, pool)\n    .map((s) => ({ s, v: ctx.vol(s, 126) }))\n    .filter((x): x is { s: AssetKey; v: number } => x.v !== undefined)\n    .sort((a, b) => a.v - b.v)\n    .slice(0, keep)\n    .map((x) => x.s);\n}" },
      { name: "leveragedNasdaqCore", source: "export function leveragedNasdaqCore(\n  ctx: StrategyContext,\n  budget: number,\n  target = 0.3,\n  cap = 2,\n): Weights {\n  const exposure = volTargetExposure(ctx, ASSET.NASDAQ, target, cap);\n  return scaleWeights(equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X), budget);\n}" },
      { name: "capHoldings", source: "export function capHoldings(w: Weights, maxN: number): Weights {\n  const entries = (Object.entries(w) as [AssetKey, number][]).filter(([, x]) => (x ?? 0) > 0);\n  if (entries.length <= maxN) return w;\n  entries.sort((a, b) => b[1] - a[1]);\n  const kept = entries.slice(0, maxN);\n  const grossAll = entries.reduce((s, [, x]) => s + x, 0);\n  const grossKept = kept.reduce((s, [, x]) => s + x, 0);\n  const scale = grossKept > 0 ? grossAll / grossKept : 1;\n  const out: Weights = {};\n  for (const [a, x] of kept) out[a] = Number((x * scale).toFixed(4));\n  return out;\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
  "stock-momentum-bond-ballast": {
    decide: "decide(ctx: StrategyContext): Weights {\n    if (!trendUp(ctx, ASSET.USLC, 200)) return { [bestDefensive(ctx)]: 1 };\n    // 75% vol-targeted leveraged Nasdaq core (2x cap, the bias-free engine that\n    // wins BOTH windows) + 15% low-vol momentum stocks + a 12% intermediate-\n    // Treasury cushion. The credible successor to the old pure-momentum top-8 book:\n    // performance now comes from the index core, not survivorship-biased single-\n    // name concentration, so the bond sleeve still cushions without a 49x mirage.\n    const top: AssetKey[] = lowVolMomentumStocks(ctx, 30, 6);\n    if (top.length < 5) {\n      return capHoldings({ ...leveragedNasdaqCore(ctx, 0.88, 0.45, 2), [ASSET.ITT]: 0.12 }, 10);\n    }\n    return capHoldings(\n      { ...equalWeight(top, 0.13), [ASSET.ITT]: 0.12, ...leveragedNasdaqCore(ctx, 0.75, 0.45, 2) },\n      10,\n    );\n  }",
    refs: [
      { name: "trendUp", source: "export function trendUp(ctx: StrategyContext, asset: AssetKey, period = 200): boolean {\n  const p = ctx.level(asset);\n  const ma = ctx.sma(asset, period);\n  return p !== undefined && ma !== undefined && p > ma;\n}" },
      { name: "bestDefensive", source: "export function bestDefensive(ctx: StrategyContext): AssetKey {\n  return bestBy([ASSET.ITT, ASSET.LTT, ASSET.GOLD, ASSET.CASH], (a) => ctx.ret(a, 126), ASSET.CASH);\n}" },
      { name: "vol", source: "export function vol(lv: Levels, i: number, period: number): number | undefined {\n  if (i - period < 0) return undefined;\n  const rets: number[] = [];\n  for (let k = i - period + 1; k <= i; k++) {\n    const a = lv[k];\n    const b = lv[k - 1];\n    if (a === undefined || b === undefined) return undefined;\n    rets.push(Math.log(a / b));\n  }\n  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;\n  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);\n  return Math.sqrt(variance) * Math.sqrt(DAYS.YEAR);\n}" },
      { name: "lowVolMomentumStocks", source: "export function lowVolMomentumStocks(ctx: StrategyContext, pool: number, keep: number): AssetKey[] {\n  return topStocksByMomentum(ctx, pool)\n    .map((s) => ({ s, v: ctx.vol(s, 126) }))\n    .filter((x): x is { s: AssetKey; v: number } => x.v !== undefined)\n    .sort((a, b) => a.v - b.v)\n    .slice(0, keep)\n    .map((x) => x.s);\n}" },
      { name: "capHoldings", source: "export function capHoldings(w: Weights, maxN: number): Weights {\n  const entries = (Object.entries(w) as [AssetKey, number][]).filter(([, x]) => (x ?? 0) > 0);\n  if (entries.length <= maxN) return w;\n  entries.sort((a, b) => b[1] - a[1]);\n  const kept = entries.slice(0, maxN);\n  const grossAll = entries.reduce((s, [, x]) => s + x, 0);\n  const grossKept = kept.reduce((s, [, x]) => s + x, 0);\n  const scale = grossKept > 0 ? grossAll / grossKept : 1;\n  const out: Weights = {};\n  for (const [a, x] of kept) out[a] = Number((x * scale).toFixed(4));\n  return out;\n}" },
      { name: "leveragedNasdaqCore", source: "export function leveragedNasdaqCore(\n  ctx: StrategyContext,\n  budget: number,\n  target = 0.3,\n  cap = 2,\n): Weights {\n  const exposure = volTargetExposure(ctx, ASSET.NASDAQ, target, cap);\n  return scaleWeights(equityExposureWeights(exposure, ASSET.NASDAQ, ASSET.NASDAQ2X), budget);\n}" },
      { name: "equalWeight", source: "export function equalWeight(assets: AssetKey[], budget = 1): Weights {\n  const w: Weights = {};\n  if (assets.length === 0) return w;\n  for (const a of assets) w[a] = budget / assets.length;\n  return w;\n}" },
    ],
  },
};
