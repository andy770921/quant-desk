import type { RebalanceCadence, StrategyCategory } from '@repo/shared';
import { AssetKey } from '../market-data/assets';

/** Target portfolio weights by asset. May sum to <1 (cash buffer), 1, or >1 (leverage). */
export type Weights = Partial<Record<AssetKey, number>>;

/**
 * Indicator helpers bound to the signal day, passed to each strategy's
 * `decide`. They read the aligned daily level arrays from MarketDataService.
 */
export interface StrategyContext {
  /** Calendar index of the signal (decision) day. */
  i: number;
  date: string;
  /** Level of an asset, optionally lagged by `lag` days. */
  level(asset: AssetKey, lag?: number): number | undefined;
  sma(asset: AssetKey, period: number): number | undefined;
  /** Total return over the trailing `period` trading days. */
  ret(asset: AssetKey, period: number): number | undefined;
  rsi(asset: AssetKey, period: number): number | undefined;
  /** Annualized realized volatility over `period` trading days. */
  vol(asset: AssetKey, period: number): number | undefined;
  /** Keller 13612W momentum score. */
  score13612W(asset: AssetKey): number | undefined;
  /** Accelerating momentum (avg of 1m/3m/6m returns). */
  accel(asset: AssetKey): number | undefined;
  /**
   * Raw Treasury yield level (in percent) for macro / yield-curve signals, e.g.
   * the 10y−3m recession spread `yieldVal('TNX') − yieldVal('IRX')`. Optionally
   * lagged by `lag` days. Undefined before the yield series begins.
   */
  yieldVal(key: 'IRX' | 'TNX' | 'TYX', lag?: number): number | undefined;
  /** Whether the asset has a value on the signal day. */
  has(asset: AssetKey): boolean;
  /** Individual-stock asset keys (STK_*) that have data on the signal day. */
  stocks(): AssetKey[];
}

export interface StrategyDefinition {
  id: string;
  name: string;
  shortName: string;
  category: StrategyCategory;
  description: string;
  longDescription: string;
  rules: string[];
  caveats: string[];
  tags: string[];
  rebalance: RebalanceCadence;
  /** Human-readable universe for cards. */
  universe: string[];
  /** Assets the strategy can allocate to. */
  assets: AssetKey[];
  /**
   * Assets required from day one. The data-inception date is the latest
   * inception among these plus `warmupDays`. Assets in `assets` but not here
   * are optional (used once their data exists); `decide` must tolerate their
   * absence. Defaults to `assets` when omitted.
   */
  coreAssets?: AssetKey[];
  /** Trading days of history required before the first valid signal. */
  warmupDays: number;
  /** How often the strategy is allowed to re-evaluate its target weights. */
  cadence: 'daily' | 'monthly';
  /** Returns target weights for the day after the signal day. */
  decide(ctx: StrategyContext): Weights;
}
