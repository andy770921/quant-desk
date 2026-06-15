/** Return / risk metric helpers for the backtest engine. */

export interface CashFlow {
  /** "YYYY-MM-DD". */
  date: string;
  /** Negative for money put in, positive for the final value out. */
  amount: number;
}

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

function yearsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / MS_PER_YEAR;
}

/** Net present value of cash flows at annual rate `rate`, discounted from the first date. */
function npv(rate: number, flows: CashFlow[], t0: string): number {
  return flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, yearsBetween(t0, f.date)), 0);
}

/**
 * Money-weighted annualized return (XIRR) via bisection — robust across the wide
 * range of returns leveraged strategies can produce. Returns a fraction (0.1 = 10%).
 */
export function xirr(flows: CashFlow[]): number {
  if (flows.length < 2) return 0;
  const t0 = flows[0].date;
  let lo = -0.9999;
  let hi = 10; // up to 1000%/yr to accommodate 3x strategies
  let fLo = npv(lo, flows, t0);
  let fHi = npv(hi, flows, t0);
  if (fLo * fHi > 0) return 0; // no sign change → undefined IRR
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows, t0);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Compound annual growth rate for a single lump invested at the start. */
export function cagr(initial: number, final: number, startDate: string, endDate: string): number {
  const years = yearsBetween(startDate, endDate);
  if (initial <= 0 || years <= 0) return 0;
  return Math.pow(final / initial, 1 / years) - 1;
}

/** Annualized realized volatility (fraction) of a daily-return series. */
export function annualizedVol(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((s, x) => s + x, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, x) => s + (x - mean) ** 2, 0) / (dailyReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

/**
 * Annualized Sharpe ratio using daily excess returns over the cash (T-bill) leg.
 * Sharpe = mean(excess) / std(excess) * sqrt(252).
 */
export function sharpeRatio(dailyReturns: number[], dailyCashReturns: number[]): number {
  const n = Math.min(dailyReturns.length, dailyCashReturns.length);
  if (n < 2) return 0;
  const excess: number[] = [];
  for (let i = 0; i < n; i++) excess.push(dailyReturns[i] - dailyCashReturns[i]);
  const mean = excess.reduce((s, x) => s + x, 0) / n;
  const variance = excess.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (mean / sd) * Math.sqrt(252);
}

/** Largest peak-to-trough decline of a value series, as a positive fraction. */
export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = 1 - v / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}
