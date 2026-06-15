import { useQuery } from '@tanstack/react-query';
import type { BacktestMode, BacktestResult } from '@repo/shared';

export interface BacktestParams {
  strategyId: string;
  mode: BacktestMode;
  start: string;
  monthlyAmount: number;
  lumpSum: number;
}

/**
 * Runs a backtest. The TanStack default query fn turns the query key into the
 * request path, so the trailing object becomes the query string:
 *   ['api','backtest', { strategyId, mode, start, monthly }] -> api/backtest?...
 */
export function useBacktest(params: BacktestParams) {
  const query: Record<string, string | number> = {
    strategyId: params.strategyId,
    mode: params.mode,
    start: params.start,
  };
  if (params.mode === 'dca') query.monthly = params.monthlyAmount;
  else query.lump = params.lumpSum;

  return useQuery<BacktestResult>({
    queryKey: ['api', 'backtest', query],
    enabled: Boolean(params.strategyId),
  });
}
