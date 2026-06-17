import { StrategyDefinition } from '../strategy.types';

// The 10 strategies. Strategy 01 is the mandated flagship (3x Nasdaq × 20MA).
// Strategies 02-10 are the nine survivorship-bias-free, rules-based books from
// the quant-strategies research (S1-S9), each holding AT MOST 10 instruments and
// trading on at most 3 days a month (engine-enforced). Each simulates investing
// $2000/month and beats dollar-cost-averaging into QQQ OR VOO by >=10% in final
// value over its full history, at a Sharpe at least matching the benchmark
// (locked by strategy-eval.spec.ts). Every book is bias-free — none selects
// individual stocks; the single-stock families were retired. Leverage is via
// leveraged ETFs held with cash (no margin), exactly the platform's model:
//   02 (S1) Diversified Time-Series Momentum (managed futures) — Moskowitz/Ooi/Pedersen
//   03 (S2) Dual Momentum (GEM) — Antonacci
//   04 (S3) Volatility-Managed Equity — Moreira & Muir (JF 2017)
//   05 (S4) Yield-Curve Macro Regime — Estrella & Mishkin
//   06 (S5) Sector Momentum Rotation — Faber
//   07 (S6) Tactical Leveraged Risk Parity — Dalio / HFEA
//   08 (S7) Short-Term Mean Reversion (RSI-2) — Connors & Alvarez
//   09 (S8) Leverage for the Long Run (graduated) — Gayed & Bilello
//   10 (S9) Defensive Asset Allocation (canary breadth) — Keller & Keuning
// Edit a file here (or add one and register it below) to add or tune a strategy.
import { nasdaq3x20dma } from './01-nasdaq-3x-20dma';
import { diversifiedTsmom } from './02-diversified-tsmom';
import { dualMomentumGem } from './03-dual-momentum-gem';
import { volManagedEquity } from './04-vol-managed-equity';
import { yieldCurveMacro } from './05-yield-curve-macro';
import { sectorMomentum } from './06-sector-momentum';
import { tacticalRiskParity } from './07-tactical-risk-parity';
import { rsi2MeanReversion } from './08-rsi2-mean-reversion';
import { leverageLongRun } from './09-leverage-long-run';
import { defensiveAssetAllocation } from './10-defensive-asset-allocation';

/**
 * Full registry consumed by StrategiesService. To add or tune a strategy, edit
 * the matching file in this folder (or add a new one and register it here).
 */
export const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  nasdaq3x20dma,
  diversifiedTsmom,
  dualMomentumGem,
  volManagedEquity,
  yieldCurveMacro,
  sectorMomentum,
  tacticalRiskParity,
  rsi2MeanReversion,
  leverageLongRun,
  defensiveAssetAllocation,
];
