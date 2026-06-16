import { StrategyDefinition } from '../strategy.types';

// The 10 strategies. Strategy 1 is the mandated flagship (3x Nasdaq × 20MA).
// Strategies 2-10 each hold AT MOST 10 instruments and trade on at most 3 days a
// month (engine-enforced), and each beats dollar-cost-averaging into QQQ by a wide
// margin over its full history (locked by strategy-eval.spec.ts):
//   02-06 are LEVERAGED ETF strategies (bias-free; they beat QQQ DCA in BOTH the
//   1990 and 2010 windows by only gearing up inside a 200-day uptrend and sizing
//   leverage by volatility): vol-targeted leveraged Nasdaq, leveraged dual-
//   momentum, balanced leveraged growth, an aggressive (3x) vol-target sibling,
//   and a trend-gated HFEA leveraged risk-parity book.
//   07-10 are LEVERAGED-CORE + STOCK-SATELLITE books: a dominant (70-85%) vol-
//   targeted leveraged-Nasdaq core (the same bias-free lever as 02/05) drives the
//   return and beats QQQ in BOTH the 1990 and 2010 windows, with a ≤20% low-vol-
//   momentum stock satellite (+ gold/bond sleeve) for an honest factor tilt:
//   core+low-vol, core+gold hedge, index-anchored core, and core+bond cushion.
//   Survivorship bias is confined to the small stock sleeve (see caveats / DATA.md).
// Edit a file here (or add one and register it below) to add or tune a strategy.
import { nasdaq3x20dma } from './01-nasdaq-3x-20dma';
import { volTargetLeveragedNasdaq } from './02-dual-momentum-gem';
import { leveragedDualMomentum } from './03-sma-200-trend';
import { balancedLeveragedGrowth } from './04-leverage-long-run';
import { aggressiveVolTargetNasdaq } from './05-accelerating-dual-momentum';
import { leveragedRiskParity } from './06-sector-momentum';
import { momentumLowVol } from './07-vol-target-spy';
import { defensiveMomentumGold } from './08-defensive-asset-allocation';
import { momentumIndexCore } from './09-rsi2-mean-reversion';
import { momentumBondBallast } from './10-all-weather';

/**
 * Full registry consumed by StrategiesService. To add or tune a strategy, edit
 * the matching file in this folder (or add a new one and register it here).
 */
export const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  nasdaq3x20dma,
  volTargetLeveragedNasdaq,
  leveragedDualMomentum,
  balancedLeveragedGrowth,
  aggressiveVolTargetNasdaq,
  leveragedRiskParity,
  momentumLowVol,
  defensiveMomentumGold,
  momentumIndexCore,
  momentumBondBallast,
];
