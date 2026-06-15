import { StrategyDefinition } from '../strategy.types';

// Base strategies (1 is the mandated flagship; 2-10 are documented approaches).
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

// Improved variants of strategies 2-10 (strategy 1 is intentionally untouched).
import { dualMomentumGemPlus } from './improved/02-dual-momentum-gem-plus';
import { sma200TrendPlus } from './improved/03-sma-200-trend-plus';
import { leverageLongRunPlus } from './improved/04-leverage-long-run-plus';
import { acceleratingDualMomentumPlus } from './improved/05-accelerating-dual-momentum-plus';
import { sectorMomentumPlus } from './improved/06-sector-momentum-plus';
import { volTargetSpyPlus } from './improved/07-vol-target-spy-plus';
import { defensiveAssetAllocationPlus } from './improved/08-defensive-asset-allocation-plus';
import { rsi2MeanReversionPlus } from './improved/09-rsi2-mean-reversion-plus';
import { allWeatherPlus } from './improved/10-all-weather-plus';

/** The original 10 strategies. */
export const BASE_STRATEGIES: StrategyDefinition[] = [
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

/** Research-driven improved variants (one per base strategy 2-10). */
export const IMPROVED_STRATEGIES: StrategyDefinition[] = [
  dualMomentumGemPlus,
  sma200TrendPlus,
  leverageLongRunPlus,
  acceleratingDualMomentumPlus,
  sectorMomentumPlus,
  volTargetSpyPlus,
  defensiveAssetAllocationPlus,
  rsi2MeanReversionPlus,
  allWeatherPlus,
];

/**
 * Full registry consumed by StrategiesService. To add or tune a strategy, edit
 * the matching file in this folder (or add a new one and register it here).
 */
export const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  ...BASE_STRATEGIES,
  ...IMPROVED_STRATEGIES,
];
