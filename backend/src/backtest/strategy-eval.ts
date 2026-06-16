/**
 * Standalone evaluation harness (not a Nest provider) used to score every
 * strategy against the QQQ / VOO dollar-cost-averaging benchmarks over the
 * strategy's full available history. Pure: instantiate MarketDataService,
 * call onModuleInit(), then `evaluateAll()`.
 *
 * Run via the spec wrapper: `npx jest src/backtest/strategy-eval.spec.ts`.
 */
import { ASSET } from '../market-data/assets';
import { MarketDataService } from '../market-data/market-data.service';
import { STRATEGY_DEFINITIONS } from '../strategies/definitions';
import { StrategyDefinition } from '../strategies/strategy.types';
import { runEngine } from './engine';
import { annualizedVol, cagr, maxDrawdown, sharpeRatio, xirr } from './metrics';

export interface StratScore {
  id: string;
  name: string;
  start: string;
  end: string;
  years: number;
  mode: 'dca' | 'lumpsum';
  stratFinal: number;
  qqqFinal: number;
  vooFinal: number;
  /** strategy final / QQQ final */
  vsQQQ: number;
  /** strategy final / VOO final */
  vsVOO: number;
  annualizedPct: number;
  sharpe: number;
  maxDdPct: number;
  /** Calmar-style ratio: annualized return ÷ max drawdown (higher = better). */
  calmar: number;
  volPct: number;
  peakLeverage: number;
  trades: number;
  /** Benchmark Sharpe + max drawdown over the same window (for comparison). */
  qqqSharpe: number;
  vooSharpe: number;
  qqqMaxDdPct: number;
  vooMaxDdPct: number;
  /** Beats QQQ by >=20% in final value (the strong bar). */
  beatsQQQ20: boolean;
  /** Beats QQQ or VOO by >=20% in final value (the goal's literal bar). */
  beats20: boolean;
}

function annualized(run: ReturnType<typeof runEngine>, mode: 'dca' | 'lumpsum'): number {
  return mode === 'lumpsum'
    ? cagr(-run.contributions[0].amount, run.finalValue, run.startDate, run.endDate)
    : xirr([...run.contributions, { date: run.endDate, amount: run.finalValue }]);
}

export function evaluate(
  md: MarketDataService,
  def: StrategyDefinition,
  mode: 'dca' | 'lumpsum',
  monthlyAmount = 2000,
  lumpSum = 100000,
  fromDate?: string,
): StratScore {
  const core = def.coreAssets ?? def.assets;
  const inception =
    core.reduce((mx, a) => Math.max(mx, md.getInceptionIndex(a)), 0) + def.warmupDays;
  const fromIdx = fromDate ? md.indexOnOrAfter(fromDate) : 0;
  const startIndex = Math.min(Math.max(inception, fromIdx < 0 ? 0 : fromIdx), md.lastIndex());
  const endIndex = md.lastIndex();
  const opts = { startIndex, endIndex, mode, monthlyAmount, lumpSum } as const;

  const strat = runEngine(md, { decide: (c) => def.decide(c), cadence: def.cadence, ...opts });
  const qqq = runEngine(md, { decide: () => ({ [ASSET.NASDAQ]: 1 }), cadence: 'monthly', ...opts });
  const voo = runEngine(md, { decide: () => ({ [ASSET.USLC]: 1 }), cadence: 'monthly', ...opts });

  const years = (Date.parse(strat.endDate) - Date.parse(strat.startDate)) / (365.25 * 864e5);
  const vsQQQ = strat.finalValue / qqq.finalValue;
  const vsVOO = strat.finalValue / voo.finalValue;
  const annl = annualized(strat, mode);
  const maxDd = maxDrawdown(strat.dailyValues);
  return {
    id: def.id,
    name: def.name,
    start: strat.startDate,
    end: strat.endDate,
    years: Math.round(years * 10) / 10,
    mode,
    stratFinal: Math.round(strat.finalValue),
    qqqFinal: Math.round(qqq.finalValue),
    vooFinal: Math.round(voo.finalValue),
    vsQQQ: Math.round(vsQQQ * 1000) / 1000,
    vsVOO: Math.round(vsVOO * 1000) / 1000,
    annualizedPct: Math.round(annl * 1000) / 10,
    sharpe: Math.round(sharpeRatio(strat.dailyReturns, strat.dailyCashReturns) * 100) / 100,
    maxDdPct: Math.round(maxDd * 1000) / 10,
    calmar: maxDd > 0 ? Math.round((annl / maxDd) * 100) / 100 : 0,
    volPct: Math.round(annualizedVol(strat.dailyReturns) * 1000) / 10,
    peakLeverage: Math.round(strat.peakLeverage * 10) / 10,
    trades: strat.tradeCount,
    qqqSharpe: Math.round(sharpeRatio(qqq.dailyReturns, qqq.dailyCashReturns) * 100) / 100,
    vooSharpe: Math.round(sharpeRatio(voo.dailyReturns, voo.dailyCashReturns) * 100) / 100,
    qqqMaxDdPct: Math.round(maxDrawdown(qqq.dailyValues) * 1000) / 10,
    vooMaxDdPct: Math.round(maxDrawdown(voo.dailyValues) * 1000) / 10,
    beatsQQQ20: vsQQQ >= 1.2,
    beats20: vsQQQ >= 1.2 || vsVOO >= 1.2,
  };
}

export function evaluateAll(md: MarketDataService, mode: 'dca' | 'lumpsum'): StratScore[] {
  return STRATEGY_DEFINITIONS.map((def) => evaluate(md, def, mode));
}

/** Pretty one-line-per-strategy table for console output. */
export function formatScores(scores: StratScore[]): string {
  const head = [
    'id'.padEnd(28),
    'start'.padEnd(11),
    'yrs'.padStart(5),
    'annl%'.padStart(7),
    'sharpe'.padStart(7),
    'maxDD%'.padStart(7),
    'calmar'.padStart(7),
    'lev'.padStart(4),
    'vsQQQ'.padStart(7),
    'vsVOO'.padStart(7),
    'beat'.padStart(5),
  ].join(' ');
  const rows = scores.map((s) =>
    [
      s.id.padEnd(28),
      s.start.padEnd(11),
      String(s.years).padStart(5),
      String(s.annualizedPct).padStart(7),
      String(s.sharpe).padStart(7),
      String(s.maxDdPct).padStart(7),
      String(s.calmar).padStart(7),
      String(s.peakLeverage).padStart(4),
      String(s.vsQQQ).padStart(7),
      String(s.vsVOO).padStart(7),
      (s.beatsQQQ20 ? 'QQQ' : s.beats20 ? 'voo' : '-').padStart(5),
    ].join(' '),
  );
  // Benchmark reference line (drawdown of the things we're trying to beat).
  const b = scores[0];
  const ref = b
    ? `\n(benchmark maxDD over last window — QQQ: ${b.qqqMaxDdPct}%  VOO: ${b.vooMaxDdPct}%; ` +
      `Sharpe QQQ ${b.qqqSharpe} / VOO ${b.vooSharpe})`
    : '';
  return [head, ...rows].join('\n') + ref;
}
