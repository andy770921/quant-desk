import { Injectable } from '@nestjs/common';
import type { CurrentSignal, SignalAllocation, SignalChange, SignalStance } from '@repo/shared';
import { ASSET, ASSET_LABELS, AssetKey, assetLabel } from '../market-data/assets';
import { MarketDataService } from '../market-data/market-data.service';
import { makeContext } from '../backtest/engine';
import { StrategiesService } from '../strategies/strategies.service';
import { StrategyDefinition, Weights } from '../strategies/strategy.types';

@Injectable()
export class SignalsService {
  /** Last evaluated allocation signature per strategy, for change detection. */
  private lastSignature = new Map<string, string>();

  constructor(
    private readonly marketData: MarketDataService,
    private readonly strategies: StrategiesService,
  ) {}

  /**
   * Evaluate a strategy's CURRENT target allocation from the latest data —
   * computed live (decide() at the most recent calendar index), never cached
   * against time. This is the "should I buy/sell right now" answer.
   */
  getCurrentSignal(def: StrategyDefinition): CurrentSignal {
    const i = this.marketData.lastIndex();
    const inception = this.strategies.getInceptionIndex(def);
    const weights = i > inception ? def.decide(makeContext(this.marketData, i)) : {};
    const allocations = this.toAllocations(weights);
    const gross = this.gross(weights);
    const nonCash = allocations.filter((a) => a.asset !== ASSET_LABELS[ASSET.CASH]);
    const stance: SignalStance = gross < 0.01 ? 'cash' : nonCash.length <= 1 ? 'invested' : 'mixed';

    return {
      strategyId: def.id,
      strategyName: def.name,
      asOf: this.marketData.getAsOf(),
      computedAt: new Date().toISOString(),
      stance,
      allocations,
      summary: this.summarize(stance, allocations),
    };
  }

  getById(id: string): CurrentSignal | undefined {
    const def = this.strategies.getDefinition(id);
    return def ? this.getCurrentSignal(def) : undefined;
  }

  getAll(): CurrentSignal[] {
    return this.strategies.getAllDefinitions().map((def) => this.getCurrentSignal(def));
  }

  /**
   * Re-evaluate every strategy and return those whose target allocation changed
   * since the previous evaluation. The (future) scheduler feeds these to the
   * notification pipeline. First call seeds the baseline without emitting.
   */
  detectChanges(): SignalChange[] {
    const changes: SignalChange[] = [];
    for (const def of this.strategies.getAllDefinitions()) {
      const signal = this.getCurrentSignal(def);
      const signature = this.signatureOf(signal.allocations);
      const previous = this.lastSignature.get(def.id);
      if (previous !== undefined && previous !== signature) {
        changes.push({
          strategyId: def.id,
          strategyName: def.name,
          asOf: signal.asOf,
          from: this.summaryFromSignature(previous),
          to: signal.summary,
        });
      }
      this.lastSignature.set(def.id, signature);
    }
    return changes;
  }

  // ----------------------------------------------------------------- helpers

  private gross(w: Weights): number {
    let s = 0;
    for (const x of Object.values(w)) s += x ?? 0;
    return s;
  }

  private toAllocations(weights: Weights): SignalAllocation[] {
    const out: SignalAllocation[] = [];
    let gross = 0;
    for (const [a, w] of Object.entries(weights)) {
      if (!w) continue;
      gross += w;
      out.push({ asset: assetLabel(a as AssetKey), weightPct: Math.round(w * 1000) / 10 });
    }
    if (gross < 0.999) {
      out.push({
        asset: ASSET_LABELS[ASSET.CASH],
        weightPct: Math.round((1 - gross) * 1000) / 10,
      });
    }
    return out.sort((x, y) => y.weightPct - x.weightPct);
  }

  private summarize(stance: SignalStance, allocations: SignalAllocation[]): string {
    if (stance === 'cash') return '建議：100% 現金（場外觀望）';
    const parts = allocations.map((a) => `${a.asset} ${a.weightPct}%`);
    return `建議持有：${parts.join('、')}`;
  }

  /** Canonical "asset:pct|asset:pct" string for change detection + readback. */
  private signatureOf(allocations: SignalAllocation[]): string {
    return allocations.map((a) => `${a.asset}:${a.weightPct}`).join('|');
  }

  private summaryFromSignature(sig: string): string {
    if (!sig) return '—';
    const parts = sig.split('|').map((p) => {
      const [asset, pct] = p.split(':');
      return `${asset} ${pct}%`;
    });
    return parts.join('、');
  }
}
