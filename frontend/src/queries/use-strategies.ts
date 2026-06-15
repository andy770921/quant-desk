import { useQuery } from '@tanstack/react-query';
import type { StrategySummary } from '@repo/shared';

export function useStrategies() {
  return useQuery<StrategySummary[]>({
    queryKey: ['api', 'strategies'],
  });
}
