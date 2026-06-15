/**
 * Strategy metadata shared between the NestJS backend (registry) and the
 * Next.js frontend (strategy list + detail pages).
 */

export type StrategyCategory =
  | 'trend-following'
  | 'momentum'
  | 'mean-reversion'
  | 'volatility'
  | 'diversified';

export type RebalanceCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type RiskLevel = 'low' | 'medium' | 'high' | 'very-high';

export interface StrategySummary {
  /** Stable id used in URLs and API calls, e.g. "nasdaq-3x-20dma". */
  id: string;
  /** Display name. */
  name: string;
  /** Short display name for cards. */
  shortName: string;
  category: StrategyCategory;
  /** One-line summary for cards. */
  description: string;
  tags: string[];
  /** Peak leverage the strategy can apply (1 = unlevered). */
  leverage: number;
  rebalance: RebalanceCadence;
  riskLevel: RiskLevel;
  /** Human-readable universe, e.g. ["Nasdaq-100", "Cash"]. */
  universe: string[];
  /** Earliest date the strategy can be backtested given data availability. */
  dataInception: string;
}

export interface StrategyDetail extends StrategySummary {
  /** Multi-paragraph explanation of the rationale. */
  longDescription: string;
  /** Plain-language list of the trading rules. */
  rules: string[];
  /** Known caveats / drawdown character. */
  caveats: string[];
  /** Buy/sell signal logic as a code/pseudo-code snippet for display. */
  signalFormula: string;
}
