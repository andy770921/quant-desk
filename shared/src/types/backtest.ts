/**
 * Backtest request/response contract.
 *
 * Two contribution modes are supported, matching the product requirements:
 *  - "dca":     invest a fixed amount every month (default $2,000).
 *  - "lumpsum": invest a single lump sum once at the start (default $100,000).
 */

export type BacktestMode = 'dca' | 'lumpsum';

export interface BacktestRequest {
  strategyId: string;
  mode: BacktestMode;
  /** Inclusive start, "YYYY-MM" (defaults: 1990-01 for long, 2026-01 for forward). */
  start: string;
  /** Monthly contribution for dca mode (USD). */
  monthlyAmount?: number;
  /** One-off contribution for lumpsum mode (USD). */
  lumpSum?: number;
}

export interface BacktestMetrics {
  /** Portfolio value at the end of the backtest. */
  finalValue: number;
  /** Sum of all cash put in. */
  totalContributed: number;
  /** finalValue - totalContributed. */
  totalProfit: number;
  /** finalValue / totalContributed - 1, as a percentage. */
  totalReturnPct: number;
  /**
   * Annualized return. For lumpsum this is CAGR; for dca it is the
   * money-weighted return (XIRR) which accounts for the timing of deposits.
   */
  annualizedReturnPct: number;
  /** Largest peak-to-trough decline of the equity curve, as a percentage. */
  maxDrawdownPct: number;
  /** Annualized realized volatility of the strategy's daily returns, as a percentage. */
  annualVolPct: number;
  /** Annualized Sharpe ratio (excess daily return over T-bills / volatility). */
  sharpe: number;
  /** Highest market exposure (leverage multiple) actually reached during the run. */
  peakLeverage: number;
  /** Length of the backtest in years. */
  years: number;
  /** Number of discretionary rebalances executed by the strategy. */
  tradeCount: number;
}

export interface BenchmarkResult {
  /** "QQQ" | "VOO" */
  key: string;
  name: string;
  metrics: BacktestMetrics;
}

export interface EquityPoint {
  date: string;
  /** Strategy portfolio value. */
  strategy: number;
  /** Cumulative contributed cash at this date. */
  contributed: number;
  /** Benchmark portfolio values, keyed by benchmark key (e.g. qqq, voo). */
  qqq: number;
  voo: number;
}

export interface DrawdownPoint {
  date: string;
  strategy: number;
}

/** A current holding line: actual shares, price per share, market value, weight. */
export interface HoldingSlice {
  asset: string;
  shares: number;
  price: number;
  value: number;
  weightPct: number;
}

/** One leg of a trade (a single asset bought or sold). */
export interface TradeLeg {
  asset: string;
  shares: number;
  amount: number;
}

export interface TradeRecord {
  date: string;
  /** '初始建倉' | '調整部位' | '定期投入' | '再平衡' */
  kind: string;
  sells: TradeLeg[];
  buys: TradeLeg[];
  /** Cash balance immediately after this trade. */
  cashAfter: number;
  /** Total portfolio value at the time of the trade. */
  totalValue: number;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  mode: BacktestMode;
  currency: string;
  /** Requested start "YYYY-MM". */
  start: string;
  /** Actual first invested date after clamping to data/warm-up availability. */
  effectiveStart: string;
  /** Last date in the backtest. */
  end: string;
  monthlyAmount?: number;
  lumpSum?: number;
  metrics: BacktestMetrics;
  benchmarks: BenchmarkResult[];
  /** Monthly equity-curve points for charting. */
  equityCurve: EquityPoint[];
  /** Monthly drawdown points for the strategy. */
  drawdownCurve: DrawdownPoint[];
  /** Current holdings (shares + value) as of the last date. */
  holdingsNow: HoldingSlice[];
  /** Uninvested cash balance (USD) as of the last date. */
  cashNow: number;
  /** Total portfolio value (holdings + cash) as of the last date. */
  totalValueNow: number;
  /** Most recent trades with share/dollar detail. */
  recentTrades: TradeRecord[];
  /** Caveats / data notes surfaced to the user. */
  notes: string[];
}
