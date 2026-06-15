import { useQuery } from '@tanstack/react-query';
import type { MarketOverview } from '@repo/shared';

export function useMarketOverview() {
  return useQuery<MarketOverview>({
    queryKey: ['api', 'market', 'overview'],
  });
}
