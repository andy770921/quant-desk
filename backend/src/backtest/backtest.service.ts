import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  BacktestMode,
  BacktestRequest,
  BacktestResult,
  BenchmarkResult,
  DrawdownPoint,
  EquityPoint,
  HoldingSlice,
} from '@repo/shared';
import { MarketDataService } from '../market-data/market-data.service';
import { ASSET, ASSET_LABELS } from '../market-data/assets';
import { StrategiesService } from '../strategies/strategies.service';
import { EngineRun, round, round4, runEngine } from './engine';
import { annualizedVol, cagr, maxDrawdown, sharpeRatio, xirr } from './metrics';

@Injectable()
export class BacktestService {
  constructor(
    private readonly marketData: MarketDataService,
    private readonly strategies: StrategiesService,
  ) {}

  run(req: BacktestRequest): BacktestResult {
    const def = this.strategies.getDefinition(req.strategyId);
    if (!def) throw new BadRequestException(`Unknown strategy: ${req.strategyId}`);

    const mode: BacktestMode = req.mode === 'lumpsum' ? 'lumpsum' : 'dca';
    const monthlyAmount = req.monthlyAmount && req.monthlyAmount > 0 ? req.monthlyAmount : 2000;
    const lumpSum = req.lumpSum && req.lumpSum > 0 ? req.lumpSum : 100000;

    const cal = this.marketData.getCalendar();
    const endIndex = this.marketData.lastIndex();
    const requestedIdx = this.marketData.indexOnOrAfter(req.start);
    if (requestedIdx < 0) throw new BadRequestException(`Start date out of range: ${req.start}`);

    const strategyInception = this.strategies.getInceptionIndex(def);
    const startIndex = Math.max(requestedIdx, strategyInception);
    if (startIndex >= endIndex - 20) {
      throw new BadRequestException('Not enough data after the requested start date.');
    }

    const notes: string[] = [];
    if (startIndex > requestedIdx) {
      notes.push(
        `因資料可得性，實際回測自 ${cal[startIndex]} 起算（早於此日期該策略所需資料尚不完整）。`,
      );
    }

    const opts = { startIndex, endIndex, mode, monthlyAmount, lumpSum };
    const strat = runEngine(this.marketData, {
      decide: (ctx) => def.decide(ctx),
      cadence: def.cadence,
      ...opts,
    });
    // Benchmarks: buy & hold (lump) / monthly buy (dca) of a single ETF.
    const qqq = runEngine(this.marketData, {
      decide: () => ({ [ASSET.NASDAQ]: 1 }),
      cadence: 'monthly',
      ...opts,
    });
    const voo = runEngine(this.marketData, {
      decide: () => ({ [ASSET.USLC]: 1 }),
      cadence: 'monthly',
      ...opts,
    });

    const equityCurve: EquityPoint[] = strat.monthly.map((p, i) => ({
      date: p.date,
      strategy: round(p.value),
      contributed: round(p.contributed),
      qqq: round(qqq.monthly[i]?.value ?? 0),
      voo: round(voo.monthly[i]?.value ?? 0),
    }));

    const drawdownCurve: DrawdownPoint[] = this.toDrawdownCurve(strat.monthly);

    const benchmarks: BenchmarkResult[] = [
      {
        key: 'QQQ',
        name: mode === 'dca' ? '每月買入 QQQ (那斯達克100)' : '一次買入 QQQ (那斯達克100)',
        metrics: this.metricsOf(qqq, mode),
      },
      {
        key: 'VOO',
        name: mode === 'dca' ? '每月買入 VOO (標普500)' : '一次買入 VOO (標普500)',
        metrics: this.metricsOf(voo, mode),
      },
    ];

    if (mode === 'dca') {
      notes.push(
        `每月 1 日撥入 ${monthlyAmount} 美元到「現金」部位，交由策略運用：只有當策略訊號為進場時，這筆現金才會依當下目標配置買入；若策略當時在場外（現金），這筆錢就留在現金等待策略進場。`,
      );
    }
    notes.push(
      '本平台不使用融資借貸：槓桿曝險一律以買入對應的槓桿 ETF（如 TQQQ、UPRO、SSO）達成，這些 ETF 每日重設、扣除約 0.9%/年費用模擬。',
    );
    notes.push(
      'QQQ 於 1999 年、VOO 於 2010 年才上市；早於上市日的比較基準以對應指數（那斯達克100 / 標普500 含息）回推。',
    );

    return {
      strategyId: def.id,
      strategyName: def.name,
      mode,
      currency: 'USD',
      start: req.start,
      effectiveStart: cal[startIndex],
      end: cal[endIndex],
      monthlyAmount: mode === 'dca' ? monthlyAmount : undefined,
      lumpSum: mode === 'lumpsum' ? lumpSum : undefined,
      metrics: this.metricsOf(strat, mode),
      benchmarks,
      equityCurve,
      drawdownCurve,
      holdingsNow: this.buildHoldings(strat),
      cashNow: round(strat.finalCash),
      totalValueNow: round(strat.finalValue),
      recentTrades: strat.trades.slice(-15).reverse(),
      notes,
    };
  }

  // ------------------------------------------------------------- assembling

  private metricsOf(run: EngineRun, mode: BacktestMode) {
    const years =
      (Date.parse(run.endDate) - Date.parse(run.startDate)) / (365.25 * 24 * 3600 * 1000);
    const contributed = run.contributions.reduce((s, c) => s - c.amount, 0);
    const annualized =
      mode === 'lumpsum'
        ? cagr(-run.contributions[0].amount, run.finalValue, run.startDate, run.endDate)
        : xirr([...run.contributions, { date: run.endDate, amount: run.finalValue }]);
    return {
      finalValue: round(run.finalValue),
      totalContributed: round(contributed),
      totalProfit: round(run.finalValue - contributed),
      totalReturnPct: round((run.finalValue / contributed - 1) * 100),
      annualizedReturnPct: round(annualized * 100),
      maxDrawdownPct: round(maxDrawdown(run.dailyValues) * 100),
      annualVolPct: round(annualizedVol(run.dailyReturns) * 100),
      sharpe: round(sharpeRatio(run.dailyReturns, run.dailyCashReturns)),
      peakLeverage: Math.round(run.peakLeverage * 10) / 10,
      years: round(years),
      tradeCount: run.tradeCount,
    };
  }

  private toDrawdownCurve(monthly: EngineRun['monthly']): DrawdownPoint[] {
    let peak = -Infinity;
    return monthly.map((p) => {
      if (p.value > peak) peak = p.value;
      return { date: p.date, strategy: round(peak > 0 ? (p.value / peak - 1) * 100 : 0) };
    });
  }

  private buildHoldings(run: EngineRun): HoldingSlice[] {
    const i = run.finalIndex;
    const total = run.finalValue || 1;
    const slices: HoldingSlice[] = [];
    for (const [a, s] of run.finalShares) {
      const p = this.marketData.getPrice(a, i);
      if (p === undefined || s <= 0) continue;
      const value = s * p;
      slices.push({
        asset: ASSET_LABELS[a] ?? a,
        shares: round4(s),
        price: round(p),
        value: round(value),
        weightPct: round((value / total) * 100),
      });
    }
    return slices.sort((x, y) => y.value - x.value);
  }
}
