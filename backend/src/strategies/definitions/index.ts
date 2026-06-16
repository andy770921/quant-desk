import { StrategyDefinition } from '../strategy.types';

// The 10 strategies. Strategy 1 is the mandated flagship; 2-10 are the
// research-driven approaches. Edit a file here (or add one and register it
// below) to add or tune a strategy.
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
