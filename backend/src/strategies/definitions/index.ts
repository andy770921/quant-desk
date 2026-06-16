import { StrategyDefinition } from '../strategy.types';

// The 10 strategies. Strategy 1 is the mandated flagship (3x Nasdaq × 20MA — the
// only one that uses leverage). Strategies 2-10 are UNLEVERAGED, skill-based
// approaches that each beat dollar-cost-averaging into QQQ or VOO by >=20% over
// full history with a lower max drawdown than buy-and-hold (locked by
// strategy-eval.spec.ts): 02-05 are bias-free index asset-allocation (dual
// momentum, defensive canary, Nasdaq trend, bond-blend); 06-10 are individual-
// stock factor strategies (momentum, multifactor low-vol, bond-ballast, pullback,
// broad momentum) over the S&P 500 universe in data/stocks/. Edit a file here (or
// add one and register it below) to add or tune a strategy.
import { nasdaq3x20dma } from './01-nasdaq-3x-20dma';
import { dualMomentumGem } from './02-dual-momentum-gem';
import { sma200Trend } from './03-sma-200-trend';
import { leverageLongRun } from './04-leverage-long-run';
import { acceleratingDualMomentum } from './05-accelerating-dual-momentum';
import { sectorMomentum } from './06-sector-momentum';
import { volTargetSpy } from './07-vol-target-spy';
import { defensiveAssetAllocation } from './08-defensive-asset-allocation';
import { rsi2MeanReversion } from './09-rsi2-mean-reversion';
import { allWeather } from './10-all-weather';

/**
 * Full registry consumed by StrategiesService. To add or tune a strategy, edit
 * the matching file in this folder (or add a new one and register it here).
 */
export const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  nasdaq3x20dma,
  dualMomentumGem,
  sma200Trend,
  leverageLongRun,
  acceleratingDualMomentum,
  sectorMomentum,
  volTargetSpy,
  defensiveAssetAllocation,
  rsi2MeanReversion,
  allWeather,
];
