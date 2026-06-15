/**
 * Live "what should I hold right now" signal — computed from the latest market
 * data, not precomputed. Powers the future buy/sell alert feature.
 */

export type SignalStance = 'invested' | 'cash' | 'mixed';

export interface SignalAllocation {
  asset: string;
  weightPct: number;
}

export interface CurrentSignal {
  strategyId: string;
  strategyName: string;
  /** Latest market-data date the signal was computed from. */
  asOf: string;
  /** ISO timestamp of when the signal was evaluated. */
  computedAt: string;
  stance: SignalStance;
  /** Current target allocation (includes a cash row when not fully invested). */
  allocations: SignalAllocation[];
  /** Human-readable recommendation, e.g. "建議持有：3x 那斯達克 (TQQQ) 100%". */
  summary: string;
}

/** Emitted when a strategy's target allocation changes between evaluations. */
export interface SignalChange {
  strategyId: string;
  strategyName: string;
  asOf: string;
  from: string;
  to: string;
}
