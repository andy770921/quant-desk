import { useQuery } from '@tanstack/react-query';
import type { PriceSeries } from '@repo/shared';

export function useMarketSeries(symbol: string) {
  return useQuery<PriceSeries>({
    queryKey: ['api', 'market', 'series', symbol],
    enabled: Boolean(symbol),
  });
}
