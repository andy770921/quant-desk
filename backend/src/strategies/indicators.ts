/**
 * Pure technical indicators computed over a daily level array aligned to the
 * trading calendar. Each takes the array plus the index `i` of the signal day.
 * They return `undefined` when there is not enough (non-missing) history.
 */

export type Levels = (number | undefined)[];

/** Trading days per common lookback window. */
export const DAYS = {
  WEEK: 5,
  MONTH: 21,
  QUARTER: 63,
  HALF_YEAR: 126,
  YEAR: 252,
};

export function level(lv: Levels, i: number, lag = 0): number | undefined {
  const idx = i - lag;
  return idx >= 0 ? lv[idx] : undefined;
}

/** Simple moving average of the level over `period` days ending at i. */
export function sma(lv: Levels, i: number, period: number): number | undefined {
  if (i - period + 1 < 0) return undefined;
  let sum = 0;
  for (let k = i - period + 1; k <= i; k++) {
    const v = lv[k];
    if (v === undefined) return undefined;
    sum += v;
  }
  return sum / period;
}

/** Total return over the trailing `period` days. */
export function ret(lv: Levels, i: number, period: number): number | undefined {
  const now = lv[i];
  const then = lv[i - period];
  if (now === undefined || then === undefined) return undefined;
  return now / then - 1;
}

/** Cutler's RSI (simple-average variant) of the level over `period` days. */
export function rsi(lv: Levels, i: number, period: number): number | undefined {
  if (i - period < 0) return undefined;
  let gain = 0;
  let loss = 0;
  for (let k = i - period + 1; k <= i; k++) {
    const a = lv[k];
    const b = lv[k - 1];
    if (a === undefined || b === undefined) return undefined;
    const ch = a - b;
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = gain / period / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Annualized realized volatility of daily log returns over `period` days. */
export function vol(lv: Levels, i: number, period: number): number | undefined {
  if (i - period < 0) return undefined;
  const rets: number[] = [];
  for (let k = i - period + 1; k <= i; k++) {
    const a = lv[k];
    const b = lv[k - 1];
    if (a === undefined || b === undefined) return undefined;
    rets.push(Math.log(a / b));
  }
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(DAYS.YEAR);
}

/**
 * "13612W" momentum score (Keller): 12·r1m + 4·r3m + 2·r6m + 1·r12m.
 * Returns undefined if any component is unavailable.
 */
export function score13612W(lv: Levels, i: number): number | undefined {
  const r1 = ret(lv, i, DAYS.MONTH);
  const r3 = ret(lv, i, DAYS.QUARTER);
  const r6 = ret(lv, i, DAYS.HALF_YEAR);
  const r12 = ret(lv, i, DAYS.YEAR);
  if (r1 === undefined || r3 === undefined || r6 === undefined || r12 === undefined)
    return undefined;
  return 12 * r1 + 4 * r3 + 2 * r6 + r12;
}

/** Accelerating momentum (ADM): average of 1m, 3m and 6m total returns. */
export function accelMomentum(lv: Levels, i: number): number | undefined {
  const r1 = ret(lv, i, DAYS.MONTH);
  const r3 = ret(lv, i, DAYS.QUARTER);
  const r6 = ret(lv, i, DAYS.HALF_YEAR);
  if (r1 === undefined || r3 === undefined || r6 === undefined) return undefined;
  return (r1 + r3 + r6) / 3;
}
