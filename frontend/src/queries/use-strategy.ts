import { useQuery } from '@tanstack/react-query';
import type { StrategyDetail } from '@repo/shared';

export function useStrategy(id: string) {
  return useQuery<StrategyDetail>({
    queryKey: ['api', 'strategies', id],
    enabled: Boolean(id),
  });
}
