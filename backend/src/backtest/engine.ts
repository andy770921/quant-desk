import type { BacktestMode, TradeLeg, TradeRecord } from '@repo/shared';
import { ASSET, ASSET_LABELS, AssetKey, leverageOf } from '../market-data/assets';
import { MarketDataService } from '../market-data/market-data.service';
import * as ind from '../strategies/indicators';
import { StrategyContext, Weights } from '../strategies/strategy.types';
import { CashFlow } from './metrics';

const SIGNAL_THRESHOLD = 0.02; // min target-weight change (per asset) treated as a signal change
const DRIFT_THRESHOLD = 0.05; // rebalance a lump-sum portfolio when it drifts this far from target
const MAX_TRADES_PER_MONTH = 3;
const MIN_TRADE_USD = 0.01; // ignore dust legs

export interface EngineRun {
  monthly: { date: string; value: number; contributed: number }[];
  dailyValues: number[];
  /** Daily portfolio return stream (excludes contribution inflows) for risk metrics. */
  dailyReturns: number[];
  /** Daily cash (T-bill) return stream, the risk-free leg for Sharpe. */
  dailyCashReturns: number[];
  trades: TradeRecord[];
  /** Discretionary signal-driven rebalances (the ≤3/month constraint applies here). */
  tradeCount: number;
  finalValue: number;
  finalShares: Map<AssetKey, number>;
  finalCash: number;
  finalIndex: number;
  /** Highest market exposure (Σ weightᵢ × asset leverage) reached during the run. */
  peakLeverage: number;
  contributions: CashFlow[];
  startDate: string;
  endDate: string;
}

export interface EngineOptions {
  decide: (ctx: StrategyContext) => Weights;
  cadence: 'daily' | 'monthly';
  startIndex: number;
  endIndex: number;
  mode: BacktestMode;
  monthlyAmount: number;
  lumpSum: number;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function gross(w: Weights): number {
  let s = 0;
  for (const x of Object.values(w)) s += x ?? 0;
  return s;
}

/** Describe a signal-driven trade by what the strategy actually did. */
function signalKind(target: Weights, last: Weights): string {
  if (gross(target) < 0.001) return '出場（轉現金）';
  if (gross(last) < 0.001) return '建倉';
  return '換股／調整';
}

function weightsDiffer(
  a: Weights | Record<string, number>,
  b: Weights | Record<string, number>,
  threshold: number,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = (a as Record<string, number>)[k] ?? 0;
    const bv = (b as Record<string, number>)[k] ?? 0;
    if (Math.abs(av - bv) > threshold) return true;
  }
  return false;
}

/** Build the indicator context bound to a calendar day. */
export function makeContext(md: MarketDataService, i: number): StrategyContext {
  return {
    i,
    date: md.getCalendar()[i],
    level: (a, lag = 0) => ind.level(md.getLevels(a), i, lag),
    sma: (a, p) => ind.sma(md.getLevels(a), i, p),
    ret: (a, p) => ind.ret(md.getLevels(a), i, p),
    rsi: (a, p) => ind.rsi(md.getLevels(a), i, p),
    vol: (a, p) => ind.vol(md.getLevels(a), i, p),
    score13612W: (a) => ind.score13612W(md.getLevels(a), i),
    accel: (a) => ind.accelMomentum(md.getLevels(a), i),
    has: (a) => md.getLevels(a)[i] !== undefined,
    stocks: () => md.getStockKeys().filter((k) => md.getLevels(k)[i] !== undefined),
  };
}

/**
 * Share-based, long-only, NO-BORROW simulation. Strategy weights are fractions
 * of portfolio value (sum ≤ 1); any leverage comes from holding leveraged ETF
 * assets, never margin. Tracks actual shares + a cash balance so the result can
 * report a concrete dollar/share trade ledger. Pure given MarketDataService.
 */
export function runEngine(md: MarketDataService, opts: EngineOptions): EngineRun {
  const { decide, cadence, startIndex, endIndex, mode, monthlyAmount, lumpSum } = opts;
  const cal = md.getCalendar();
  const cashLv = md.getLevels(ASSET.CASH);
  const cashRet = (i: number): number => {
    const x = cashLv[i];
    const y = cashLv[i - 1];
    return x !== undefined && y !== undefined ? x / y - 1 : 0;
  };
  const price = (a: AssetKey, i: number) => md.getPrice(a, i);

  const shares = new Map<AssetKey, number>();
  let cash = 0;
  const holdingsValue = (i: number): number => {
    let v = 0;
    for (const [a, s] of shares) {
      const p = price(a, i);
      if (p !== undefined) v += s * p;
    }
    return v;
  };
  const totalValue = (i: number): number => cash + holdingsValue(i);
  /** Effective market exposure = Σ (position value × asset leverage) / total value. */
  const exposure = (i: number): number => {
    let e = 0;
    for (const [a, s] of shares) {
      const p = price(a, i);
      if (p !== undefined) e += s * p * leverageOf(a);
    }
    const v = totalValue(i);
    return v > 0 ? e / v : 0;
  };
  const currentWeights = (i: number): Record<string, number> => {
    const v = totalValue(i) || 1;
    const w: Record<string, number> = {};
    for (const [a, s] of shares) {
      const p = price(a, i);
      if (p !== undefined) w[a] = (s * p) / v;
    }
    return w;
  };

  const trades: TradeRecord[] = [];

  /** Rebalance holdings to `target` weights at day i. Returns true if it traded. */
  const execute = (i: number, target: Weights, kind: string): boolean => {
    const v = totalValue(i);
    const keys = new Set<AssetKey>([...shares.keys(), ...(Object.keys(target) as AssetKey[])]);
    const sells: TradeLeg[] = [];
    const buys: TradeLeg[] = [];
    for (const a of keys) {
      const p = price(a, i);
      const targetDollar = (target[a] ?? 0) * v;
      const desired = p && p > 0 ? targetDollar / p : 0;
      const cur = shares.get(a) ?? 0;
      const delta = desired - cur;
      const amount = p ? delta * p : 0;
      if (delta > 0 && amount > MIN_TRADE_USD) {
        buys.push({ asset: ASSET_LABELS[a] ?? a, shares: round4(delta), amount: round(amount) });
      } else if (delta < 0 && -amount > MIN_TRADE_USD) {
        sells.push({ asset: ASSET_LABELS[a] ?? a, shares: round4(-delta), amount: round(-amount) });
      }
      if (Math.abs(desired) > 1e-12) shares.set(a, desired);
      else shares.delete(a);
    }
    cash = v - holdingsValue(i);
    if (cash < 0) cash = 0; // guard against float dust → no borrowing
    if (buys.length === 0 && sells.length === 0) return false;
    trades.push({ date: cal[i], kind, sells, buys, cashAfter: round(cash), totalValue: round(v) });
    return true;
  };

  const monthly: EngineRun['monthly'] = [];
  const dailyValues: number[] = [];
  const dailyReturns: number[] = [];
  const dailyCashReturns: number[] = [];
  const contributions: CashFlow[] = [];

  let contributed = 0;
  let tradesThisMonth = 0;
  let signalTrades = 0;
  let curMonth = cal[startIndex].slice(0, 7);
  let lastTarget: Weights = {};

  // --- initialize at the start day ---
  const initial = mode === 'lumpsum' ? lumpSum : monthlyAmount;
  cash = initial;
  contributed = initial;
  contributions.push({ date: cal[startIndex], amount: -initial });
  lastTarget = decide(makeContext(md, startIndex));
  execute(startIndex, lastTarget, '初始建倉');
  let prevTotal = totalValue(startIndex);
  let peakLeverage = exposure(startIndex);
  dailyValues.push(prevTotal);
  monthly.push({ date: cal[startIndex], value: prevTotal, contributed });

  for (let i = startIndex + 1; i <= endIndex; i++) {
    // 1. grow: holdings move with prices, cash earns the T-bill rate
    const cr = cashRet(i);
    const grownCash = cash * (1 + cr);
    const grownValue = grownCash + holdingsValue(i);
    const dret = prevTotal > 0 ? grownValue / prevTotal - 1 : 0;
    dailyReturns.push(dret);
    dailyCashReturns.push(cr);
    cash = grownCash;

    // 2. month roll → reset trade budget + (for dca) deposit fresh cash
    const month = cal[i].slice(0, 7);
    const newMonth = month !== curMonth;
    if (newMonth) {
      curMonth = month;
      tradesThisMonth = 0;
      if (mode === 'dca') {
        cash += monthlyAmount;
        contributed += monthlyAmount;
        contributions.push({ date: cal[i], amount: -monthlyAmount });
      }
    }

    // 3. decision / rebalance — the strategy decides its target allocation; any
    //    monthly cash sitting idle is only deployed when the strategy's signal
    //    says to be invested (otherwise it stays in cash until the strategy enters).
    const decisionDay = cadence === 'daily' || newMonth;
    if (decisionDay) {
      const target = decide(makeContext(md, i));
      if (weightsDiffer(target, lastTarget, SIGNAL_THRESHOLD)) {
        // Signal change → discretionary rebalance, subject to the monthly cap.
        if (tradesThisMonth < MAX_TRADES_PER_MONTH) {
          if (execute(i, target, signalKind(target, lastTarget))) {
            tradesThisMonth++;
            signalTrades++;
          }
          lastTarget = target;
        }
        // else: cap reached → defer (keep lastTarget so we retry next month)
      } else if (mode === 'dca' && newMonth && gross(lastTarget) > 0.001) {
        // No signal change, but new monthly cash arrived AND the strategy is
        // currently invested → put the new cash to work at the current target.
        // (If the strategy is in cash, nothing is bought — the cash waits.)
        execute(i, lastTarget, '投入每月資金');
      } else if (
        mode === 'lumpsum' &&
        weightsDiffer(lastTarget, currentWeights(i), DRIFT_THRESHOLD) &&
        tradesThisMonth < MAX_TRADES_PER_MONTH
      ) {
        // Lump-sum portfolio drifted from target → periodic rebalance.
        if (execute(i, lastTarget, '再平衡')) tradesThisMonth++;
      }
    }

    // 4. record
    const tv = totalValue(i);
    dailyValues.push(tv);
    const expo = exposure(i);
    if (expo > peakLeverage) peakLeverage = expo;
    prevTotal = tv;
    const isLastDay = i === endIndex;
    const nextNewMonth = i < endIndex && cal[i + 1].slice(0, 7) !== month;
    if (nextNewMonth || isLastDay) monthly.push({ date: cal[i], value: tv, contributed });
  }

  return {
    monthly,
    dailyValues,
    dailyReturns,
    dailyCashReturns,
    trades,
    tradeCount: signalTrades,
    finalValue: totalValue(endIndex),
    finalShares: shares,
    finalCash: cash,
    finalIndex: endIndex,
    peakLeverage,
    contributions,
    startDate: cal[startIndex],
    endDate: cal[endIndex],
  };
}
