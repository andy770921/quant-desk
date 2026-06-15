import { Injectable } from '@nestjs/common';
import type { RiskLevel, StrategyDetail, StrategySummary } from '@repo/shared';
import { classifyRiskLevel } from '@repo/shared';
import { MarketDataService } from '../market-data/market-data.service';
import { runEngine } from '../backtest/engine';
import { annualizedVol } from '../backtest/metrics';
import { STRATEGY_DEFINITIONS } from './definitions';
import { StrategyDefinition } from './strategy.types';

interface DerivedProfile {
  riskLevel: RiskLevel;
  /** Peak market exposure (leverage multiple) reached over full history. */
  leverage: number;
}

@Injectable()
export class StrategiesService {
  /** Cache of dynamically-derived risk level + leverage per strategy id. */
  private profileCache = new Map<string, DerivedProfile>();

  constructor(private readonly marketData: MarketDataService) {}

  getDefinition(id: string): StrategyDefinition | undefined {
    return STRATEGY_DEFINITIONS.find((s) => s.id === id);
  }

  getAllDefinitions(): StrategyDefinition[] {
    return STRATEGY_DEFINITIONS;
  }

  /** Invalidate derived risk/leverage cache (call after a live data refresh). */
  clearProfileCache(): void {
    this.profileCache.clear();
  }

  /** Earliest calendar index a strategy can be backtested from (core data + warm-up). */
  getInceptionIndex(def: StrategyDefinition): number {
    const core = def.coreAssets ?? def.assets;
    const latestInception = core.reduce(
      (max, a) => Math.max(max, this.marketData.getInceptionIndex(a)),
      0,
    );
    const idx = latestInception + def.warmupDays;
    return Math.min(idx, this.marketData.lastIndex());
  }

  /**
   * Risk level AND leverage are DERIVED, not hard-coded: run a canonical
   * full-history lump-sum backtest, then classify annualized volatility via the
   * shared thresholds (classifyRiskLevel / RISK_VOL_BANDS) and read the peak
   * market exposure the strategy actually reached. Cached per strategy.
   */
  getProfile(def: StrategyDefinition): DerivedProfile {
    const cached = this.profileCache.get(def.id);
    if (cached) return cached;
    const startIndex = this.getInceptionIndex(def);
    const endIndex = this.marketData.lastIndex();
    let profile: DerivedProfile = { riskLevel: 'medium', leverage: 1 };
    if (startIndex < endIndex - 20) {
      const run = runEngine(this.marketData, {
        decide: (ctx) => def.decide(ctx),
        cadence: def.cadence,
        startIndex,
        endIndex,
        mode: 'lumpsum',
        monthlyAmount: 0,
        lumpSum: 100000,
      });
      profile = {
        riskLevel: classifyRiskLevel(annualizedVol(run.dailyReturns) * 100),
        leverage: Math.round(run.peakLeverage * 10) / 10,
      };
    }
    this.profileCache.set(def.id, profile);
    return profile;
  }

  private toSummary(def: StrategyDefinition): StrategySummary {
    const inceptionIdx = this.getInceptionIndex(def);
    const profile = this.getProfile(def);
    return {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      category: def.category,
      description: def.description,
      tags: def.tags,
      leverage: profile.leverage,
      rebalance: def.rebalance,
      riskLevel: profile.riskLevel,
      universe: def.universe,
      dataInception: this.marketData.getCalendar()[inceptionIdx],
    };
  }

  getSummaries(): StrategySummary[] {
    return STRATEGY_DEFINITIONS.map((def) => this.toSummary(def));
  }

  getDetail(id: string): StrategyDetail | undefined {
    const def = this.getDefinition(id);
    if (!def) return undefined;
    return {
      ...this.toSummary(def),
      longDescription: def.longDescription,
      rules: def.rules,
      caveats: def.caveats,
      signalFormula: def.signalFormula,
    };
  }
}
